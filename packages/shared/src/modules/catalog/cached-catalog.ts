import 'server-only';

import { unstable_cache } from 'next/cache';
import { err, ok, type Result } from '@/lib/errors';
import { getRequestStoreId } from '@/modules/tenant/resolve-store-id';
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
  async (storeId?: string) => {
    const result = await getPublicCatalog(storeId);
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  },
  ['catalog:catalog'],
  {
    tags: [CATALOG_CACHE_TAG, STORE_CACHE_TAG],
    revalidate: CATALOG_CACHE_TTL_SECONDS,
  },
);

// `storeId` como argumento (não lido via `headers()` aqui dentro — isso
// quebraria o unstable_cache) entra automaticamente na chave do cache: cada
// tenant tem sua própria entrada, mesmo com a mesma `keyParts` base.
const cachedStore = unstable_cache(
  async (storeId?: string) => {
    const result = await getPublicStore(storeId);
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  },
  ['catalog:store'],
  { tags: [STORE_CACHE_TAG], revalidate: CATALOG_CACHE_TTL_SECONDS },
);

const cachedProducts = unstable_cache(
  async (storeId?: string) => {
    const result = await listPublicProducts(storeId);
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
  async (storeId?: string) => {
    const result = await getPublicBanners(storeId);
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  },
  ['catalog:banners'],
  { tags: [BANNERS_CACHE_TAG], revalidate: CATALOG_CACHE_TTL_SECONDS },
);

const cachedFaqItems = unstable_cache(
  async (storeId?: string) => {
    const result = await getPublicFaqItems(storeId);
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  },
  ['catalog:faq'],
  { tags: [FAQ_CACHE_TAG], revalidate: CATALOG_CACHE_TTL_SECONDS },
);

const cachedPromoModalBanners = unstable_cache(
  async (storeId?: string) => {
    const result = await getPublicPromoModalBanners(storeId);
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
  async (slugOrId: string, storeId?: string) => {
    const result = await getPublicProductBySlugOrId(slugOrId, storeId);
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

export async function getCachedPublicCatalog() {
  const storeId = await getRequestStoreId();
  return toResult(() => cachedCatalog(storeId));
}

export async function getCachedPublicStore() {
  const storeId = await getRequestStoreId();
  return toResult(() => cachedStore(storeId));
}

export async function getCachedPublicBanners() {
  const storeId = await getRequestStoreId();
  return toResult(() => cachedBanners(storeId));
}

export async function getCachedPublicFaqItems() {
  const storeId = await getRequestStoreId();
  return toResult(() => cachedFaqItems(storeId));
}

export async function getCachedPublicPromoModalBanners() {
  const storeId = await getRequestStoreId();
  return toResult(() => cachedPromoModalBanners(storeId));
}

/**
 * Mais vendidos ainda não é filtrado por tenant — a RPC `get_top_selling_products`
 * (SQL, `security definer`) precisaria de um `p_store_id` novo, e mudar essa
 * função é uma mudança de banco à parte, não incluída nesta fatia da Fase C
 * (ver ADR-0001). Hoje devolve o ranking global, correto só enquanto existir
 * um tenant.
 */
export function getCachedBestSellingProductIds() {
  return cachedBestSellingProductIds();
}

export async function listCachedPublicProducts() {
  const storeId = await getRequestStoreId();
  return toResult(() => cachedProducts(storeId));
}

export async function getCachedPublicProductBySlugOrId(slugOrId: string) {
  const storeId = await getRequestStoreId();
  return toResult(() => cachedProductBySlugOrId(slugOrId, storeId));
}
