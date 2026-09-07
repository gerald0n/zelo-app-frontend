import {
  canCustomerCancel,
  type CustomerOrder,
  type CustomerOrderListItem,
  type OrderStatus,
} from '@/modules/orders/types';

export const ORDER_LIST_SELECT = `
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

export const ORDER_DETAIL_SELECT = `
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

export function mapListItem(row: {
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

export function mapDetail(row: {
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
