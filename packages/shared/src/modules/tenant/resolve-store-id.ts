import 'server-only';

import { headers } from 'next/headers';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import { logger } from '@/lib/logger';
import { err, ok, type Result } from '@/lib/errors';

/**
 * White label (ADR-0001, Fase B) — resolve o tenant pelo hostname do request.
 *
 * Sem tenant cadastrado para o host (hoje é o caso de todos: nenhuma loja
 * ainda tem `domain` preenchido), cai no mesmo fallback que `getPublicStore`
 * já usava antes desta fase existir: a loja mais antiga. Isso garante zero
 * mudança de comportamento até que domínios de tenant sejam configurados
 * (Fase A/E) e as queries passem a usar esse id de verdade (Fase C).
 *
 * Falha ao consultar o banco nunca deve derrubar o proxy — cai no mesmo
 * fallback, só loga o erro.
 */

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { storeId: string | null; expiresAt: number }>();
let fallbackCache: { storeId: string | null; expiresAt: number } | null = null;

async function resolveFallbackStoreId(): Promise<string | null> {
  if (fallbackCache && fallbackCache.expiresAt > Date.now()) {
    return fallbackCache.storeId;
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from('stores')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error('Falha ao resolver loja de fallback por hostname', {
      message: error.message,
    });
    return null;
  }

  const storeId = data?.id ?? null;
  fallbackCache = { storeId, expiresAt: Date.now() + CACHE_TTL_MS };
  return storeId;
}

/**
 * Lê o `x-store-id` que o proxy já resolveu (Fase B) para o request atual.
 * Uso em Server Components/Route Handlers — nunca dentro de `unstable_cache`
 * (que não pode depender de `headers()`); leia aqui fora e passe o valor como
 * argumento pra função cacheada, como `cached-catalog.ts` faz.
 */
export async function getRequestStoreId(): Promise<string | undefined> {
  const requestHeaders = await headers();
  return requestHeaders.get('x-store-id') ?? undefined;
}

/**
 * Como `getRequestStoreId()`, mas para caminhos de escrita (criar categoria,
 * produto, adicional, etc.) — gravar uma linha nova com `store_id` nulo seria
 * um tenant "órfão" que some do catálogo filtrado por loja. Falha alto e
 * explícito em vez de deixar passar.
 */
export async function requireRequestStoreId(): Promise<Result<string>> {
  const storeId = await getRequestStoreId();
  if (!storeId) {
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Não foi possível identificar a loja do request atual.',
    );
  }
  return ok(storeId);
}

export async function resolveStoreIdByHostname(
  hostname: string,
): Promise<string | null> {
  const cached = cache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) return cached.storeId;

  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from('stores')
      .select('id')
      .eq('domain', hostname)
      .maybeSingle();

    if (error) {
      logger.error('Falha ao resolver loja por hostname', {
        message: error.message,
        hostname,
      });
      return resolveFallbackStoreId();
    }

    const storeId = data?.id ?? (await resolveFallbackStoreId());
    cache.set(hostname, { storeId, expiresAt: Date.now() + CACHE_TTL_MS });
    return storeId;
  } catch (unknownError) {
    logger.error('Erro inesperado ao resolver loja por hostname', {
      message:
        unknownError instanceof Error
          ? unknownError.message
          : String(unknownError),
      hostname,
    });
    return resolveFallbackStoreId();
  }
}
