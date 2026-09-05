import type { CatalogStore } from '@/modules/catalog/types';
import type {
  DeliverySlipData,
  KitchenTicketData,
  ReceiptItem,
} from '@/modules/printing/types';
import type { AdminOrderDetail } from '@/modules/admin/types';

function mapItems(order: AdminOrderDetail): ReceiptItem[] {
  return order.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    addOns: item.addOns.map((addOn) => ({
      name: addOn.name,
      quantity: addOn.quantity,
    })),
    note: item.note,
  }));
}

export function orderToKitchenTicket(
  order: AdminOrderDetail,
): KitchenTicketData {
  return {
    orderNumber: order.number,
    createdAt: order.createdAt,
    deliveryMethod: order.deliveryMethod,
    timing: order.timing,
    scheduledFor: order.scheduledFor,
    isGuest: order.isGuest,
    customerName: order.customer?.name ?? order.guest?.name ?? null,
    customerPhone: order.customer?.phoneE164 ?? order.guest?.phoneE164 ?? null,
    address:
      order.deliveryMethod === 'delivery' && order.address
        ? {
            formatted: order.address.formatted,
            referencePoint: order.address.referencePoint,
          }
        : null,
    items: mapItems(order),
    customerNote: order.customerNote,
    internalNote: order.internalNote,
  };
}

export function orderToDeliverySlip(
  order: AdminOrderDetail,
  store: CatalogStore,
): DeliverySlipData {
  return {
    store: {
      name: store.name,
      cnpj: store.cnpj,
      addressLine: store.addressLine,
      city: store.city,
      state: store.state,
      phoneE164: store.phoneE164,
    },
    orderNumber: order.number,
    createdAt: order.createdAt,
    deliveryMethod: order.deliveryMethod,
    customerName: order.customer?.name ?? order.guest?.name ?? null,
    customerPhone: order.customer?.phoneE164 ?? order.guest?.phoneE164 ?? null,
    address: order.address
      ? {
          formatted: order.address.formatted,
          referencePoint: order.address.referencePoint,
        }
      : null,
    items: mapItems(order),
    customerNote: order.customerNote,
    subtotalCents: order.subtotalCents,
    deliveryFeeCents: order.deliveryFeeCents,
    totalCents: order.totalCents,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    needsChange: order.needsChange,
    changeForAmountCents: order.changeForAmountCents,
  };
}
