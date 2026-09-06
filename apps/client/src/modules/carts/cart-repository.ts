import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { CART_TTL_MS, type CartSyncLine } from '@/modules/carts/types';

function expiresAtFromNow() {
  return new Date(Date.now() + CART_TTL_MS).toISOString();
}

/** Id do carrinho do cliente, ou `null` se ele ainda não tem um. */
export async function findCustomerCartId(
  customerId: string,
): Promise<Result<string | null>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('carts')
    .select('id')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) {
    logger.error('Falha ao localizar carrinho do cliente', {
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível ler o carrinho.', {
      cause: error,
    });
  }

  return ok(data?.id ?? null);
}

export async function getOrCreateCustomerCart(
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

export async function loadStoredLines(
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

export async function replaceCartLines(
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

/** Marca o carrinho como expirado agora (usado ao esvaziá-lo). */
export async function markCartExpired(cartId: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin
    .from('carts')
    .update({
      expires_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', cartId);
}
