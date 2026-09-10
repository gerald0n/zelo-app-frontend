import 'server-only';

import { after } from 'next/server';
import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/modules/admin/auth';
import {
  deliveryAddressSummary,
  formatAddress,
} from '@/lib/admin/order-address';
import { notifyOrderStatusChange } from '@/modules/notifications/send';
import { canCustomerCancel, type OrderStatus } from '@/modules/orders/types';
import { mapReviewRow } from '@/modules/reviews/types';
import type {
  AdminOrderDetail,
  AdminOrderListItem,
} from '@/modules/admin/types';

export type {
  AdminOrderDetail,
  AdminOrderListItem,
} from '@/modules/admin/types';
export { nextAdminStatus } from '@/modules/admin/types';

const LIST_SELECT = `
  id,
  order_number,
  status,
  delivery_method,
  payment_method,
  payment_status,
  mp_order_id,
  timing,
  scheduled_for,
  total_cents,
  created_at,
  updated_at,
  guest_name,
  guest_phone_e164,
  customers ( name, phone_e164 ),
  order_addresses ( street, number, neighborhood ),
  order_items ( product_name, quantity )
`;

const DETAIL_SELECT = `
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
  coupon_code,
  coupon_discount_cents,
  needs_change,
  change_for_amount_cents,
  customer_note,
  internal_note,
  cancellation_reason,
  cancelled_at,
  created_at,
  updated_at,
  guest_name,
  guest_phone_e164,
  customers ( id, name, phone_e164 ),
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
  ),
  order_reviews ( rating, comment, status, created_at )
`;

export async function listAdminOrders(options?: {
  scope?: 'active' | 'scheduled' | 'done' | 'all';
  q?: string;
}): Promise<Result<AdminOrderListItem[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  let query = admin
    .from('orders')
    .select(LIST_SELECT)
    .order('created_at', { ascending: false })
    .limit(200);

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
  } else if (scope === 'scheduled') {
    query = query.eq('timing', 'scheduled').not('scheduled_for', 'is', null);
  } else if (scope === 'done') {
    query = query.in('status', ['delivered', 'cancelled']);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('Falha ao listar pedidos admin', { message: error.message });
    return err('INTERNAL_ERROR', 'Não foi possível carregar os pedidos.', {
      cause: error,
    });
  }

  const q = options?.q?.trim().toLowerCase();
  const mapped = (data ?? []).map((row) => {
    const customer = Array.isArray(row.customers)
      ? row.customers[0]
      : row.customers;
    const addr = Array.isArray(row.order_addresses)
      ? row.order_addresses[0]
      : row.order_addresses;
    return {
      id: row.id,
      orderNumber: row.order_number,
      number: `#${row.order_number}`,
      status: row.status as OrderStatus,
      deliveryMethod: row.delivery_method,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      hasPixCharge: row.mp_order_id !== null,
      timing: row.timing,
      scheduledFor: row.scheduled_for,
      totalCents: row.total_cents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customerName: customer?.name ?? row.guest_name ?? null,
      customerPhone: customer?.phone_e164 ?? row.guest_phone_e164 ?? null,
      isGuest: !customer,
      deliveryAddress: deliveryAddressSummary(row.delivery_method, addr),
      items: (row.order_items ?? []).map(
        (item: { product_name: string; quantity: number }) => ({
          name: item.product_name,
          quantity: item.quantity,
        }),
      ),
    } satisfies AdminOrderListItem;
  });

  if (!q) return ok(mapped);

  return ok(
    mapped.filter(
      (order) =>
        order.number.toLowerCase().includes(q) ||
        String(order.orderNumber).includes(q) ||
        order.customerName?.toLowerCase().includes(q) ||
        order.items.some((item) => item.name.toLowerCase().includes(q)),
    ),
  );
}

export async function getAdminOrder(
  orderId: string,
): Promise<Result<AdminOrderDetail>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('orders')
    .select(DETAIL_SELECT)
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar o pedido.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Pedido não encontrado.');

  const customer = Array.isArray(data.customers)
    ? data.customers[0]
    : data.customers;
  const addressRaw = Array.isArray(data.order_addresses)
    ? data.order_addresses[0]
    : data.order_addresses;
  const history = [...(data.order_status_history ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return ok({
    id: data.id,
    orderNumber: data.order_number,
    number: `#${data.order_number}`,
    status: data.status as OrderStatus,
    timing: data.timing,
    scheduledFor: data.scheduled_for,
    deliveryMethod: data.delivery_method,
    paymentMethod: data.payment_method,
    paymentStatus: data.payment_status,
    hasPixCharge: data.mp_order_id !== null,
    subtotalCents: data.subtotal_cents + data.add_ons_total_cents,
    deliveryFeeCents: data.delivery_fee_cents,
    totalCents: data.total_cents,
    couponCode: data.coupon_code,
    couponDiscountCents: data.coupon_discount_cents ?? 0,
    needsChange: data.needs_change,
    changeForAmountCents: data.change_for_amount_cents,
    customerNote: data.customer_note,
    internalNote: data.internal_note,
    cancellationReason: data.cancellation_reason,
    cancelledAt: data.cancelled_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
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
    items: (data.order_items ?? []).map((item) => ({
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
    canCancel: canCustomerCancel(data.status as OrderStatus),
    review: mapReviewRow(data.order_reviews),
    canReview: false,
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          phoneE164: customer.phone_e164,
        }
      : null,
    guest:
      !customer && data.guest_name && data.guest_phone_e164
        ? { name: data.guest_name, phoneE164: data.guest_phone_e164 }
        : null,
    isGuest: !customer,
  });
}

export async function transitionAdminOrderStatus(options: {
  orderId: string;
  newStatus: OrderStatus;
  reason?: string | null;
}): Promise<Result<AdminOrderDetail>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('transition_order_status', {
    p_order_id: options.orderId,
    p_new_status: options.newStatus,
    p_actor_type: 'admin',
    p_reason: options.reason ?? undefined,
  });

  if (error) {
    logger.error('Transição admin falhou', { message: error.message });
    return err(
      'VALIDATION_ERROR',
      error.message || 'Transição de status inválida.',
      { cause: error },
    );
  }

  const order = await getAdminOrder(options.orderId);
  if (order.ok) {
    // `after` estende a vida da invocação até o push terminar — sem isso, em
    // serverless a função congela ao responder e a notificação se perde.
    after(() =>
      notifyOrderStatusChange({
        orderId: options.orderId,
        newStatus: options.newStatus,
        orderNumber: order.data.orderNumber,
      }),
    );
  }
  return order;
}
