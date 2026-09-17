import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
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
  // Propaga o `x-store-id` que o proxy já resolveu (Fase B) até o PostgREST
  // — ele expõe automaticamente os headers do request como GUC de sessão
  // (`request.headers`), sem config extra. É o que permite
  // `private.current_customer_id()` (Fase C) resolver o perfil do cliente
  // certo quando o mesmo telefone tem conta em mais de um tenant.
  const requestHeaders = await headers();
  const storeId = requestHeaders.get('x-store-id');

  return createServerClient<Database>(
    getSupabaseServerUrl(),
    getSupabasePublishableKey(),
    {
      global: storeId ? { headers: { 'x-store-id': storeId } } : undefined,
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
