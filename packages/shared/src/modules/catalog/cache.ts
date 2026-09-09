/**
 * Tags e TTL do cache de dados públicos (catálogo, loja, depoimentos).
 *
 * As leituras públicas são servidas do Data Cache do Next em vez de baterem
 * no Supabase a cada visita. `revalidate` é a rede de segurança temporal.
 *
 * `apps/admin` e `apps/client` são deploys separados e NÃO compartilham Data
 * Cache — então a invalidação sob demanda (painel editou algo) é feita por
 * HTTP: `apps/admin` chama a rota `/api/v1/internal/revalidate` do
 * `apps/client`, que roda o `revalidateTag`. Ver `./revalidate.ts`.
 */
export const CATALOG_CACHE_TAG = 'catalog';
export const STORE_CACHE_TAG = 'store';
export const TESTIMONIALS_CACHE_TAG = 'testimonials';

export type CatalogRevalidateTag =
  | typeof CATALOG_CACHE_TAG
  | typeof STORE_CACHE_TAG
  | typeof TESTIMONIALS_CACHE_TAG;

/** Tags que a rota de revalidação do `apps/client` aceita. */
export const REVALIDATABLE_CACHE_TAGS: readonly CatalogRevalidateTag[] = [
  CATALOG_CACHE_TAG,
  STORE_CACHE_TAG,
  TESTIMONIALS_CACHE_TAG,
];

/** Catálogo/loja mudam pouco; 60 s de defasagem máxima é aceitável. */
export const CATALOG_CACHE_TTL_SECONDS = 60;

/** Depoimentos mudam raramente. */
export const TESTIMONIALS_CACHE_TTL_SECONDS = 300;
