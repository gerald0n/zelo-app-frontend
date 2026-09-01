import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import {
  getSupabasePublishableKey,
  getSupabaseServerUrl,
  hasSupabasePublicConfig,
} from '@/config/env';
import { supabaseAuthCookieOptions } from '@/lib/supabase/cookie-options';

export async function createServerSupabaseClient() {
  if (!hasSupabasePublicConfig()) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e a chave pública.',
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    getSupabaseServerUrl(),
    getSupabasePublishableKey(),
    {
      cookieOptions: supabaseAuthCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            const authCookies = supabaseAuthCookieOptions();
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, { ...options, ...authCookies });
            });
          } catch {
            // Server Components não escrevem cookies; o proxy renova a sessão.
          }
        },
      },
    },
  );
}
