import { err, ok, type Result } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type CustomerIdentity = {
  id: string;
  phoneE164: string;
  name: string;
};

export interface CustomerIdentityProvider {
  getCurrent(): Promise<Result<CustomerIdentity | null>>;
}

/**
 * Identidade do cliente baseada na sessão Supabase Auth (OTP por SMS).
 */
export class SupabaseCustomerIdentityProvider implements CustomerIdentityProvider {
  async getCurrent(): Promise<Result<CustomerIdentity | null>> {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        return err('UNAUTHENTICATED', 'Não foi possível validar a sessão.', {
          cause: error,
        });
      }

      if (!user) {
        return ok(null);
      }

      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, phone_e164')
        .eq('id', user.id)
        .maybeSingle();

      if (!customer) {
        return ok(null);
      }

      return ok({
        id: customer.id,
        phoneE164: customer.phone_e164,
        name: customer.name,
      });
    } catch (cause) {
      return err('INTERNAL_ERROR', 'Falha ao obter identidade do cliente.', {
        cause,
      });
    }
  }
}

export function createCustomerIdentityProvider(): CustomerIdentityProvider {
  return new SupabaseCustomerIdentityProvider();
}
