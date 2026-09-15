import type { CatalogAddon } from '@/modules/catalog/types';

export const CART_STORAGE_KEY = '@zelo/cart:v1';
export const CART_PERSIST_VERSION = 1;
export const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Adicional de pizza escolhido, com a metade em que foi aplicado. */
export type CartPizzaAddon = {
  pizzaAddonId: string;
  name: string;
  appliesTo: 'whole' | 'flavor1' | 'flavor2';
  priceCents: number;
};

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
  /** Tamanho escolhido — só presente em itens de pizza. */
  pizzaSize?: { id: string; name: string; diameterCm: number };
  /** Segundo sabor (meio a meio) — só presente em itens de pizza. */
  secondaryFlavor?: {
    productId: string;
    name: string;
    priceCents: number;
    image: string | null;
  };
  /** Adicionais de pizza selecionados, com a metade em que foram aplicados. */
  selectedPizzaAddons?: CartPizzaAddon[];
};

const PIZZA_ADDON_PLACEMENT_LABEL: Record<CartPizzaAddon['appliesTo'], string> =
  {
    whole: 'pizza toda',
    flavor1: '1ª metade',
    flavor2: '2ª metade',
  };

/**
 * Linhas de detalhe de um item de pizza (tamanho, 2º sabor, adicionais por
 * metade) — usadas no carrinho e na revisão do pedido, que hoje só mostram
 * `item.name` (já concatenado com o 2º sabor, mas sem tamanho/adicionais).
 */
export function pizzaOrderDetailLines(
  item: Pick<CartItem, 'pizzaSize' | 'selectedPizzaAddons'>,
): string[] {
  if (!item.pizzaSize) return [];
  const lines = [`Tamanho ${item.pizzaSize.name}`];
  for (const addon of item.selectedPizzaAddons ?? []) {
    lines.push(
      `+ ${addon.name} (${PIZZA_ADDON_PLACEMENT_LABEL[addon.appliesTo]})`,
    );
  }
  return lines;
}

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

function pizzaAddonSignature(addons: CartPizzaAddon[] | undefined) {
  return (addons ?? [])
    .map((addon) => `${addon.pizzaAddonId}:${addon.appliesTo}`)
    .sort()
    .join(',');
}

export function isSameCartLine(
  item: Pick<
    CartItem,
    | 'productId'
    | 'selectedAddons'
    | 'note'
    | 'pizzaSize'
    | 'secondaryFlavor'
    | 'selectedPizzaAddons'
  >,
  other: Pick<
    CartItem,
    | 'productId'
    | 'selectedAddons'
    | 'note'
    | 'pizzaSize'
    | 'secondaryFlavor'
    | 'selectedPizzaAddons'
  >,
) {
  return (
    item.productId === other.productId &&
    addonSignature(item.selectedAddons) ===
      addonSignature(other.selectedAddons) &&
    normalizeNote(item.note) === normalizeNote(other.note) &&
    (item.pizzaSize?.id ?? '') === (other.pizzaSize?.id ?? '') &&
    (item.secondaryFlavor?.productId ?? '') ===
      (other.secondaryFlavor?.productId ?? '') &&
    pizzaAddonSignature(item.selectedPizzaAddons) ===
      pizzaAddonSignature(other.selectedPizzaAddons)
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
  pizzaSizeId?: string;
  secondaryProductId?: string;
  pizzaAddons?: Array<{
    pizzaAddonId: string;
    appliesTo: 'whole' | 'flavor1' | 'flavor2';
  }>;
};

function pizzaAddonsSyncSignature(line: Pick<CartSyncLine, 'pizzaAddons'>) {
  return (line.pizzaAddons ?? [])
    .map((a) => `${a.pizzaAddonId}:${a.appliesTo}`)
    .sort()
    .join(',');
}

export function cartItemsToSyncLines(items: CartItem[]): CartSyncLine[] {
  return mergeDuplicateCartItems(items).map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    addOnIds: [...item.selectedAddons.map((addon) => addon.id)].sort(),
    customerNote: item.note?.trim() || undefined,
    pizzaSizeId: item.pizzaSize?.id,
    secondaryProductId: item.secondaryFlavor?.productId,
    pizzaAddons: item.selectedPizzaAddons?.length
      ? item.selectedPizzaAddons.map((a) => ({
          pizzaAddonId: a.pizzaAddonId,
          appliesTo: a.appliesTo,
        }))
      : undefined,
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
    const pizzaAddonsSig = pizzaAddonsSyncSignature(line);
    const existing = merged.find(
      (row) =>
        row.productId === line.productId &&
        row.addOnIds.join(',') === addOnIds.join(',') &&
        (row.customerNote?.trim() || '') === note &&
        (row.pizzaSizeId ?? '') === (line.pizzaSizeId ?? '') &&
        (row.secondaryProductId ?? '') === (line.secondaryProductId ?? '') &&
        pizzaAddonsSyncSignature(row) === pizzaAddonsSig,
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
      pizzaSizeId: line.pizzaSizeId,
      secondaryProductId: line.secondaryProductId,
      pizzaAddons: line.pizzaAddons,
    });
  }
  return merged;
}
