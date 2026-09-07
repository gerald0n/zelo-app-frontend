/**
 * @deprecated Prefer `@/modules/carts`.
 * Mantido para imports existentes durante a migração.
 */
import type { ReactNode } from 'react';

export {
  useCart,
  useCartStore,
  type CartItem,
  type CartTotals,
} from '@/modules/carts';

/** Compatibilidade: Zustand não precisa de Provider. */
export function CartProvider({ children }: { children: ReactNode }) {
  return children;
}
