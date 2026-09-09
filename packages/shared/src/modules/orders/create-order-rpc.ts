import 'server-only';

import { err, ok, type AppError, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type {
  CreateOrderBody,
  CreatedOrderSummary,
} from '@/modules/orders/create-order-schema';

function mapRpcError(message: string): AppError {
  const lower = message.toLowerCase();
  if (lower.includes('não autenticado') || lower.includes('autorizado')) {
    return {
      code: 'UNAUTHENTICATED',
      message: 'Faça login para concluir o pedido.',
    };
  }
  if (lower.includes('indisponível') || lower.includes('inválido')) {
    return { code: 'PRODUCT_UNAVAILABLE', message };
  }
  if (lower.includes('endereço') || lower.includes('área')) {
    return { code: 'OUT_OF_DELIVERY_AREA', message };
  }
  if (lower.includes('troco')) {
    return { code: 'VALIDATION_ERROR', message };
  }
  if (lower.includes('agend')) {
    return { code: 'STORE_CLOSED', message };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'Não foi possível criar o pedido.',
  };
}

export function toRpcPayload(
  body: CreateOrderBody,
  delivery: {
    deliveryFeeCents: number;
    routeDistanceMeters: number | null;
    address: CreateOrderBody['address'];
  },
  scheduledFor: string | null,
  cartId: string | null,
) {
  return {
    cart_id: cartId,
    timing: body.timing,
    scheduled_for: scheduledFor,
    delivery_method: body.deliveryMethod,
    payment_method: body.paymentMethod,
    needs_change:
      body.paymentMethod === 'cash' ? Boolean(body.needsChange) : false,
    change_for_amount_cents:
      body.paymentMethod === 'cash' && body.needsChange
        ? body.changeForAmountCents
        : null,
    customer_note: body.customerNote ?? null,
    coupon_code: body.couponCode ? body.couponCode.toUpperCase() : null,
    delivery_fee_cents: delivery.deliveryFeeCents,
    route_distance_meters: delivery.routeDistanceMeters,
    address:
      body.deliveryMethod === 'delivery' && delivery.address
        ? {
            street: delivery.address.street,
            number: delivery.address.number,
            neighborhood: delivery.address.neighborhood,
            city: delivery.address.city,
            state: delivery.address.state,
            postal_code: delivery.address.postalCode ?? null,
            complement: delivery.address.complement ?? null,
            reference_point: delivery.address.referencePoint ?? null,
            latitude: delivery.address.latitude,
            longitude: delivery.address.longitude,
          }
        : null,
    items: body.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      customer_note: item.customerNote ?? null,
      add_ons: item.addOns.map((addon) => ({
        add_on_id: addon.addOnId,
        quantity: addon.quantity,
      })),
    })),
  };
}

export async function fetchOrderSummary(
  orderId: string,
): Promise<Result<CreatedOrderSummary>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('orders')
    .select(
      'id, order_number, status, total_cents, delivery_fee_cents, subtotal_cents, add_ons_total_cents, coupon_code, coupon_discount_cents',
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data) {
    return err(
      'INTERNAL_ERROR',
      'Pedido criado, mas falhou ao carregar resumo.',
      {
        cause: error,
      },
    );
  }

  const address = await admin
    .from('order_addresses')
    .select('route_distance_meters')
    .eq('order_id', orderId)
    .maybeSingle();

  return ok({
    id: data.id,
    orderNumber: data.order_number,
    status: data.status,
    totalCents: data.total_cents,
    deliveryFeeCents: data.delivery_fee_cents,
    subtotalCents: data.subtotal_cents + data.add_ons_total_cents,
    couponCode: data.coupon_code,
    couponDiscountCents: data.coupon_discount_cents ?? 0,
    routeDistanceMeters: address.data?.route_distance_meters ?? null,
  });
}

export async function invokeCreateOrder(
  rpcPayload: Record<string, unknown>,
): Promise<Result<string>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('create_order', {
    payload: rpcPayload as never,
  });

  if (error || !data) {
    logger.error('create_order falhou', { message: error?.message });
    return {
      ok: false,
      error: mapRpcError(error?.message ?? 'Falha ao criar pedido'),
    };
  }
  return ok(data);
}
