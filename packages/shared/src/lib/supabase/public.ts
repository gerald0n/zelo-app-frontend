import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getSupabasePublishableKey, getSupabaseServerUrl } from '@/config/env';

/**
 * Cliente público sem cookies — só leitura anônima (policies `*_public_read`).
 * Não lê `cookies()`/`headers()`, então é seguro dentro de `unstable_cache`.
 * Uso: catálogo, loja e depoimentos (dados iguais para todo visitante).
 */
export function createPublicSupabaseClient(): SupabaseClient<Database> {
  return createClient<Database>(
    getSupabaseServerUrl(),
    getSupabasePublishableKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
