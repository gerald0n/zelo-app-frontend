import 'server-only';

import { hasWebPushConfig } from '@/config/env';
import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { sendWebPushNotification } from '@/lib/push/web-push';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  ensureCustomerRecord,
  resolveCustomerForCheckout,
} from '@/modules/orders/customer';
import type {
  PushSubscriptionInput,
  StoredPushSubscription,
} from '@/modules/notifications/types';

/**
 * Avisa o próprio aparelho que a ativação deu certo. Só dispara no insert
 * (assinatura nova) — não no update/reativação — pra não reenviar a cada
 * refresh de last_seen_at. Nunca lança: falha aqui não pode derrubar o
 * cadastro da assinatura.
 */
function sendActivationWelcomePush(input: PushSubscriptionInput): void {
  if (!hasWebPushConfig()) return;

  sendWebPushNotification({
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    payload: {
      title: 'Zelo · Notificações ativadas 🎉',
      body: 'Agora você recebe avisos por aqui sobre o andamento dos seus pedidos.',
      url: '/conta/notificacoes',
      tag: 'push-welcome',
    },
  }).catch((error) => {
    logger.warn('Push: falha ao enviar boas-vindas de ativação', {
      message: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function upsertPushSubscription(
  input: PushSubscriptionInput,
): Promise<Result<{ id: string }>> {
  const identityResult = await resolveCustomerForCheckout();
  if (!identityResult.ok) return identityResult;

  const ensured = await ensureCustomerRecord(identityResult.data);
  if (!ensured.ok) return ensured;

  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data: existing, error: findError } = await admin
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', input.endpoint)
    .maybeSingle();

  if (findError) {
    logger.error('Falha ao buscar PushSubscription', {
      message: findError.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível salvar a assinatura.', {
      cause: findError,
    });
  }

  if (existing) {
    const { error } = await admin
      .from('push_subscriptions')
      .update({
        customer_id: ensured.data.id,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        user_agent: input.userAgent ?? null,
        last_seen_at: now,
        revoked_at: null,
      })
      .eq('id', existing.id);

    if (error) {
      logger.error('Falha ao atualizar PushSubscription', {
        message: error.message,
      });
      return err('INTERNAL_ERROR', 'Não foi possível salvar a assinatura.', {
        cause: error,
      });
    }

    return ok({ id: existing.id });
  }

  const { data, error } = await admin
    .from('push_subscriptions')
    .insert({
      customer_id: ensured.data.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      user_agent: input.userAgent ?? null,
      last_seen_at: now,
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('Falha ao criar PushSubscription', {
      message: error?.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível salvar a assinatura.', {
      cause: error,
    });
  }

  sendActivationWelcomePush(input);

  return ok({ id: data.id });
}

export async function revokePushSubscription(
  endpoint: string,
): Promise<Result<{ revoked: boolean }>> {
  const identityResult = await resolveCustomerForCheckout();
  if (!identityResult.ok) return identityResult;

  const ensured = await ensureCustomerRecord(identityResult.data);
  if (!ensured.ok) return ensured;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('push_subscriptions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('endpoint', endpoint)
    .eq('customer_id', ensured.data.id)
    .is('revoked_at', null)
    .select('id');

  if (error) {
    logger.error('Falha ao revogar PushSubscription', {
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível remover a assinatura.', {
      cause: error,
    });
  }

  return ok({ revoked: (data?.length ?? 0) > 0 });
}

export async function revokePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('push_subscriptions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('endpoint', endpoint)
    .is('revoked_at', null);

  if (error) {
    logger.warn('Falha ao invalidar PushSubscription', {
      message: error.message,
    });
  }
}

export async function listActiveSubscriptionsForCustomer(
  customerId: string,
): Promise<StoredPushSubscription[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, customer_id, endpoint, p256dh, auth')
    .eq('customer_id', customerId)
    .is('revoked_at', null);

  if (error) {
    logger.warn('Falha ao listar PushSubscriptions', {
      message: error.message,
    });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
  }));
}
