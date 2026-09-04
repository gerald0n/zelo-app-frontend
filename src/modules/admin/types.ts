import type { CustomerOrder, OrderStatus } from '@/modules/orders/types';
import type { CatalogBusinessHour, CatalogStore } from '@/modules/catalog/types';

export type AdminOrderListItem = {
  id: string;
  orderNumber: number;
  number: string;
  status: OrderStatus;
  deliveryMethod: CustomerOrder['deliveryMethod'];
  paymentMethod: CustomerOrder['paymentMethod'];
  paymentStatus: string;
  hasPixCharge: boolean;
  timing: CustomerOrder['timing'];
  scheduledFor: string | null;
  totalCents: number;
  createdAt: string;
  /** Aproxima "tempo parado no status atual" — qualquer update no pedido o move. */
  updatedAt: string;
  customerName: string | null;
  customerPhone: string | null;
  items: Array<{ name: string; quantity: number }>;
};

export type AdminOrderDetail = CustomerOrder & {
  internalNote: string | null;
  customer: {
    id: string;
    name: string;
    phoneE164: string;
  } | null;
};

export type AdminProductImage = {
  id: string;
  storagePath: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
  url: string;
};

export type AdminProduct = {
  id: string;
  categoryId: string;
  categoryName: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  weightMinGrams: number | null;
  weightMaxGrams: number | null;
  stockQuantity: number | null;
  isActive: boolean;
  isAvailable: boolean;
  archivedAt: string | null;
  sortOrder: number;
  images: AdminProductImage[];
  addonIds: string[];
};

export type AdminCategory = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type AdminAddon = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  isActive: boolean;
  isAvailable: boolean;
};

export type PromotionScope = 'store' | 'category' | 'products';

export type AdminPromotion = {
  id: string;
  name: string;
  scope: PromotionScope;
  discountPercent: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  /** Presente só quando `scope === 'category'`. */
  categoryIds: string[];
  /** Presente só quando `scope === 'products'`. */
  productIds: string[];
};

export type AdminBlackout = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export type AdminStoreSettings = CatalogStore & {
  acceptingOrders: boolean;
};

export type AdminBusinessHourInput = CatalogBusinessHour;

export function nextAdminStatus(
  status: OrderStatus,
  deliveryMethod: CustomerOrder['deliveryMethod'],
): OrderStatus | null {
  if (status === 'in_production') {
    return deliveryMethod === 'pickup'
      ? 'ready_for_pickup'
      : 'ready_for_delivery';
  }
  const map: Partial<Record<OrderStatus, OrderStatus>> = {
    received: 'confirmed',
    confirmed: 'in_production',
    ready_for_delivery: 'out_for_delivery',
    ready_for_pickup: 'delivered',
    out_for_delivery: 'delivered',
  };
  return map[status] ?? null;
}
