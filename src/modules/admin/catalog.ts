import { err, ok, type Result } from '@/lib/errors';
import { productImagePublicUrl, slugify } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import { mapBusinessHour } from '@/modules/catalog/mappers';
import type { CatalogStore } from '@/modules/catalog/types';
import type {
  AdminAddon,
  AdminBlackout,
  AdminBusinessHourInput,
  AdminCategory,
  AdminProduct,
  AdminProductImage,
} from '@/modules/admin/types';
import type { Database } from '@/types/database';

export type {
  AdminAddon,
  AdminBlackout,
  AdminCategory,
  AdminProduct,
} from '@/modules/admin/types';

type CategoryUpdate = Database['public']['Tables']['categories']['Update'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];
type AddonUpdate = Database['public']['Tables']['add_ons']['Update'];
type StoreUpdate = Database['public']['Tables']['stores']['Update'];

const PRODUCT_ADMIN_SELECT = `
  id,
  category_id,
  slug,
  name,
  description,
  price_cents,
  weight_min_grams,
  weight_max_grams,
  is_active,
  is_available,
  archived_at,
  sort_order,
  categories ( name ),
  product_images ( id, storage_path, alt_text, sort_order, is_primary ),
  product_add_ons ( add_on_id )
`;

function mapAdminImages(
  rows: Array<{
    id: string;
    storage_path: string;
    alt_text: string;
    sort_order: number;
    is_primary: boolean;
  }> | null,
): AdminProductImage[] {
  return [...(rows ?? [])]
    .sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        a.sort_order - b.sort_order,
    )
    .map((image) => ({
      id: image.id,
      storagePath: image.storage_path,
      altText: image.alt_text,
      sortOrder: image.sort_order,
      isPrimary: image.is_primary,
      url: productImagePublicUrl(image.storage_path),
    }));
}

function mapAdminProduct(row: {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  weight_min_grams: number | null;
  weight_max_grams: number | null;
  is_active: boolean;
  is_available: boolean;
  archived_at: string | null;
  sort_order: number;
  categories:
    | { name: string }
    | Array<{ name: string }>
    | null;
  product_images: Array<{
    id: string;
    storage_path: string;
    alt_text: string;
    sort_order: number;
    is_primary: boolean;
  }> | null;
  product_add_ons: Array<{ add_on_id: string }> | null;
}): AdminProduct {
  const category = Array.isArray(row.categories)
    ? row.categories[0]
    : row.categories;
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: category?.name ?? 'Sem categoria',
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    weightMinGrams: row.weight_min_grams,
    weightMaxGrams: row.weight_max_grams,
    isActive: row.is_active,
    isAvailable: row.is_available,
    archivedAt: row.archived_at,
    sortOrder: row.sort_order,
    images: mapAdminImages(row.product_images),
    addonIds: (row.product_add_ons ?? []).map((link) => link.add_on_id),
  };
}

export async function listAdminCategories(): Promise<Result<AdminCategory[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('categories')
    .select('id, name, description, sort_order, is_active, archived_at')
    .is('archived_at', null)
    .order('sort_order', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar categorias.', {
      cause: error,
    });
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    })),
  );
}

export async function createAdminCategory(input: {
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<Result<AdminCategory>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('categories')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sort_order: input.sortOrder ?? 0,
      is_active: input.isActive ?? true,
    })
    .select('id, name, description, sort_order, is_active')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar a categoria.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'category.create',
    entityType: 'category',
    entityId: data.id,
    metadata: { name: data.name },
  });

  return ok({
    id: data.id,
    name: data.name,
    description: data.description,
    sortOrder: data.sort_order,
    isActive: data.is_active,
  });
}

export async function updateAdminCategory(options: {
  categoryId: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<Result<AdminCategory>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const patch: CategoryUpdate = {};
  if (typeof options.name === 'string') patch.name = options.name.trim();
  if (options.description !== undefined) {
    patch.description = options.description?.trim() || null;
  }
  if (typeof options.sortOrder === 'number') patch.sort_order = options.sortOrder;
  if (typeof options.isActive === 'boolean') patch.is_active = options.isActive;

  if (Object.keys(patch).length === 0) {
    return err('VALIDATION_ERROR', 'Nenhuma alteração informada.');
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('categories')
    .update(patch)
    .eq('id', options.categoryId)
    .is('archived_at', null)
    .select('id, name, description, sort_order, is_active')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar a categoria.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Categoria não encontrada.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'category.update',
    entityType: 'category',
    entityId: data.id,
    metadata: patch,
  });

  return ok({
    id: data.id,
    name: data.name,
    description: data.description,
    sortOrder: data.sort_order,
    isActive: data.is_active,
  });
}

export async function archiveAdminCategory(
  categoryId: string,
): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('categories')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', categoryId)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível arquivar a categoria.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Categoria não encontrada.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'category.archive',
    entityType: 'category',
    entityId: categoryId,
  });

  return ok(true);
}

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

export async function updateAdminProduct(options: {
  productId: string;
  categoryId?: string;
  name?: string;
  description?: string | null;
  priceCents?: number;
  slug?: string;
  weightMinGrams?: number | null;
  weightMaxGrams?: number | null;
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
    patch.slug = await ensureUniqueSlug(
      slugify(options.slug),
      options.productId,
    );
  }
  if (options.weightMinGrams !== undefined) {
    patch.weight_min_grams = options.weightMinGrams;
  }
  if (options.weightMaxGrams !== undefined) {
    patch.weight_max_grams = options.weightMaxGrams;
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

export async function uploadProductImage(options: {
  productId: string;
  file: File;
  altText: string;
  isPrimary?: boolean;
}): Promise<Result<AdminProductImage>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(options.file.type)) {
    return err('VALIDATION_ERROR', 'Use imagem JPEG, PNG ou WebP.');
  }
  if (options.file.size > 5 * 1024 * 1024) {
    return err('VALIDATION_ERROR', 'A imagem deve ter no máximo 5 MB.');
  }

  const product = await getAdminProduct(options.productId);
  if (!product.ok) return product;

  const admin = createAdminSupabaseClient();
  const extension =
    options.file.type === 'image/png'
      ? 'png'
      : options.file.type === 'image/webp'
        ? 'webp'
        : 'jpg';
  const storagePath = `${options.productId}/${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await options.file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from('product-images')
    .upload(storagePath, buffer, {
      contentType: options.file.type,
      upsert: false,
    });

  if (uploadError) {
    return err('INTERNAL_ERROR', 'Não foi possível enviar a imagem.', {
      cause: uploadError,
    });
  }

  const makePrimary =
    options.isPrimary === true || product.data.images.length === 0;

  if (makePrimary) {
    await admin
      .from('product_images')
      .update({ is_primary: false })
      .eq('product_id', options.productId);
  }

  const nextOrder =
    product.data.images.reduce(
      (max, image) => Math.max(max, image.sortOrder),
      -1,
    ) + 1;

  const { data, error } = await admin
    .from('product_images')
    .insert({
      product_id: options.productId,
      storage_path: storagePath,
      alt_text: options.altText.trim() || product.data.name,
      sort_order: nextOrder,
      is_primary: makePrimary,
    })
    .select('id, storage_path, alt_text, sort_order, is_primary')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível salvar a imagem.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.image.upload',
    entityType: 'product',
    entityId: options.productId,
    metadata: { imageId: data.id },
  });

  return ok({
    id: data.id,
    storagePath: data.storage_path,
    altText: data.alt_text,
    sortOrder: data.sort_order,
    isPrimary: data.is_primary,
    url: productImagePublicUrl(data.storage_path),
  });
}

export async function deleteProductImage(options: {
  productId: string;
  imageId: string;
}): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('product_images')
    .select('id, storage_path, is_primary')
    .eq('id', options.imageId)
    .eq('product_id', options.productId)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover a imagem.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Imagem não encontrada.');

  await admin.storage.from('product-images').remove([data.storage_path]);
  await admin.from('product_images').delete().eq('id', data.id);

  if (data.is_primary) {
    const { data: next } = await admin
      .from('product_images')
      .select('id')
      .eq('product_id', options.productId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await admin
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', next.id);
    }
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product.image.delete',
    entityType: 'product',
    entityId: options.productId,
    metadata: { imageId: options.imageId },
  });

  return ok(true);
}

export async function listAdminAddons(): Promise<Result<AdminAddon[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('add_ons')
    .select(
      'id, name, description, price_cents, is_active, is_available, archived_at',
    )
    .is('archived_at', null)
    .order('name', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar adicionais.', {
      cause: error,
    });
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      priceCents: row.price_cents,
      isActive: row.is_active,
      isAvailable: row.is_available,
    })),
  );
}

export async function createAdminAddon(input: {
  name: string;
  description?: string | null;
  priceCents: number;
  isActive?: boolean;
  isAvailable?: boolean;
}): Promise<Result<AdminAddon>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('add_ons')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price_cents: input.priceCents,
      is_active: input.isActive ?? true,
      is_available: input.isAvailable ?? true,
    })
    .select('id, name, description, price_cents, is_active, is_available')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar o adicional.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'addon.create',
    entityType: 'addon',
    entityId: data.id,
    metadata: { name: data.name, priceCents: data.price_cents },
  });

  return ok({
    id: data.id,
    name: data.name,
    description: data.description,
    priceCents: data.price_cents,
    isActive: data.is_active,
    isAvailable: data.is_available,
  });
}

export async function updateAdminAddon(options: {
  addonId: string;
  name?: string;
  description?: string | null;
  priceCents?: number;
  isActive?: boolean;
  isAvailable?: boolean;
}): Promise<Result<AdminAddon>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const patch: AddonUpdate = {};
  if (typeof options.name === 'string') patch.name = options.name.trim();
  if (options.description !== undefined) {
    patch.description = options.description?.trim() || null;
  }
  if (typeof options.priceCents === 'number') {
    patch.price_cents = options.priceCents;
  }
  if (typeof options.isActive === 'boolean') patch.is_active = options.isActive;
  if (typeof options.isAvailable === 'boolean') {
    patch.is_available = options.isAvailable;
  }

  if (Object.keys(patch).length === 0) {
    return err('VALIDATION_ERROR', 'Nenhuma alteração informada.');
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('add_ons')
    .update(patch)
    .eq('id', options.addonId)
    .is('archived_at', null)
    .select('id, name, description, price_cents, is_active, is_available')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar o adicional.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Adicional não encontrado.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'addon.update',
    entityType: 'addon',
    entityId: data.id,
    metadata: patch,
  });

  return ok({
    id: data.id,
    name: data.name,
    description: data.description,
    priceCents: data.price_cents,
    isActive: data.is_active,
    isAvailable: data.is_available,
  });
}

export async function archiveAdminAddon(
  addonId: string,
): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('add_ons')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', addonId)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível arquivar o adicional.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Adicional não encontrado.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'addon.archive',
    entityType: 'addon',
    entityId: addonId,
  });

  return ok(true);
}

export async function getAdminStore(): Promise<Result<CatalogStore | null>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  return getPublicStore();
}

export async function updateAdminStore(input: {
  name?: string;
  phoneE164?: string;
  whatsappE164?: string;
  pixCopyPaste?: string | null;
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string | null;
  latitude?: number;
  longitude?: number;
  freeDeliveryRadiusMeters?: number;
  fixedDeliveryFeeCents?: number;
  acceptingOrders?: boolean;
  acceptsPix?: boolean;
  acceptsCash?: boolean;
  acceptsCard?: boolean;
}): Promise<Result<CatalogStore>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const current = await getPublicStore();
  if (!current.ok) return current;
  if (!current.data) return err('NOT_FOUND', 'Loja não encontrada.');

  const nextPayments = {
    pix:
      typeof input.acceptsPix === 'boolean'
        ? input.acceptsPix
        : current.data.acceptsPayments.pix,
    cash:
      typeof input.acceptsCash === 'boolean'
        ? input.acceptsCash
        : current.data.acceptsPayments.cash,
    card:
      typeof input.acceptsCard === 'boolean'
        ? input.acceptsCard
        : current.data.acceptsPayments.card,
  };
  if (!nextPayments.pix && !nextPayments.cash && !nextPayments.card) {
    return err(
      'VALIDATION_ERROR',
      'Mantenha ao menos uma forma de pagamento habilitada.',
    );
  }

  const patch: StoreUpdate = {};
  if (typeof input.name === 'string') patch.name = input.name.trim();
  if (typeof input.phoneE164 === 'string') {
    patch.phone_e164 = input.phoneE164.trim();
  }
  if (typeof input.whatsappE164 === 'string') {
    patch.whatsapp_e164 = input.whatsappE164.trim();
  }
  if (input.pixCopyPaste !== undefined) {
    patch.pix_copy_paste = input.pixCopyPaste?.trim() || null;
  }
  if (typeof input.addressLine === 'string') {
    patch.address_line = input.addressLine.trim();
  }
  if (typeof input.city === 'string') patch.city = input.city.trim();
  if (typeof input.state === 'string') patch.state = input.state.trim();
  if (input.postalCode !== undefined) {
    patch.postal_code = input.postalCode?.trim() || null;
  }
  if (typeof input.latitude === 'number') patch.latitude = input.latitude;
  if (typeof input.longitude === 'number') patch.longitude = input.longitude;
  if (typeof input.freeDeliveryRadiusMeters === 'number') {
    patch.free_delivery_radius_meters = input.freeDeliveryRadiusMeters;
  }
  if (typeof input.fixedDeliveryFeeCents === 'number') {
    patch.fixed_delivery_fee_cents = input.fixedDeliveryFeeCents;
  }
  if (typeof input.acceptingOrders === 'boolean') {
    patch.is_open_override = input.acceptingOrders ? null : false;
  }
  if (typeof input.acceptsPix === 'boolean') {
    patch.accepts_pix = input.acceptsPix;
  }
  if (typeof input.acceptsCash === 'boolean') {
    patch.accepts_cash = input.acceptsCash;
  }
  if (typeof input.acceptsCard === 'boolean') {
    patch.accepts_card = input.acceptsCard;
  }

  if (Object.keys(patch).length === 0) {
    return err('VALIDATION_ERROR', 'Nenhuma alteração informada.');
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('stores')
    .update(patch)
    .eq('id', current.data.id);

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar a loja.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'store.update',
    entityType: 'store',
    entityId: current.data.id,
    metadata: patch,
  });

  const refreshed = await getPublicStore();
  if (!refreshed.ok) return refreshed;
  if (!refreshed.data) return err('NOT_FOUND', 'Loja não encontrada.');
  return ok(refreshed.data);
}

export async function setStoreAcceptingOrders(
  accepting: boolean,
): Promise<Result<{ acceptingOrders: boolean }>> {
  const result = await updateAdminStore({ acceptingOrders: accepting });
  if (!result.ok) return result;
  return ok({ acceptingOrders: accepting });
}

export async function getStoreAcceptingOrders(): Promise<
  Result<{ acceptingOrders: boolean }>
> {
  const store = await getAdminStore();
  if (!store.ok) return store;
  if (!store.data) return err('NOT_FOUND', 'Loja não encontrada.');
  return ok({
    acceptingOrders: store.data.isOpenOverride !== false,
  });
}

export async function listAdminBusinessHours(): Promise<
  Result<AdminBusinessHourInput[]>
> {
  const store = await getAdminStore();
  if (!store.ok) return store;
  if (!store.data) return err('NOT_FOUND', 'Loja não encontrada.');
  return ok(store.data.businessHours);
}

export async function replaceAdminBusinessHours(
  hours: AdminBusinessHourInput[],
): Promise<Result<AdminBusinessHourInput[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (hours.length !== 7) {
    return err('VALIDATION_ERROR', 'Informe os 7 dias da semana.');
  }

  const weekdays = new Set(hours.map((hour) => hour.weekday));
  if (weekdays.size !== 7) {
    return err('VALIDATION_ERROR', 'Cada dia da semana deve aparecer uma vez.');
  }

  for (const hour of hours) {
    if (hour.weekday < 0 || hour.weekday > 6) {
      return err('VALIDATION_ERROR', 'Dia da semana inválido.');
    }
    if (
      !hour.isClosed &&
      (!hour.opensAt || !hour.closesAt || hour.opensAt >= hour.closesAt)
    ) {
      return err(
        'VALIDATION_ERROR',
        'Horário inválido: abertura deve ser antes do fechamento.',
      );
    }
  }

  const storeResult = await getPublicStore();
  if (!storeResult.ok) return storeResult;
  if (!storeResult.data) return err('NOT_FOUND', 'Loja não encontrada.');

  const admin = createAdminSupabaseClient();
  const rows = hours.map((hour) => ({
    store_id: storeResult.data!.id,
    weekday: hour.weekday,
    opens_at: hour.isClosed ? null : hour.opensAt,
    closes_at: hour.isClosed ? null : hour.closesAt,
    is_closed: hour.isClosed,
    delivery_enabled: hour.deliveryEnabled,
    pickup_enabled: hour.pickupEnabled,
  }));

  const { error } = await admin.from('store_business_hours').upsert(rows, {
    onConflict: 'store_id,weekday',
  });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível salvar os horários.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'store.business_hours.update',
    entityType: 'store',
    entityId: storeResult.data.id,
  });

  const { data: refreshed, error: readError } = await admin
    .from('store_business_hours')
    .select('*')
    .eq('store_id', storeResult.data.id)
    .order('weekday', { ascending: true });

  if (readError) {
    return err('INTERNAL_ERROR', 'Não foi possível ler os horários.', {
      cause: readError,
    });
  }

  return ok((refreshed ?? []).map(mapBusinessHour));
}

export async function listAdminBlackouts(): Promise<Result<AdminBlackout[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const store = await getPublicStore();
  if (!store.ok) return store;
  if (!store.data) return err('NOT_FOUND', 'Loja não encontrada.');

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('store_blackout_periods')
    .select('id, starts_at, ends_at, reason')
    .eq('store_id', store.data.id)
    .order('starts_at', { ascending: true });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar bloqueios.', {
      cause: error,
    });
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      reason: row.reason,
    })),
  );
}

export async function createAdminBlackout(input: {
  startsAt: string;
  endsAt: string;
  reason?: string | null;
}): Promise<Result<AdminBlackout>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    return err(
      'VALIDATION_ERROR',
      'O fim do bloqueio deve ser após o início.',
    );
  }

  const store = await getPublicStore();
  if (!store.ok) return store;
  if (!store.data) return err('NOT_FOUND', 'Loja não encontrada.');

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('store_blackout_periods')
    .insert({
      store_id: store.data.id,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      reason: input.reason?.trim() || null,
    })
    .select('id, starts_at, ends_at, reason')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar o bloqueio.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'store.blackout.create',
    entityType: 'store_blackout',
    entityId: data.id,
  });

  return ok({
    id: data.id,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    reason: data.reason,
  });
}

export async function deleteAdminBlackout(
  blackoutId: string,
): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('store_blackout_periods')
    .delete()
    .eq('id', blackoutId)
    .select('id')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover o bloqueio.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Bloqueio não encontrado.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'store.blackout.delete',
    entityType: 'store_blackout',
    entityId: blackoutId,
  });

  return ok(true);
}
