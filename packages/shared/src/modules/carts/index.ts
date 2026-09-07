export type { CartItem, CartTotals, CartSyncLine } from '@/modules/carts/types';
export {
  CART_PERSIST_VERSION,
  CART_STORAGE_KEY,
  CART_TTL_MS,
  computeCartTotals,
  cartItemsToSyncLines,
} from '@/modules/carts/types';
export { useCart, useCartStore } from '@/modules/carts/cart-store';
export {
  revalidateCartAgainstCatalog,
  type CartRevalidationChange,
  type CartRevalidationResult,
} from '@/modules/carts/revalidate-cart';
