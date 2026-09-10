import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { productImagePublicUrl } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { CustomerIdentity } from '@/modules/auth/customer-identity';
import {
  ensureCustomerRecord,
  resolveCustomerForCheckout,
} from '@/modules/orders/customer';
import {
  type CustomerOrder,
  type CustomerOrderListItem,
} from '@/modules/orders/types';
import {
  mapDetail,
  mapListItem,
  ORDER_DETAIL_SELECT,
  ORDER_LIST_SELECT,
} from '@/modules/orders/customer-orders-mappers';
import { refundOrderPixPayment } from '@/modules/payments/order-pix-webhook';
import type { CartItem } from '@/modules/carts/types';
import { unitPriceWithAddons } from '@/modules/carts/types';
import type { CatalogAddon } from '@/modules/catalog/types';

async function resolveIdentity(): Promise<Result<CustomerIdentity>> {
  const identity = await resolveCustomerForCheckout();
  if (!identity.ok) return identity;
  return ensureCustomerRecord(identity.data);
}

export async function listCustomerOrders(options?: {
  scope?: 'active' | 'history' | 'all';
}): Promise<Result<CustomerOrderListItem[]>> {
  const identity = await resolveIdentity();
  if (!identity.ok) return identity;

  const admin = createAdminSupabaseClient();
  let query = admin
    .from('orders')
    .select(ORDER_LIST_SELECT)
    .eq('customer_id', identity.data.id)
    .order('created_at', { ascending: false });

  const scope = options?.scope ?? 'all';
  if (scope === 'active') {
    query = query.in('status', [
      'received',
      'confirmed',
      'in_production',
      'ready_for_delivery',
      'ready_for_pickup',
      'out_for_delivery',
    ]);
  } else if (scope === 'history') {
    query = query.in('status', ['delivered', 'cancelled']);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('Falha ao listar pedidos', { message: error.message });
    return err('INTERNAL_ERROR', 'Não foi possível carregar os pedidos.', {
      cause: error,
    });
  }

  return ok((data ?? []).map((row) => mapListItem(row as never)));
}

export async function getCustomerOrder(
  orderId: string,
): Promise<Result<CustomerOrder>> {
  const identity = await resolveIdentity();
  if (!identity.ok) return identity;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('orders')
    .select(ORDER_DETAIL_SELECT)
    .eq('id', orderId)
    .eq('customer_id', identity.data.id)
    .maybeSingle();

  if (error) {
    logger.error('Falha ao carregar pedido', { message: error.message });
    return err('INTERNAL_ERROR', 'Não foi possível carregar o pedido.', {
      cause: error,
    });
  }

  if (!data) {
    return err('NOT_FOUND', 'Pedido não encontrado.');
  }

  return ok(mapDetail(data as never));
}

export type CancelCustomerOrderResult = {
  order: CustomerOrder;
  /** Presente quando o pedido era um Pix pago: estado do estorno automático. */
  refund?: 'done' | 'already' | 'failed';
};

export async function cancelCustomerOrder(options: {
  orderId: string;
  reason: string;
}): Promise<Result<CancelCustomerOrderResult>> {
  const reason = options.reason.trim();
  if (reason.length < 3) {
    return err(
      'VALIDATION_ERROR',
      'Informe um motivo com pelo menos 3 caracteres.',
    );
  }

  const identity = await resolveIdentity();
  if (!identity.ok) return identity;

  const existing = await getCustomerOrder(options.orderId);
  if (!existing.ok) return existing;
  if (!existing.data.canCancel) {
    return err(
      'CANCELLATION_BLOCKED',
      'Este pedido não pode mais ser cancelado.',
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('transition_order_status', {
    p_order_id: options.orderId,
    p_new_status: 'cancelled',
    p_actor_type: 'customer',
    p_reason: reason,
  });
  if (error) {
    logger.error('Cancelamento falhou', { message: error.message });
    return err(
      'CANCELLATION_BLOCKED',
      'Cancelamento não permitido neste status.',
      {
        cause: error,
      },
    );
  }

  // Pix já pago → estorna no Mercado Pago. A falha do estorno não desfaz o
  // cancelamento: o pedido fica marcado e a loja resolve pelo admin
  // ("Tentar estorno do Pix de novo") ou pelo painel do Mercado Pago.
  let refund: CancelCustomerOrderResult['refund'];
  if (
    existing.data.paymentMethod === 'pix' &&
    existing.data.paymentStatus === 'confirmed'
  ) {
    const result = await refundOrderPixPayment(options.orderId);
    if (result.ok) {
      refund = result.data.alreadyRefunded ? 'already' : 'done';
    } else {
      refund = 'failed';
      logger.error('Cliente cancelou, mas o estorno Pix falhou', {
        orderId: options.orderId,
        code: result.error.code,
      });
    }
  }

  const refreshed = await getCustomerOrder(options.orderId);
  if (!refreshed.ok) return refreshed;
  return ok({ order: refreshed.data, refund });
}

export type ReorderResult = {
  items: CartItem[];
  unavailableProducts: string[];
  unavailableAddOns: string[];
};

export async function reorderCustomerOrder(
  orderId: string,
): Promise<Result<ReorderResult>> {
  const order = await getCustomerOrder(orderId);
  if (!order.ok) return order;

  const admin = createAdminSupabaseClient();
  const restored: CartItem[] = [];
  const unavailableProducts: string[] = [];
  const unavailableAddOns: string[] = [];

  for (const item of order.data.items) {
    if (!item.productId) {
      unavailableProducts.push(item.name);
      continue;
    }

    const { data: product, error } = await admin
      .from('products')
      .select(
        `
        id,
        slug,
        name,
        price_cents,
        is_active,
        is_available,
        archived_at,
        product_images ( storage_path, alt_text, sort_order, is_primary ),
        product_add_ons (
          add_on_id,
          add_ons ( id, name, price_cents, is_active, is_available, archived_at, description )
        )
      `,
      )
      .eq('id', item.productId)
      .maybeSingle();

    if (
      error ||
      !product ||
      product.archived_at ||
      !product.is_active ||
      !product.is_available
    ) {
      unavailableProducts.push(item.name);
      continue;
    }

    const allowedAddOns = new Map(
      (product.product_add_ons ?? []).map((link) => {
        const addon = Array.isArray(link.add_ons)
          ? link.add_ons[0]
          : link.add_ons;
        return [link.add_on_id, addon] as const;
      }),
    );

    const selectedAddons: CatalogAddon[] = [];
    for (const snapshot of item.addOns) {
      if (!snapshot.id) {
        unavailableAddOns.push(snapshot.name);
        continue;
      }
      const current = allowedAddOns.get(snapshot.id);
      if (
        !current ||
        current.archived_at ||
        !current.is_active ||
        !current.is_available
      ) {
        unavailableAddOns.push(snapshot.name);
        continue;
      }
      selectedAddons.push({
        id: current.id,
        name: current.name,
        price: current.price_cents,
        isAvailable: true,
        description: current.description,
      });
    }

    const images = [...(product.product_images ?? [])].sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        a.sort_order - b.sort_order,
    );
    const image = images[0];

    restored.push({
      id: `${product.id}_reorder_${restored.length}`,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      basePrice: product.price_cents,
      price: unitPriceWithAddons(product.price_cents, selectedAddons),
      quantity: item.quantity,
      selectedAddons,
      note: item.note ?? undefined,
      image: image ? productImagePublicUrl(image.storage_path) : null,
    });
  }

  return ok({
    items: restored,
    unavailableProducts,
    unavailableAddOns,
  });
}
