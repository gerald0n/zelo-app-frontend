import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import type { AdminPizzaAddon, AdminPizzaSize } from '@/modules/admin/types';
import type { Database } from '@/types/database';

type PizzaAddonUpdate = Database['public']['Tables']['pizza_addons']['Update'];

/** Upsert dos preços de um sabor por tamanho — usado por `products.ts` ao salvar um produto `pizza_flavor`. */
export async function upsertPizzaSizePrices(
  productId: string,
  sizePrices: Array<{ sizeId: string; priceCents: number }>,
): Promise<Result<true>> {
  const admin = createAdminSupabaseClient();
  await admin.from('pizza_flavor_prices').delete().eq('product_id', productId);
  if (sizePrices.length === 0) return ok(true);

  const { error } = await admin.from('pizza_flavor_prices').insert(
    sizePrices.map((p) => ({
      product_id: productId,
      size_id: p.sizeId,
      price_cents: p.priceCents,
    })),
  );
  if (error) {
    logger.error('Falha ao gravar preços de pizza por tamanho', {
      message: error.message,
    });
    return err(
      'INTERNAL_ERROR',
      'Não foi possível gravar os preços da pizza por tamanho.',
      { cause: error },
    );
  }
  return ok(true);
}

/** Lista de tamanhos, ativos e inativos — a edição fica a cargo do SQL/seed por enquanto (doc 106). */
export async function listAdminPizzaSizes(): Promise<Result<AdminPizzaSize[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('pizza_sizes')
    .select('id, name, diameter_cm, sort_order, is_active')
    .order('sort_order', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar os tamanhos.', {
      cause: error,
    });
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      diameterCm: row.diameter_cm,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    })),
  );
}

export async function listAdminPizzaAddons(): Promise<Result<AdminPizzaAddon[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('pizza_addons')
    .select(
      'id, name, description, price_half_cents, price_full_cents, sort_order, is_active, archived_at',
    )
    .is('archived_at', null)
    .order('sort_order', { ascending: true });

  if (error) {
    return err(
      'INTERNAL_ERROR',
      'Não foi possível carregar os adicionais de pizza.',
      { cause: error },
    );
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      priceHalfCents: row.price_half_cents,
      priceFullCents: row.price_full_cents,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      archivedAt: row.archived_at,
    })),
  );
}

export async function createAdminPizzaAddon(input: {
  name: string;
  description?: string | null;
  priceHalfCents: number;
  priceFullCents: number;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<Result<AdminPizzaAddon>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('pizza_addons')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price_half_cents: input.priceHalfCents,
      price_full_cents: input.priceFullCents,
      sort_order: input.sortOrder ?? 0,
      is_active: input.isActive ?? true,
    })
    .select(
      'id, name, description, price_half_cents, price_full_cents, sort_order, is_active, archived_at',
    )
    .single();

  if (error || !data) {
    return err(
      'INTERNAL_ERROR',
      'Não foi possível criar o adicional de pizza.',
      { cause: error },
    );
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'pizza_addon.create',
    entityType: 'pizza_addon',
    entityId: data.id,
    metadata: {
      name: data.name,
      priceHalfCents: data.price_half_cents,
      priceFullCents: data.price_full_cents,
    },
  });

  return ok({
    id: data.id,
    name: data.name,
    description: data.description,
    priceHalfCents: data.price_half_cents,
    priceFullCents: data.price_full_cents,
    sortOrder: data.sort_order,
    isActive: data.is_active,
    archivedAt: data.archived_at,
  });
}

export async function updateAdminPizzaAddon(options: {
  pizzaAddonId: string;
  name?: string;
  description?: string | null;
  priceHalfCents?: number;
  priceFullCents?: number;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<Result<AdminPizzaAddon>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const patch: PizzaAddonUpdate = {};
  if (typeof options.name === 'string') patch.name = options.name.trim();
  if (options.description !== undefined) {
    patch.description = options.description?.trim() || null;
  }
  if (typeof options.priceHalfCents === 'number') {
    patch.price_half_cents = options.priceHalfCents;
  }
  if (typeof options.priceFullCents === 'number') {
    patch.price_full_cents = options.priceFullCents;
  }
  if (typeof options.sortOrder === 'number') patch.sort_order = options.sortOrder;
  if (typeof options.isActive === 'boolean') patch.is_active = options.isActive;

  if (Object.keys(patch).length === 0) {
    return err('VALIDATION_ERROR', 'Nenhuma alteração informada.');
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('pizza_addons')
    .update(patch)
    .eq('id', options.pizzaAddonId)
    .is('archived_at', null)
    .select(
      'id, name, description, price_half_cents, price_full_cents, sort_order, is_active, archived_at',
    )
    .maybeSingle();

  if (error) {
    return err(
      'INTERNAL_ERROR',
      'Não foi possível atualizar o adicional de pizza.',
      { cause: error },
    );
  }
  if (!data) return err('NOT_FOUND', 'Adicional de pizza não encontrado.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'pizza_addon.update',
    entityType: 'pizza_addon',
    entityId: data.id,
    metadata: patch,
  });

  return ok({
    id: data.id,
    name: data.name,
    description: data.description,
    priceHalfCents: data.price_half_cents,
    priceFullCents: data.price_full_cents,
    sortOrder: data.sort_order,
    isActive: data.is_active,
    archivedAt: data.archived_at,
  });
}

export async function archiveAdminPizzaAddon(
  pizzaAddonId: string,
): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('pizza_addons')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', pizzaAddonId)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return err(
      'INTERNAL_ERROR',
      'Não foi possível arquivar o adicional de pizza.',
      { cause: error },
    );
  }
  if (!data) return err('NOT_FOUND', 'Adicional de pizza não encontrado.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'pizza_addon.archive',
    entityType: 'pizza_addon',
    entityId: pizzaAddonId,
  });

  return ok(true);
}
