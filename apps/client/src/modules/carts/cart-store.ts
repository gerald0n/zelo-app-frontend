'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CatalogAddon, CatalogProduct } from '@/modules/catalog/types';
import {
  CART_PERSIST_VERSION,
  CART_STORAGE_KEY,
  CART_TTL_MS,
  computeCartTotals,
  isSameCartLine,
  mergeDuplicateCartItems,
  unitPriceWithAddons,
  type CartItem,
  type CartTotals,
} from '@/modules/carts/types';

type CartPersisted = {
  version: number;
  updatedAt: number;
  items: CartItem[];
};

type CartActions = {
  addItem: (
    product: CatalogProduct,
    quantity: number,
    selectedAddons: CatalogAddon[],
    note?: string,
  ) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateItem: (
    itemId: string,
    patch: {
      quantity?: number;
      selectedAddons?: CatalogAddon[];
      note?: string | null;
      basePrice?: number;
      name?: string;
      image?: string | null;
      slug?: string;
    },
  ) => void;
  replaceItems: (items: CartItem[]) => void;
  clearCart: () => void;
  touch: () => void;
  decrementProduct: (productId: string) => void;
  removeProduct: (productId: string) => void;
};

type CartStore = CartPersisted & CartActions;

function now() {
  return Date.now();
}

function isExpired(updatedAt: number) {
  return now() - updatedAt > CART_TTL_MS;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      version: CART_PERSIST_VERSION,
      updatedAt: now(),
      items: [],

      addItem(product, quantity, selectedAddons, note) {
        if (quantity <= 0 || !product.available) return;
        const availableAddons = selectedAddons.filter(
          (addon) => addon.isAvailable,
        );
        const price = unitPriceWithAddons(product.price, availableAddons);
        const normalizedNote = note?.trim() || undefined;
        const incoming = {
          productId: product.id,
          selectedAddons: availableAddons,
          note: normalizedNote,
        };

        set((state) => {
          const items = mergeDuplicateCartItems(state.items);
          const matchIndex = items.findIndex((item) =>
            isSameCartLine(item, incoming),
          );

          if (matchIndex >= 0) {
            return {
              items: items.map((item, index) =>
                index === matchIndex
                  ? {
                      ...item,
                      quantity: item.quantity + quantity,
                      slug: product.slug,
                      name: product.name,
                      basePrice: product.price,
                      price,
                      selectedAddons: availableAddons,
                      note: normalizedNote,
                      image: product.image,
                    }
                  : item,
              ),
              updatedAt: now(),
            };
          }

          return {
            items: [
              ...items,
              {
                id: `${product.id}_${now()}`,
                productId: product.id,
                slug: product.slug,
                name: product.name,
                basePrice: product.price,
                price,
                quantity,
                selectedAddons: availableAddons,
                note: normalizedNote,
                image: product.image,
              },
            ],
            updatedAt: now(),
          };
        });
      },

      removeItem(itemId) {
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
          updatedAt: now(),
        }));
      },

      updateQuantity(itemId, quantity) {
        if (quantity <= 0) {
          get().removeItem(itemId);
          return;
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, quantity } : item,
          ),
          updatedAt: now(),
        }));
      },

      updateItem(itemId, patch) {
        set((state) => ({
          items: state.items
            .map((item) => {
              if (item.id !== itemId) return item;
              const quantity = patch.quantity ?? item.quantity;
              if (quantity <= 0) return null;
              const selectedAddons =
                patch.selectedAddons ?? item.selectedAddons;
              const basePrice = patch.basePrice ?? item.basePrice;
              return {
                ...item,
                quantity,
                selectedAddons,
                basePrice,
                price: unitPriceWithAddons(basePrice, selectedAddons),
                note:
                  patch.note === null ? undefined : (patch.note ?? item.note),
                name: patch.name ?? item.name,
                image: patch.image === undefined ? item.image : patch.image,
                slug: patch.slug ?? item.slug,
              };
            })
            .filter((item): item is CartItem => item !== null),
          updatedAt: now(),
        }));
      },

      replaceItems(items) {
        set({ items, updatedAt: now() });
      },

      clearCart() {
        set({ items: [], updatedAt: now() });
      },

      decrementProduct(productId) {
        const lines = get().items.filter((item) => item.productId === productId);
        if (lines.length === 0) return;
        const plain = lines.find(
          (item) => item.selectedAddons.length === 0 && !item.note?.trim(),
        );
        const target = plain ?? lines[lines.length - 1];
        get().updateQuantity(target.id, target.quantity - 1);
      },

      removeProduct(productId) {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
          updatedAt: now(),
        }));
      },

      touch() {
        set({ updatedAt: now() });
      },
    }),
    {
      name: CART_STORAGE_KEY,
      version: CART_PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        version: state.version,
        updatedAt: state.updatedAt,
        items: state.items,
      }),
      migrate: (persisted) => {
        const data = persisted as CartPersisted | undefined;
        if (!data || typeof data !== 'object') {
          return {
            version: CART_PERSIST_VERSION,
            updatedAt: now(),
            items: [],
          };
        }
        if (
          data.version !== CART_PERSIST_VERSION ||
          isExpired(data.updatedAt)
        ) {
          return {
            version: CART_PERSIST_VERSION,
            updatedAt: now(),
            items: [],
          };
        }
        return {
          version: CART_PERSIST_VERSION,
          updatedAt: data.updatedAt,
          items: Array.isArray(data.items) ? data.items : [],
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const invalid =
          isExpired(state.updatedAt) ||
          state.items.some(
            (item) =>
              !item.id ||
              !item.productId ||
              !item.slug ||
              typeof item.basePrice !== 'number',
          );
        if (invalid) {
          state.clearCart();
          return;
        }
        const compacted = mergeDuplicateCartItems(state.items);
        if (compacted.length !== state.items.length) {
          state.replaceItems(compacted);
        }
      },
    },
  ),
);

export function selectCartTotals(items: CartItem[]): CartTotals {
  return computeCartTotals(items);
}

/** Hook de conveniência compatível com o antigo CartContext. */
export function useCart() {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const updateItem = useCartStore((state) => state.updateItem);
  const replaceItems = useCartStore((state) => state.replaceItems);
  const clearCart = useCartStore((state) => state.clearCart);
  const decrementProduct = useCartStore((state) => state.decrementProduct);
  const removeProduct = useCartStore((state) => state.removeProduct);
  const updatedAt = useCartStore((state) => state.updatedAt);
  const totals = computeCartTotals(items);

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    updateItem,
    replaceItems,
    clearCart,
    decrementProduct,
    removeProduct,
    updatedAt,
    ...totals,
  };
}
