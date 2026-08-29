import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  hasSupabasePublicConfig,
} from '@/config/env';
import { supabaseAuthCookieOptions } from '@/lib/supabase/cookie-options';

export function createBrowserSupabaseClient() {
  if (!hasSupabasePublicConfig()) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e a chave pública.',
    );
  }

  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookieOptions: supabaseAuthCookieOptions(),
    },
  );
}
