import 'server-only';

import { z } from 'zod';
import { ok, type Result } from '@/lib/errors';
import {
  findCustomerCartId,
  getOrCreateCustomerCart,
  loadStoredLines,
  markCartExpired,
  replaceCartLines,
} from '@/modules/carts/cart-repository';
import { listPublicProducts } from '@/modules/catalog/catalog-repository';
import type { CatalogAddon, CatalogProduct } from '@/modules/catalog/types';
import {
  mergeCartSyncLines,
  unitPriceWithAddons,
  type CartItem,
  type CartSyncLine,
} from '@/modules/carts/types';
import {
  ensureCustomerRecord,
  resolveCustomerForCheckout,
} from '@/modules/orders/customer';

export const cartSyncLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(99),
  addOnIds: z.array(z.string().uuid()).max(20).default([]),
  customerNote: z.string().trim().max(500).optional(),
});

export const cartSyncBodySchema = z.object({
  items: z.array(cartSyncLineSchema).max(50),
});

function hydrateLines(
  lines: CartSyncLine[],
  products: CatalogProduct[],
  itemIds?: string[],
): CartItem[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const items: CartItem[] = [];

  lines.forEach((line, index) => {
    const product = byId.get(line.productId);
    if (!product) return;

    const selectedAddons: CatalogAddon[] = [];
    for (const addonId of line.addOnIds) {
      const addon = product.addons.find(
        (candidate) => candidate.id === addonId,
      );
      if (addon) selectedAddons.push(addon);
    }

    const note = line.customerNote?.trim() || undefined;
    items.push({
      id: itemIds?.[index] ?? `${product.id}_${index}`,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      basePrice: product.price,
      price: unitPriceWithAddons(product.price, selectedAddons),
      quantity: line.quantity,
      selectedAddons,
      note,
      image: product.image,
    });
  });

  return items;
}

async function requireCustomerId(): Promise<Result<string>> {
  const identity = await resolveCustomerForCheckout();
  if (!identity.ok) return identity;
  const ensured = await ensureCustomerRecord(identity.data);
  if (!ensured.ok) return ensured;
  return ok(ensured.data.id);
}

async function persistAndHydrate(
  customerId: string,
  lines: CartSyncLine[],
): Promise<Result<{ items: CartItem[] }>> {
  const catalog = await listPublicProducts();
  if (!catalog.ok) return catalog;

  const allowed: CartSyncLine[] = [];
  for (const line of lines) {
    const product = catalog.data.find(
      (candidate) => candidate.id === line.productId,
    );
    if (!product) continue;
    allowed.push({
      productId: line.productId,
      quantity: Math.min(99, line.quantity),
      addOnIds: line.addOnIds.filter((addonId) =>
        product.addons.some((addon) => addon.id === addonId),
      ),
      customerNote: line.customerNote,
    });
  }

  const cart = await getOrCreateCustomerCart(customerId);
  if (!cart.ok) return cart;

  const saved = await replaceCartLines(cart.data.id, allowed);
  if (!saved.ok) return saved;

  return ok({
    items: hydrateLines(allowed, catalog.data, saved.data),
  });
}

export async function getCustomerCart(): Promise<
  Result<{ items: CartItem[] }>
> {
  const customerId = await requireCustomerId();
  if (!customerId.ok) return customerId;

  const cart = await getOrCreateCustomerCart(customerId.data);
  if (!cart.ok) return cart;

  const stored = await loadStoredLines(cart.data.id);
  if (!stored.ok) return stored;

  const catalog = await listPublicProducts();
  if (!catalog.ok) return catalog;

  return ok({ items: hydrateLines(stored.data, catalog.data) });
}

export async function replaceCustomerCart(
  lines: CartSyncLine[],
): Promise<Result<{ items: CartItem[] }>> {
  const customerId = await requireCustomerId();
  if (!customerId.ok) return customerId;
  return persistAndHydrate(customerId.data, lines);
}

function lineKey(line: CartSyncLine): string {
  return `${line.productId}|${[...line.addOnIds].sort().join(',')}|${
    line.customerNote?.trim() || ''
  }`;
}

/**
 * O carrinho local não acrescenta nada ao que já está no servidor quando toda
 * linha local já existe lá com quantidade igual ou maior. É o caso de um
 * carrinho já reconciliado sendo reenviado (recarga da página, reabertura do
 * PWA) — somar de novo dobraria as quantidades.
 */
function localAddsNothing(
  localLines: CartSyncLine[],
  storedLines: CartSyncLine[],
): boolean {
  if (localLines.length === 0) return true;
  const storedByKey = new Map(
    storedLines.map((line) => [lineKey(line), line.quantity]),
  );
  return localLines.every((line) => {
    const storedQty = storedByKey.get(lineKey(line));
    return storedQty !== undefined && storedQty >= line.quantity;
  });
}

export async function reconcileCustomerCart(
  localLines: CartSyncLine[],
): Promise<Result<{ items: CartItem[] }>> {
  const customerId = await requireCustomerId();
  if (!customerId.ok) return customerId;

  const cart = await getOrCreateCustomerCart(customerId.data);
  if (!cart.ok) return cart;

  const stored = await loadStoredLines(cart.data.id);
  if (!stored.ok) return stored;

  const merged = localAddsNothing(localLines, stored.data)
    ? stored.data
    : mergeCartSyncLines(localLines, stored.data);
  return persistAndHydrate(customerId.data, merged);
}

export async function clearCustomerCart(
  customerId?: string,
): Promise<Result<true>> {
  const resolved = customerId ? ok(customerId) : await requireCustomerId();
  if (!resolved.ok) return resolved;

  const cartId = await findCustomerCartId(resolved.data);
  if (!cartId.ok) return cartId;
  if (!cartId.data) return ok(true);

  const cleared = await replaceCartLines(cartId.data, []);
  if (!cleared.ok) return cleared;

  await markCartExpired(cartId.data);

  return ok(true);
}

export async function getCustomerCartId(
  customerId: string,
): Promise<string | null> {
  const found = await findCustomerCartId(customerId);
  return found.ok ? found.data : null;
}
