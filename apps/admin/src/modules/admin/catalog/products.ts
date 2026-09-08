import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { slugify } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import {
  mapAdminProduct,
  PRODUCT_ADMIN_SELECT,
} from '@/modules/admin/catalog/product-mappers';
import type { AdminProduct } from '@/modules/admin/types';
import type { Database } from '@/types/database';

type ProductUpdate = Database['public']['Tables']['products']['Update'];

export async function listAdminProducts(): Promise<Result<AdminProduct[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('products')
    .select(PRODUCT_ADMIN_SELECT)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });

  if (error) {
    logger.error('Falha ao listar produtos admin', { message: error.message });
    return err('INTERNAL_ERROR', 'Não foi possível carregar o catálogo.', {
      cause: error,
    });
  }

  return ok((data ?? []).map(mapAdminProduct));
}

export async function getAdminProduct(
  productId: string,
): Promise<Result<AdminProduct>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('products')
    .select(PRODUCT_ADMIN_SELECT)
    .eq('id', productId)
    .is('archived_at', null)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar o produto.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Produto não encontrado.');
  return ok(mapAdminProduct(data));
}

async function ensureUniqueSlug(
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  const admin = createAdminSupabaseClient();
  const candidate = baseSlug || 'produto';
  let suffix = 0;

  for (;;) {
    const slug = suffix === 0 ? candidate : `${candidate}-${suffix}`;
    let query = admin.from('products').select('id').eq('slug', slug).limit(1);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return slug;
    suffix += 1;
  }
}

export async function createAdminProduct(input: {
  categoryId: string;
  name: string;
  description?: string | null;
  priceCents: number;
  slug?: string;
  weightMinGrams?: number | null;
  weightMaxGrams?: number | null;
  stockQuantity?: number | null;
  sortOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  addonIds?: string[];
}): Promise<Result<AdminProduct>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const slug = await ensureUniqueSlug(slugify(input.slug || input.name));

  const { data, error } = await admin
    .from('products')
    .insert({
      category_id: input.categoryId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      price_cents: input.priceCents,
      weight_min_grams: input.weightMinGrams ?? null,
      weight_max_grams: input.weightMaxGrams ?? null,
      stock_quantity: input.stockQuantity ?? null,
      sort_order: input.sortOrder ?? 0,
      is_active: input.isActive ?? true,
      is_available: input.isAvailable ?? true,
    })
    .select('id')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar o produto.', {
      cause: error,
    });
  }

  if (input.addonIds?.length) {
    const links = input.addonIds.map((addOnId, index) => ({
      product_id: data.id,
      add_on_id: addOnId,
      sort_order: index,
    }));
    const { error: linkError } = await admin
      .from('product_add_ons')
      .insert(links);
    if (linkError) {
      logger.error('Falha ao vincular adicionais', {
        message: linkError.message,
      });
    }
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.create',
    entityType: 'product',
    entityId: data.id,
    metadata: { name: input.name, priceCents: input.priceCents },
  });

  return getAdminProduct(data.id);
}

/**
 * Cria um novo produto a partir de um existente — nome "… (cópia)", mesma
 * categoria, preço, peso, estoque e adicionais. **Não** copia as imagens
 * (evita duplicar arquivos no storage); a cópia nasce sem foto. Nasce
 * pausada (`is_available = false`) pra não aparecer no catálogo antes de o
 * admin revisar. Fica logo depois do original na ordenação.
 */
export async function duplicateAdminProduct(
  productId: string,
): Promise<Result<AdminProduct>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const source = await getAdminProduct(productId);
  if (!source.ok) return source;

  const created = await createAdminProduct({
    categoryId: source.data.categoryId,
    name: `${source.data.name} (cópia)`,
    description: source.data.description,
    priceCents: source.data.priceCents,
    weightMinGrams: source.data.weightMinGrams,
    weightMaxGrams: source.data.weightMaxGrams,
    stockQuantity: source.data.stockQuantity,
    sortOrder: source.data.sortOrder + 1,
    isActive: source.data.isActive,
    isAvailable: false,
    addonIds: source.data.addonIds,
  });
  if (!created.ok) return created;

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.duplicate',
    entityType: 'product',
    entityId: created.data.id,
    metadata: { sourceId: productId },
  });

  return created;
}

export async function updateAdminProduct(options: {
  productId: string;
  categoryId?: string;
  name?: string;
  description?: string | null;
  priceCents?: number;
  slug?: string;
  weightMinGrams?: number | null;
  weightMaxGrams?: number | null;
  stockQuantity?: number | null;
  sortOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  addonIds?: string[];
}): Promise<Result<AdminProduct>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const patch: ProductUpdate = {};
  if (typeof options.categoryId === 'string') {
    patch.category_id = options.categoryId;
  }
  if (typeof options.name === 'string') patch.name = options.name.trim();
  if (options.description !== undefined) {
    patch.description = options.description?.trim() || null;
  }
  if (typeof options.priceCents === 'number') {
    patch.price_cents = options.priceCents;
  }
  if (typeof options.slug === 'string') {
    patch.slug = await ensureUniqueSlug(slugify(options.slug), options.productId);
  }
  if (options.weightMinGrams !== undefined) {
    patch.weight_min_grams = options.weightMinGrams;
  }
  if (options.weightMaxGrams !== undefined) {
    patch.weight_max_grams = options.weightMaxGrams;
  }
  if (options.stockQuantity !== undefined) {
    patch.stock_quantity = options.stockQuantity;
  }
  if (typeof options.sortOrder === 'number') {
    patch.sort_order = options.sortOrder;
  }
  if (typeof options.isActive === 'boolean') patch.is_active = options.isActive;
  if (typeof options.isAvailable === 'boolean') {
    patch.is_available = options.isAvailable;
  }

  const admin = createAdminSupabaseClient();

  if (Object.keys(patch).length > 0) {
    const { error } = await admin
      .from('products')
      .update(patch)
      .eq('id', options.productId)
      .is('archived_at', null);
    if (error) {
      return err('INTERNAL_ERROR', 'Não foi possível atualizar o produto.', {
        cause: error,
      });
    }
  }

  if (options.addonIds) {
    await admin
      .from('product_add_ons')
      .delete()
      .eq('product_id', options.productId);
    if (options.addonIds.length > 0) {
      const { error: linkError } = await admin.from('product_add_ons').insert(
        options.addonIds.map((addOnId, index) => ({
          product_id: options.productId,
          add_on_id: addOnId,
          sort_order: index,
        })),
      );
      if (linkError) {
        return err('INTERNAL_ERROR', 'Não foi possível atualizar adicionais.', {
          cause: linkError,
        });
      }
    }
  }

  if (Object.keys(patch).length === 0 && !options.addonIds) {
    return err('VALIDATION_ERROR', 'Nenhuma alteração informada.');
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.update',
    entityType: 'product',
    entityId: options.productId,
    metadata: {
      ...patch,
      addonIds: options.addonIds,
      priceChanged: typeof options.priceCents === 'number',
      availabilityChanged: typeof options.isAvailable === 'boolean',
    },
  });

  return getAdminProduct(options.productId);
}

export async function setProductAvailability(options: {
  productId: string;
  isAvailable: boolean;
}): Promise<Result<AdminProduct>> {
  return updateAdminProduct({
    productId: options.productId,
    isAvailable: options.isAvailable,
  });
}

export async function archiveAdminProduct(
  productId: string,
): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('products')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', productId)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível arquivar o produto.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Produto não encontrado.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.archive',
    entityType: 'product',
    entityId: productId,
  });

  return ok(true);
}
