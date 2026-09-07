'use client';

import { createCustomerSupabaseClient } from '@/lib/supabase/customer-client';

let ensurePromise: Promise<boolean> | null = null;

export function resetCustomerRealtimeAuth() {
  ensurePromise = null;
}

/** Garante sessão do Cliente no storage isolado para Realtime + RLS. */
export async function ensureCustomerRealtimeAuth(): Promise<boolean> {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      const client = createCustomerSupabaseClient();
      const existing = await client.auth.getSession();
      if (existing.data.session?.user) return true;

      const response = await fetch('/api/v1/auth/session', { method: 'POST' });
      if (!response.ok) {
        ensurePromise = null;
        return false;
      }
      const json = await response.json();
      const session = json.session as {
        accessToken?: string;
        refreshToken?: string;
      };

      if (!session.accessToken || !session.refreshToken) {
        ensurePromise = null;
        return false;
      }

      const { error } = await client.auth.setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });
      if (error) {
        ensurePromise = null;
        return false;
      }
      return true;
    } catch {
      ensurePromise = null;
      return false;
    }
  })();

  return ensurePromise;
}
