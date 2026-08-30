import 'server-only';

import { createHash } from 'node:crypto';
import {
  createCustomerIdentityProvider,
  type CustomerIdentity,
} from '@/modules/auth/customer-identity';
import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function resolveCustomerForCheckout(): Promise<
  Result<CustomerIdentity>
> {
  const provider = createCustomerIdentityProvider();
  const identity = await provider.getCurrent();
  if (!identity.ok) return identity;
  if (!identity.data) {
    return err('UNAUTHENTICATED', 'Faça login para concluir o pedido.');
  }
  return ok(identity.data);
}

/**
 * Garante o perfil em `customers` para a sessão Auth já existente.
 */
export async function ensureCustomerRecord(
  identity: CustomerIdentity,
): Promise<Result<CustomerIdentity>> {
  const admin = createAdminSupabaseClient();

  const existing = await admin
    .from('customers')
    .select('id')
    .eq('id', identity.id)
    .maybeSingle();

  if (existing.error) {
    logger.error('Falha ao verificar cliente', {
      message: existing.error.message,
      code: existing.error.code,
    });
    return err('INTERNAL_ERROR', 'Falha ao verificar cliente.', {
      cause: existing.error,
    });
  }

  if (existing.data) return ok(identity);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== identity.id) {
    return err('UNAUTHENTICATED', 'Sessão inválida para criar o perfil.');
  }

  const inserted = await admin.from('customers').upsert(
    {
      id: identity.id,
      name: identity.name,
      phone_e164: identity.phoneE164,
    },
    { onConflict: 'id' },
  );

  if (inserted.error) {
    logger.error('Falha ao upsert customer', { message: inserted.error.message });
    return err('INTERNAL_ERROR', 'Não foi possível registrar o cliente.', {
      cause: inserted.error,
    });
  }

  return ok(identity);
}

export function hashIdempotencyPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function findIdempotentResponse(options: {
  scope: string;
  key: string;
}): Promise<
  Result<{
    responseStatus: number;
    responseBody: unknown;
    requestHash: string;
  } | null>
> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('idempotency_keys')
    .select('request_hash, response_status, response_body')
    .eq('scope', options.scope)
    .eq('key', options.key)
    .maybeSingle();

  if (error) {
    logger.error('Falha ao ler idempotency_keys', { message: error.message });
    return err('INTERNAL_ERROR', 'Falha na verificação de idempotência.', {
      cause: error,
    });
  }

  if (!data) return ok(null);

  return ok({
    responseStatus: data.response_status,
    responseBody: data.response_body,
    requestHash: data.request_hash,
  });
}

export async function saveIdempotentResponse(options: {
  scope: string;
  key: string;
  customerId: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
}): Promise<Result<true>> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from('idempotency_keys').insert({
    scope: options.scope,
    key: options.key,
    customer_id: options.customerId,
    request_hash: options.requestHash,
    response_status: options.responseStatus,
    response_body: options.responseBody as never,
  });

  if (error) {
    if (error.code === '23505') {
      return ok(true);
    }
    logger.error('Falha ao gravar idempotency_keys', { message: error.message });
    return err('INTERNAL_ERROR', 'Falha ao registrar idempotência.', {
      cause: error,
    });
  }

  return ok(true);
}