export {
  createOrderFromCheckout,
  previewCheckout,
  createOrderBodySchema,
  type CreateOrderBody,
  type CreatedOrderSummary,
  type CreatedOrderPix,
} from '@/modules/orders/create-order';
export {
  previewOrderCoupon,
  couponPreviewSchema,
  type CouponPreview,
  type CouponPreviewInput,
  type CouponDiscountType,
} from '@/modules/orders/coupon-preview';
export {
  resolveCustomerForCheckout,
  ensureCustomerRecord,
} from '@/modules/orders/customer';
export {
  listCustomerOrders,
  getCustomerOrder,
  cancelCustomerOrder,
  reorderCustomerOrder,
} from '@/modules/orders/customer-orders';
/** Tipos e helpers seguros para Client Components — importe de `@/modules/orders/types`. */
export type {
  CustomerOrder,
  CustomerOrderListItem,
  CustomerOrderItem,
  CustomerOrderHistoryEntry,
  OrderStatus,
  DeliveryMethod,
  PaymentMethod,
} from '@/modules/orders/types';
export type { ReorderResult } from '@/modules/orders/customer-orders';
