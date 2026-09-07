import { err, ok, type Result } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  ensureCustomerRecord,
  resolveCustomerForCheckout,
} from '@/modules/orders/customer';

export type CustomerRealtimeSession = {
  mode: 'authenticated';
  accessToken: string;
  refreshToken: string;
  customerId: string;
};

/**
 * Copia a sessão Auth do cliente (cookies SSR) para o Realtime isolado.
 */
export async function mintCustomerRealtimeSession(): Promise<
  Result<CustomerRealtimeSession>
> {
  const identityResult = await resolveCustomerForCheckout();
  if (!identityResult.ok) return identityResult;

  const ensured = await ensureCustomerRecord(identityResult.data);
  if (!ensured.ok) return ensured;

  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token || !session.refresh_token) {
    return err('UNAUTHENTICATED', 'Faça login para acompanhar o pedido.');
  }

  return ok({
    mode: 'authenticated',
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    customerId: ensured.data.id,
  });
}
