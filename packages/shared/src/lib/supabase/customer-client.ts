'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let customerClient: SupabaseClient<Database> | null = null;

/**
 * Cliente do Cliente em memória — não grava JWT em localStorage.
 * A sessão canônica fica em cookie HttpOnly; este client só serve o Realtime.
 */
export function createCustomerSupabaseClient(): SupabaseClient<Database> {
  if (customerClient) return customerClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase público não configurado.');
  }

  customerClient = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'zelo-customer-auth',
    },
  });

  return customerClient;
}
