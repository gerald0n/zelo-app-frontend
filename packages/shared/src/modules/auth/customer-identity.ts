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
      // `getClaims()` verifica o JWT localmente (signing keys assimétricas),
      // sem ida à Auth a cada request — ao contrário de `getUser()`. Se o
      // projeto ainda usa segredo simétrico, cai no mesmo caminho de rede.
      const { data, error } = await supabase.auth.getClaims();

      if (error) {
        return err('UNAUTHENTICATED', 'Não foi possível validar a sessão.', {
          cause: error,
        });
      }

      const userId = data?.claims.sub;
      if (!userId) {
        return ok(null);
      }

      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, phone_e164')
        .eq('id', userId)
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
