import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getSupabaseServiceRoleKey, getSupabaseServerUrl } from '@/config/env';

/**
 * Cliente privilegiado — somente servidor, operações controladas.
 * Nunca importar em Client Components.
 */
export function createAdminSupabaseClient() {
  return createClient<Database>(
    getSupabaseServerUrl(),
    getSupabaseServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
