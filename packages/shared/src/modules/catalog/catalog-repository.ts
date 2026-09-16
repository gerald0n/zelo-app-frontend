import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import { hasSupabasePublicConfig } from '@/config/env';
import { mapCategory, mapProduct } from '@/modules/catalog/mappers';
import { listProductRatings } from '@/modules/catalog/product-ratings';
import {
  listPublicPizzaAddons,
  listPublicPizzaSizes,
} from '@/modules/catalog/pizza-repository';
import { getPublicStore } from '@/modules/catalog/store-repository';

export { getPublicStore } from '@/modules/catalog/store-repository';
import { listAllSatelliteProducts } from '@/modules/catalog/satellite-repository';
import type { ActivePromotion } from '@/modules/catalog/promotions';
import type {
  CatalogCategory,
  CatalogPizzaAddon,
  CatalogPizzaSize,
  CatalogProduct,
  CatalogStore,
} from '@/modules/catalog/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const PRODUCT_SELECT = `
  *,
  product_images (*),
  product_add_ons (
    sort_order,
    add_ons (*)
  ),
  pizza_flavor_prices (*)
`;

const PROMOTIONS_SELECT = `
  scope,
  discount_percent,
  promotion_categories ( category_id ),
  promotion_products ( product_id )
`;

function notConfigured<T>(): Result<T> {
  return err(
    'INTEGRATION_UNAVAILABLE',
    'Catálogo indisponível: configure o Supabase no ambiente.',
  );
}

/**
 * Promoções ativas e dentro do período de vigência — a policy
 * `promotions_public_read` já filtra isso, então um `select` simples basta.
 * Falha em silêncio (loga e devolve `[]`): uma promoção fora do ar não deve
 * derrubar o catálogo inteiro.
 */
async function listActivePromotions(
  supabase: SupabaseClient<Database>,
): Promise<ActivePromotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select(PROMOTIONS_SELECT)
    .eq('is_active', true);

  if (error) {
    logger.error('Falha ao ler promoções ativas', { message: error.message });
    return [];
  }

  return (data ?? []).map((row) => ({
    scope: row.scope as ActivePromotion['scope'],
    discountPercent: Number(row.discount_percent),
    categoryIds: (row.promotion_categories ?? []).map((c) => c.category_id),
    productIds: (row.promotion_products ?? []).map((p) => p.product_id),
  }));
}

export async function listPublicCategories(): Promise<
  Result<CatalogCategory[]>
> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = createPublicSupabaseClient();
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
    const supabase = createPublicSupabaseClient();
    const [{ data, error }, promotions, ratings] = await Promise.all([
      supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .is('archived_at', null)
        .is('fulfillment_location_id', null)
        .order('sort_order', { ascending: true }),
      listActivePromotions(supabase),
      listProductRatings(supabase),
    ]);

    if (error) {
      logger.error('Falha ao ler produtos', { message: error.message });
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar o cardápio.',
        { cause: error },
      );
    }

    return ok(
      (data ?? []).map((row) =>
        mapProduct(row, promotions, ratings.get(row.id) ?? null),
      ),
    );
  } catch (cause) {
    return err('INTERNAL_ERROR', 'Erro ao carregar o cardápio.', { cause });
  }
}

/**
 * Catálogo normal + produtos de pronta entrega (qualquer local satélite) —
 * "qualquer produto que um cliente pode legitimamente ter num pedido".
 * `listPublicProducts()` sozinho exclui produtos satélite de propósito (pra
 * não aparecerem na vitrine normal), mas isso os deixaria "removidos do
 * catálogo" em qualquer revalidação/hidratação de carrinho — usado pelo
 * carrinho salvo no servidor e pela revalidação da tela de carrinho, que não
 * sabem em qual "modo" (encomenda/pronta entrega) o item foi adicionado.
 */
export async function listOrderableProducts(): Promise<
  Result<CatalogProduct[]>
> {
  const [catalog, satellite] = await Promise.all([
    listPublicProducts(),
    listAllSatelliteProducts(),
  ]);
  if (!catalog.ok) return catalog;
  if (!satellite.ok) return satellite;
  return ok([...catalog.data, ...satellite.data]);
}

export async function getPublicProductBySlugOrId(
  slugOrId: string,
): Promise<Result<CatalogProduct | null>> {
  if (!hasSupabasePublicConfig()) return notConfigured();

  try {
    const supabase = createPublicSupabaseClient();

    const bySlug = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('slug', slugOrId)
      .eq('is_active', true)
      .is('archived_at', null)
      .is('fulfillment_location_id', null)
      .maybeSingle();

    if (bySlug.error) {
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar o produto.',
        { cause: bySlug.error },
      );
    }

    if (bySlug.data) {
      const [promotions, ratings] = await Promise.all([
        listActivePromotions(supabase),
        listProductRatings(supabase),
      ]);
      return ok(
        mapProduct(
          bySlug.data,
          promotions,
          ratings.get(bySlug.data.id) ?? null,
        ),
      );
    }

    const byId = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', slugOrId)
      .eq('is_active', true)
      .is('archived_at', null)
      .is('fulfillment_location_id', null)
      .maybeSingle();

    if (byId.error) {
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Não foi possível carregar o produto.',
        { cause: byId.error },
      );
    }

    if (!byId.data) return ok(null);
    const [promotions, ratings] = await Promise.all([
      listActivePromotions(supabase),
      listProductRatings(supabase),
    ]);
    return ok(
      mapProduct(byId.data, promotions, ratings.get(byId.data.id) ?? null),
    );
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
    pizzaSizes: CatalogPizzaSize[];
    pizzaAddons: CatalogPizzaAddon[];
  }>
> {
  const [
    storeResult,
    categoriesResult,
    productsResult,
    pizzaSizesResult,
    pizzaAddonsResult,
  ] = await Promise.all([
    getPublicStore(),
    listPublicCategories(),
    listPublicProducts(),
    listPublicPizzaSizes(),
    listPublicPizzaAddons(),
  ]);

  if (!storeResult.ok) return storeResult;
  if (!categoriesResult.ok) return categoriesResult;
  if (!productsResult.ok) return productsResult;
  if (!pizzaSizesResult.ok) return pizzaSizesResult;
  if (!pizzaAddonsResult.ok) return pizzaAddonsResult;

  const visibleCategories = filterVisibleCategories(
    categoriesResult.data,
    productsResult.data,
  );

  return ok({
    store: storeResult.data,
    categories: visibleCategories,
    products: productsResult.data,
    pizzaSizes: pizzaSizesResult.data,
    pizzaAddons: pizzaAddonsResult.data,
  });
}
