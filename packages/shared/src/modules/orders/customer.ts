import 'server-only';

import { createHash } from 'node:crypto';
import {
  createCustomerIdentityProvider,
  type CustomerIdentity,
} from '@/modules/auth/customer-identity';
import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
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
 * Confirma que o perfil em `customers` (dono de `identity.id`) ainda existe.
 *
 * `identity` sempre vem de `resolveCustomerForCheckout()`
 * (`SupabaseCustomerIdentityProvider.getCurrent()`), que só retorna
 * não-nulo quando esse perfil já existe pra esta sessão + loja — criar o
 * registro aqui nunca chegou a ser exercitado (o login por OTP já cria o
 * perfil via `upsertCustomerFromPhone` antes da sessão existir). Depois da
 * Fase C (identidade de cliente por tenant, `customers.user_id` separado de
 * `customers.id`), criar o registro exigiria `user_id`/`store_id` que esta
 * função não recebe — como o caminho é inalcançável, só confirma e falha
 * alto se o perfil sumiu (ex.: apagado manualmente) em vez de tentar recriar
 * com dado incompleto.
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

  if (!existing.data) {
    logger.error('Perfil de cliente não encontrado para sessão ativa', {
      customerId: identity.id,
    });
    return err('UNAUTHENTICATED', 'Sessão inválida. Faça login novamente.');
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