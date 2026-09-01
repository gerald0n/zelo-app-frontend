import 'server-only';

import { z } from 'zod';
import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { listPublicProducts } from '@/modules/catalog/catalog-repository';
import type { CatalogAddon, CatalogProduct } from '@/modules/catalog/types';
import {
  CART_TTL_MS,
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

function expiresAtFromNow() {
  return new Date(Date.now() + CART_TTL_MS).toISOString();
}

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

async function getOrCreateCustomerCart(
  customerId: string,
): Promise<Result<{ id: string }>> {
  const admin = createAdminSupabaseClient();
  const existing = await admin
    .from('carts')
    .select('id')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (existing.error) {
    logger.error('Falha ao ler carrinho do cliente', {
      message: existing.error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível ler o carrinho.', {
      cause: existing.error,
    });
  }

  if (existing.data) {
    const touched = await admin
      .from('carts')
      .update({
        expires_at: expiresAtFromNow(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', existing.data.id);

    if (touched.error) {
      logger.error('Falha ao renovar carrinho', {
        message: touched.error.message,
      });
    }

    return ok({ id: existing.data.id });
  }

  const inserted = await admin
    .from('carts')
    .insert({
      customer_id: customerId,
      expires_at: expiresAtFromNow(),
      last_activity_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (inserted.error?.code === '23505') {
    const retry = await admin
      .from('carts')
      .select('id')
      .eq('customer_id', customerId)
      .maybeSingle();
    if (retry.data) return ok({ id: retry.data.id });
  }

  if (inserted.error || !inserted.data) {
    logger.error('Falha ao criar carrinho do cliente', {
      message: inserted.error?.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível criar o carrinho.', {
      cause: inserted.error,
    });
  }

  return ok({ id: inserted.data.id });
}

async function loadStoredLines(
  cartId: string,
): Promise<Result<CartSyncLine[]>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('cart_items')
    .select(
      'id, product_id, quantity, customer_note, cart_item_add_ons ( add_on_id )',
    )
    .eq('cart_id', cartId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Falha ao ler itens do carrinho', { message: error.message });
    return err('INTERNAL_ERROR', 'Não foi possível ler o carrinho.', {
      cause: error,
    });
  }

  const rows = (data ?? []) as Array<{
    product_id: string;
    quantity: number;
    customer_note: string | null;
    cart_item_add_ons: Array<{ add_on_id: string }> | null;
  }>;

  const lines: CartSyncLine[] = rows.map((row) => ({
    productId: row.product_id,
    quantity: row.quantity,
    addOnIds: (row.cart_item_add_ons ?? [])
      .map((link) => link.add_on_id)
      .sort(),
    customerNote: row.customer_note?.trim() || undefined,
  }));

  return ok(lines);
}

async function replaceCartLines(
  cartId: string,
  lines: CartSyncLine[],
): Promise<Result<string[]>> {
  const admin = createAdminSupabaseClient();
  const deleted = await admin.from('cart_items').delete().eq('cart_id', cartId);
  if (deleted.error) {
    logger.error('Falha ao limpar itens do carrinho', {
      message: deleted.error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível atualizar o carrinho.', {
      cause: deleted.error,
    });
  }

  const itemIds: string[] = [];
  for (const line of lines) {
    const inserted = await admin
      .from('cart_items')
      .insert({
        cart_id: cartId,
        product_id: line.productId,
        quantity: line.quantity,
        customer_note: line.customerNote ?? null,
      })
      .select('id')
      .single();

    if (inserted.error || !inserted.data) {
      logger.error('Falha ao gravar item do carrinho', {
        message: inserted.error?.message,
      });
      return err('INTERNAL_ERROR', 'Não foi possível atualizar o carrinho.', {
        cause: inserted.error,
      });
    }

    itemIds.push(inserted.data.id);

    if (line.addOnIds.length === 0) continue;

    const addOns = await admin.from('cart_item_add_ons').insert(
      line.addOnIds.map((addOnId) => ({
        cart_item_id: inserted.data.id,
        add_on_id: addOnId,
        quantity: 1,
      })),
    );

    if (addOns.error) {
      logger.error('Falha ao gravar adicionais do carrinho', {
        message: addOns.error.message,
      });
      return err('INTERNAL_ERROR', 'Não foi possível atualizar o carrinho.', {
        cause: addOns.error,
      });
    }
  }

  return ok(itemIds);
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

  const admin = createAdminSupabaseClient();
  const existing = await admin
    .from('carts')
    .select('id')
    .eq('customer_id', resolved.data)
    .maybeSingle();

  if (existing.error) {
    logger.error('Falha ao localizar carrinho para limpar', {
      message: existing.error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível limpar o carrinho.', {
      cause: existing.error,
    });
  }

  if (!existing.data) return ok(true);

  const cleared = await replaceCartLines(existing.data.id, []);
  if (!cleared.ok) return cleared;

  await admin
    .from('carts')
    .update({
      expires_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', existing.data.id);

  return ok(true);
}

export async function getCustomerCartId(
  customerId: string,
): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from('carts')
    .select('id')
    .eq('customer_id', customerId)
    .maybeSingle();
  return data?.id ?? null;
}
