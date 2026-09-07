import type { CatalogAddon } from '@/modules/catalog/types';

export const CART_STORAGE_KEY = '@zelo/cart:v1';
export const CART_PERSIST_VERSION = 1;
export const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CartItem = {
  id: string;
  productId: string;
  slug: string;
  name: string;
  /** Preço do produto em centavos (sem adicionais). */
  basePrice: number;
  /** Preço unitário com adicionais em centavos. */
  price: number;
  quantity: number;
  selectedAddons: CatalogAddon[];
  note?: string;
  image: string | null;
};

export type CartTotals = {
  productsSubtotal: number;
  addonsTotal: number;
  /** Subtotal de itens (produtos + adicionais). Taxa de entrega à parte. */
  subtotal: number;
  totalItems: number;
};

export function computeCartTotals(items: CartItem[]): CartTotals {
  let productsSubtotal = 0;
  let addonsTotal = 0;
  let totalItems = 0;

  for (const item of items) {
    productsSubtotal += item.basePrice * item.quantity;
    addonsTotal += (item.price - item.basePrice) * item.quantity;
    totalItems += item.quantity;
  }

  return {
    productsSubtotal,
    addonsTotal,
    subtotal: productsSubtotal + addonsTotal,
    totalItems,
  };
}

export function unitPriceWithAddons(
  basePrice: number,
  selectedAddons: CatalogAddon[],
): number {
  const addonTotal = selectedAddons.reduce(
    (sum, addon) => sum + addon.price,
    0,
  );
  return basePrice + addonTotal;
}

function normalizeNote(note?: string | null) {
  return note?.trim() || '';
}

function addonSignature(addons: CatalogAddon[]) {
  return addons
    .map((addon) => addon.id)
    .sort()
    .join(',');
}

export function isSameCartLine(
  item: Pick<CartItem, 'productId' | 'selectedAddons' | 'note'>,
  other: Pick<CartItem, 'productId' | 'selectedAddons' | 'note'>,
) {
  return (
    item.productId === other.productId &&
    addonSignature(item.selectedAddons) ===
      addonSignature(other.selectedAddons) &&
    normalizeNote(item.note) === normalizeNote(other.note)
  );
}

/** Junta linhas iguais (mesmo produto, adicionais e observação). */
export function mergeDuplicateCartItems(items: CartItem[]): CartItem[] {
  const merged: CartItem[] = [];
  for (const item of items) {
    const existing = merged.find((row) => isSameCartLine(row, item));
    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }
    merged.push({ ...item });
  }
  return merged;
}

/** Linha enviada ao servidor para persistir / reconciliar. */
export type CartSyncLine = {
  productId: string;
  quantity: number;
  addOnIds: string[];
  customerNote?: string;
};

export function cartItemsToSyncLines(items: CartItem[]): CartSyncLine[] {
  return mergeDuplicateCartItems(items).map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    addOnIds: [...item.selectedAddons.map((addon) => addon.id)].sort(),
    customerNote: item.note?.trim() || undefined,
  }));
}

export function mergeCartSyncLines(
  local: CartSyncLine[],
  remote: CartSyncLine[],
): CartSyncLine[] {
  const merged: CartSyncLine[] = [];
  for (const line of [...remote, ...local]) {
    const addOnIds = [...line.addOnIds].sort();
    const note = line.customerNote?.trim() || '';
    const existing = merged.find(
      (row) =>
        row.productId === line.productId &&
        row.addOnIds.join(',') === addOnIds.join(',') &&
        (row.customerNote?.trim() || '') === note,
    );
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + line.quantity);
      continue;
    }
    merged.push({
      productId: line.productId,
      quantity: line.quantity,
      addOnIds,
      customerNote: note || undefined,
    });
  }
  return merged;
}
