import 'server-only';

import { unstable_cache } from 'next/cache';
import { err, ok, type Result } from '@/lib/errors';
import {
  BANNERS_CACHE_TAG,
  BEST_SELLERS_CACHE_TTL_SECONDS,
  CATALOG_CACHE_TAG,
  CATALOG_CACHE_TTL_SECONDS,
  FAQ_CACHE_TAG,
  PROMO_MODAL_BANNERS_CACHE_TAG,
  STORE_CACHE_TAG,
} from '@/modules/catalog/cache';
import { listPublicBestSellingProductIds } from '@/modules/catalog/best-sellers-repository';
import { getPublicBanners } from '@/modules/catalog/banners-repository';
import { getPublicFaqItems } from '@/modules/catalog/faq-repository';
import { getPublicPromoModalBanners } from '@/modules/catalog/promo-modal-banners-repository';
import {
  getPublicCatalog,
  getPublicProductBySlugOrId,
  getPublicStore,
  listPublicProducts,
} from '@/modules/catalog/catalog-repository';

/**
 * Camada cacheada do catálogo público (`apps/client`). Serve do Data Cache do
 * Next em vez de bater no Supabase a cada visita; `revalidate` é a rede de
 * segurança temporal (ver `./cache.ts`).
 *
 * NÃO usar no `apps/admin`: as telas do painel precisam de leitura fresca logo
 * após gravar — o painel continua chamando as funções cruas do
 * `catalog-repository`.
 */

const cachedCatalog = unstable_cache(
  async () => {
    const result = await getPublicCatalog();
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  },
  ['catalog:catalog'],
  {
    tags: [CATALOG_CACHE_TAG, STORE_CACHE_TAG],
    revalidate: CATALOG_CACHE_TTL_SECONDS,
  },
);

const cachedStore = unstable_cache(
  async () => {
    const result = await getPublicStore();
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  },
  ['catalog:store'],
  { tags: [STORE_CACHE_TAG], revalidate: CATALOG_CACHE_TTL_SECONDS },
);

const cachedProducts = unstable_cache(
  async () => {
    const result = await listPublicProducts();
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  },
  ['catalog:products'],
  { tags: [CATALOG_CACHE_TAG], revalidate: CATALOG_CACHE_TTL_SECONDS },
);

/** Home do client: sempre olha os últimos 30 dias, sem filtro pro usuário. */
const BEST_SELLERS_WINDOW_DAYS = 30;
/**
 * Busca mais do que os 3 exibidos: o ranking vem só do histórico de vendas,
 * sem saber se o produto segue ativo/disponível. `HomeCatalog` filtra os
 * indisponíveis e corta pros 3 primeiros — essa margem garante que sobre
 * candidato (4º, 5º lugar…) pra completar o pódio quando um dos 3 primeiros
 * for desativado.
 */
const BEST_SELLERS_FETCH_LIMIT = 10;

const cachedBestSellingProductIds = unstable_cache(
  async () =>
    listPublicBestSellingProductIds(
      BEST_SELLERS_WINDOW_DAYS,
      BEST_SELLERS_FETCH_LIMIT,
    ),
  ['catalog:best-sellers:30d'],
  { revalidate: BEST_SELLERS_CACHE_TTL_SECONDS },
);

const cachedBanners = unstable_cache(
  async () => {
    const result = await getPublicBanners();
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  },
  ['catalog:banners'],
  { tags: [BANNERS_CACHE_TAG], revalidate: CATALOG_CACHE_TTL_SECONDS },
);

const cachedFaqItems = unstable_cache(
  async () => {
    const result = await getPublicFaqItems();
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  },
  ['catalog:faq'],
  { tags: [FAQ_CACHE_TAG], revalidate: CATALOG_CACHE_TTL_SECONDS },
);

const cachedPromoModalBanners = unstable_cache(
  async () => {
    const result = await getPublicPromoModalBanners();
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  },
  ['catalog:promo-modal-banners'],
  {
    tags: [PROMO_MODAL_BANNERS_CACHE_TAG],
    revalidate: CATALOG_CACHE_TTL_SECONDS,
  },
);

const cachedProductBySlugOrId = unstable_cache(
  async (slugOrId: string) => {
    const result = await getPublicProductBySlugOrId(slugOrId);
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  },
  ['catalog:product'],
  { tags: [CATALOG_CACHE_TAG], revalidate: CATALOG_CACHE_TTL_SECONDS },
);

async function toResult<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await run());
  } catch (cause) {
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Não foi possível carregar o cardápio.',
      { cause },
    );
  }
}

export function getCachedPublicCatalog() {
  return toResult(() => cachedCatalog());
}

export function getCachedPublicStore() {
  return toResult(() => cachedStore());
}

export function getCachedPublicBanners() {
  return toResult(() => cachedBanners());
}

export function getCachedPublicFaqItems() {
  return toResult(() => cachedFaqItems());
}

export function getCachedPublicPromoModalBanners() {
  return toResult(() => cachedPromoModalBanners());
}

export function getCachedBestSellingProductIds() {
  return cachedBestSellingProductIds();
}

export function listCachedPublicProducts() {
  return toResult(() => cachedProducts());
}

export function getCachedPublicProductBySlugOrId(slugOrId: string) {
  return toResult(() => cachedProductBySlugOrId(slugOrId));
}
