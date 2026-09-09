/**
 * Tags e TTL do cache de dados públicos (catálogo, loja, depoimentos).
 *
 * As leituras públicas são servidas do Data Cache do Next em vez de baterem
 * no Supabase a cada visita. `revalidate` é a rede de segurança temporal; a
 * invalidação sob demanda (admin editou algo) usa `revalidateTag` com estas
 * mesmas tags.
 *
 * ⚠️ `apps/admin` e `apps/client` são deploys separados e NÃO compartilham
 * Data Cache. Um `revalidateTag` no admin não limpa o cache do client — a
 * invalidação cross-app precisa de uma rota dedicada no client (TODO).
 */
export const CATALOG_CACHE_TAG = 'catalog';
export const STORE_CACHE_TAG = 'store';
export const TESTIMONIALS_CACHE_TAG = 'testimonials';

/** Catálogo/loja mudam pouco; 60 s de defasagem máxima é aceitável. */
export const CATALOG_CACHE_TTL_SECONDS = 60;

/** Depoimentos mudam raramente. */
export const TESTIMONIALS_CACHE_TTL_SECONDS = 300;
