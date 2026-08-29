import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hasSupabasePublicConfig } from '@/config/env';
import { mapCategory, mapProduct, mapStore } from '@/modules/catalog/mappers';
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogStore,
} from '@/modules/catalog/types';

const PRODUCT_SELECT = `
  *,
  product_images (*),
  product_add_ons (
    sort_order,
    add_ons (*)
  )
`;

function notConfigured<T>(): Result<T> {
  return err(
    'INTEGRATION_UNAVAILABLE',
    'Catálogo indisponível: configure o Supabase no ambiente.',
  );
}

export async function getPublicStore(): Promise<Result<CatalogStore | null>> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = await createServerSupabaseClient();
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (storeError) {
      logger.error('Falha ao ler loja', { message: storeError.message });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar a loja.',
        {
          cause: storeError,
        },
      );
    }

    if (!store) return ok(null);

    const [{ data: hours, error: hoursError }, { data: blackouts, error: blackoutsError }] =
      await Promise.all([
        supabase
          .from('store_business_hours')
          .select('*')
          .eq('store_id', store.id)
          .order('weekday', { ascending: true }),
        supabase
          .from('store_blackout_periods')
          .select('id, starts_at, ends_at, reason')
          .eq('store_id', store.id)
          .order('starts_at', { ascending: true }),
      ]);

    if (hoursError) {
      logger.error('Falha ao ler horários', { message: hoursError.message });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar os horários.',
        { cause: hoursError },
      );
    }

    if (blackoutsError) {
      logger.error('Falha ao ler bloqueios', {
        message: blackoutsError.message,
      });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar os períodos bloqueados.',
        { cause: blackoutsError },
      );
    }

    return ok(mapStore(store, hours ?? [], blackouts ?? []));
  } catch (cause) {
    logger.error('Erro inesperado ao ler loja', {});
    return err('INTERNAL_ERROR', 'Erro ao carregar a loja.', { cause });
  }
}

export async function listPublicCategories(): Promise<
  Result<CatalogCategory[]>
> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .is('archived_at', null)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Falha ao ler categorias', { message: error.message });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar as categorias.',
        { cause: error },
      );
    }

    return ok((data ?? []).map(mapCategory));
  } catch (cause) {
    return err('INTERNAL_ERROR', 'Erro ao carregar categorias.', { cause });
  }
}

export async function listPublicProducts(): Promise<Result<CatalogProduct[]>> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('is_active', true)
      .is('archived_at', null)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Falha ao ler produtos', { message: error.message });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar o cardápio.',
        { cause: error },
      );
    }

    return ok((data ?? []).map(mapProduct));
  } catch (cause) {
    return err('INTERNAL_ERROR', 'Erro ao carregar o cardápio.', { cause });
  }
}

export async function getPublicProductBySlugOrId(
  slugOrId: string,
): Promise<Result<CatalogProduct | null>> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = await createServerSupabaseClient();

    const bySlug = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('slug', slugOrId)
      .eq('is_active', true)
      .is('archived_at', null)
      .maybeSingle();

    if (bySlug.error) {
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar o produto.',
        { cause: bySlug.error },
      );
    }

    if (bySlug.data) return ok(mapProduct(bySlug.data));

    const byId = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', slugOrId)
      .eq('is_active', true)
      .is('archived_at', null)
      .maybeSingle();

    if (byId.error) {
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar o produto.',
        { cause: byId.error },
      );
    }

    return ok(byId.data ? mapProduct(byId.data) : null);
  } catch (cause) {
    return err('INTERNAL_ERROR', 'Erro ao carregar o produto.', { cause });
  }
}

export async function searchPublicProducts(
  query: string,
): Promise<Result<CatalogProduct[]>> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return ok([]);

  const catalog = await listPublicProducts();
  if (!catalog.ok) return catalog;

  const needle = trimmed.toLowerCase();
  return ok(
    catalog.data.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        product.description.toLowerCase().includes(needle),
    ),
  );
}

/** Categorias com pelo menos um produto ativo (RF-002). */
export function filterVisibleCategories(
  categories: CatalogCategory[],
  products: CatalogProduct[],
): CatalogCategory[] {
  const categoryIds = new Set(products.map((product) => product.categoryId));
  return categories.filter((category) => categoryIds.has(category.id));
}

export async function getPublicCatalog(): Promise<
  Result<{
    store: CatalogStore | null;
    categories: CatalogCategory[];
    products: CatalogProduct[];
  }>
> {
  const [storeResult, categoriesResult, productsResult] = await Promise.all([
    getPublicStore(),
    listPublicCategories(),
    listPublicProducts(),
  ]);

  if (!storeResult.ok) return storeResult;
  if (!categoriesResult.ok) return categoriesResult;
  if (!productsResult.ok) return productsResult;

  const visibleCategories = filterVisibleCategories(
    categoriesResult.data,
    productsResult.data,
  );

  return ok({
    store: storeResult.data,
    categories: visibleCategories,
    products: productsResult.data,
  });
}
