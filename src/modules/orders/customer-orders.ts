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
  canCustomerCancel,
  type CustomerOrder,
  type CustomerOrderListItem,
  type OrderStatus,
} from '@/modules/orders/types';
import type { CartItem } from '@/modules/carts/types';
import { unitPriceWithAddons } from '@/modules/carts/types';
import type { CatalogAddon } from '@/modules/catalog/types';

const ORDER_LIST_SELECT = `
  id,
  order_number,
  status,
  delivery_method,
  payment_method,
  payment_status,
  mp_order_id,
  subtotal_cents,
  add_ons_total_cents,
  delivery_fee_cents,
  total_cents,
  created_at,
  scheduled_for,
  order_items (
    id,
    product_name,
    quantity,
    line_total_cents,
    order_item_add_ons ( add_on_name )
  )
`;

const ORDER_DETAIL_SELECT = `
  id,
  order_number,
  status,
  timing,
  scheduled_for,
  delivery_method,
  payment_method,
  payment_status,
  mp_order_id,
  subtotal_cents,
  add_ons_total_cents,
  delivery_fee_cents,
  total_cents,
  needs_change,
  change_for_amount_cents,
  customer_note,
  cancellation_reason,
  cancelled_at,
  created_at,
  updated_at,
  order_addresses (
    street,
    number,
    neighborhood,
    city,
    state,
    complement,
    reference_point,
    route_distance_meters
  ),
  order_items (
    id,
    product_id,
    product_name,
    quantity,
    unit_price_cents,
    line_total_cents,
    customer_note,
    order_item_add_ons (
      add_on_id,
      add_on_name,
      quantity,
      unit_price_cents
    )
  ),
  order_status_history (
    id,
    previous_status,
    new_status,
    actor_type,
    reason,
    created_at
  )
`;

function formatAddress(parts: {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string | null;
}): string {
  const base = parts.neighborhood
    ? `${parts.street}, ${parts.number} – ${parts.neighborhood}, ${parts.city}/${parts.state}`
    : `${parts.street}, ${parts.number} – ${parts.city}/${parts.state}`;
  return parts.complement ? `${base} · ${parts.complement}` : base;
}

function mapListItem(row: {
  id: string;
  order_number: number;
  status: OrderStatus;
  delivery_method: CustomerOrder['deliveryMethod'];
  payment_method: CustomerOrder['paymentMethod'];
  payment_status: string;
  mp_order_id: string | null;
  subtotal_cents: number;
  add_ons_total_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  created_at: string;
  scheduled_for: string | null;
  order_items:
    | Array<{
        id: string;
        product_name: string;
        quantity: number;
        line_total_cents: number;
        order_item_add_ons: Array<{ add_on_name: string }> | null;
      }>
    | null;
}): CustomerOrderListItem {
  return {
    id: row.id,
    orderNumber: row.order_number,
    number: `#${row.order_number}`,
    status: row.status,
    deliveryMethod: row.delivery_method,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    hasPixCharge: row.mp_order_id !== null,
    subtotalCents: row.subtotal_cents + row.add_ons_total_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    scheduledFor: row.scheduled_for,
    canCancel: canCustomerCancel(row.status),
    items: (row.order_items ?? []).map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
      lineTotalCents: item.line_total_cents,
      addOns: (item.order_item_add_ons ?? []).map((a) => a.add_on_name),
    })),
  };
}

function mapDetail(row: {
  id: string;
  order_number: number;
  status: OrderStatus;
  timing: CustomerOrder['timing'];
  scheduled_for: string | null;
  delivery_method: CustomerOrder['deliveryMethod'];
  payment_method: CustomerOrder['paymentMethod'];
  payment_status: string;
  mp_order_id: string | null;
  subtotal_cents: number;
  add_ons_total_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  needs_change: boolean | null;
  change_for_amount_cents: number | null;
  customer_note: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  order_addresses:
    | {
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        state: string;
        complement: string | null;
        reference_point: string | null;
        route_distance_meters: number;
      }
    | Array<{
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        state: string;
        complement: string | null;
        reference_point: string | null;
        route_distance_meters: number;
      }>
    | null;
  order_items:
    | Array<{
        id: string;
        product_id: string | null;
        product_name: string;
        quantity: number;
        unit_price_cents: number;
        line_total_cents: number;
        customer_note: string | null;
        order_item_add_ons:
          | Array<{
              add_on_id: string | null;
              add_on_name: string;
              quantity: number;
              unit_price_cents: number;
            }>
          | null;
      }>
    | null;
  order_status_history:
    | Array<{
        id: string;
        previous_status: OrderStatus | null;
        new_status: OrderStatus;
        actor_type: string;
        reason: string | null;
        created_at: string;
      }>
    | null;
}): CustomerOrder {
  const addressRaw = Array.isArray(row.order_addresses)
    ? row.order_addresses[0]
    : row.order_addresses;

  const history = [...(row.order_status_history ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return {
    id: row.id,
    orderNumber: row.order_number,
    number: `#${row.order_number}`,
    status: row.status,
    timing: row.timing,
    scheduledFor: row.scheduled_for,
    deliveryMethod: row.delivery_method,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    hasPixCharge: row.mp_order_id !== null,
    subtotalCents: row.subtotal_cents + row.add_ons_total_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    totalCents: row.total_cents,
    needsChange: row.needs_change,
    changeForAmountCents: row.change_for_amount_cents,
    customerNote: row.customer_note,
    cancellationReason: row.cancellation_reason,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    address: addressRaw
      ? {
          street: addressRaw.street,
          number: addressRaw.number,
          neighborhood: addressRaw.neighborhood,
          city: addressRaw.city,
          state: addressRaw.state,
          complement: addressRaw.complement,
          referencePoint: addressRaw.reference_point,
          formatted: formatAddress(addressRaw),
          routeDistanceMeters: addressRaw.route_distance_meters,
        }
      : null,
    items: (row.order_items ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.product_name,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      lineTotalCents: item.line_total_cents,
      note: item.customer_note,
      addOns: (item.order_item_add_ons ?? []).map((addon) => ({
        id: addon.add_on_id,
        name: addon.add_on_name,
        quantity: addon.quantity,
        unitPriceCents: addon.unit_price_cents,
      })),
    })),
    history: history.map((entry) => ({
      id: entry.id,
      previousStatus: entry.previous_status,
      newStatus: entry.new_status,
      actorType: entry.actor_type,
      reason: entry.reason,
      createdAt: entry.created_at,
    })),
    canCancel: canCustomerCancel(row.status),
  };
}

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

export async function cancelCustomerOrder(options: {
  orderId: string;
  reason: string;
}): Promise<Result<CustomerOrder>> {
  const reason = options.reason.trim();
  if (reason.length < 3) {
    return err('VALIDATION_ERROR', 'Informe um motivo com pelo menos 3 caracteres.');
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
    return err('CANCELLATION_BLOCKED', 'Cancelamento não permitido neste status.', {
      cause: error,
    });
  }

  return getCustomerOrder(options.orderId);
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
