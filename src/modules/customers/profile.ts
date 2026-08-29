import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  ensureCustomerRecord,
  resolveCustomerForCheckout,
} from '@/modules/orders/customer';
import type { CustomerIdentity } from '@/modules/auth/customer-identity';

export async function updateCustomerProfile(input: {
  name: string;
}): Promise<Result<CustomerIdentity>> {
  const name = input.name.trim();
  if (name.length < 2) {
    return err('VALIDATION_ERROR', 'Informe seu nome.');
  }

  const identity = await resolveCustomerForCheckout();
  if (!identity.ok) return identity;

  const ensured = await ensureCustomerRecord(identity.data);
  if (!ensured.ok) return ensured;

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('customers')
    .update({ name })
    .eq('id', ensured.data.id);

  if (error) {
    logger.error('Falha ao atualizar perfil do cliente', {
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível salvar seus dados.', {
      cause: error,
    });
  }

  return ok({
    ...ensured.data,
    name,
  });
}
