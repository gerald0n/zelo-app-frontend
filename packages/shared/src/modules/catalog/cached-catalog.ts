import 'server-only';

import { unstable_cache } from 'next/cache';
import { err, ok, type Result } from '@/lib/errors';
import {
  CATALOG_CACHE_TAG,
  CATALOG_CACHE_TTL_SECONDS,
  STORE_CACHE_TAG,
} from '@/modules/catalog/cache';
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

export function listCachedPublicProducts() {
  return toResult(() => cachedProducts());
}

export function getCachedPublicProductBySlugOrId(slugOrId: string) {
  return toResult(() => cachedProductBySlugOrId(slugOrId));
}
