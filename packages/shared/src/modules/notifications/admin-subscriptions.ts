import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { PushSubscriptionInput } from '@/modules/notifications/types';

export type AdminPushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Cria ou reativa a assinatura de push de um aparelho do painel. */
export async function upsertAdminPushSubscription(options: {
  adminId: string;
  input: PushSubscriptionInput;
}): Promise<Result<{ id: string }>> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data: existing, error: findError } = await admin
    .from('admin_push_subscriptions')
    .select('id')
    .eq('endpoint', options.input.endpoint)
    .maybeSingle();

  if (findError) {
    return err('INTERNAL_ERROR', 'Não foi possível salvar a assinatura.', {
      cause: findError,
    });
  }

  if (existing) {
    const { error } = await admin
      .from('admin_push_subscriptions')
      .update({
        admin_id: options.adminId,
        p256dh: options.input.keys.p256dh,
        auth: options.input.keys.auth,
        user_agent: options.input.userAgent ?? null,
        last_seen_at: now,
        revoked_at: null,
      })
      .eq('id', existing.id);
    if (error) {
      return err('INTERNAL_ERROR', 'Não foi possível salvar a assinatura.', {
        cause: error,
      });
    }
    return ok({ id: existing.id });
  }

  const { data, error } = await admin
    .from('admin_push_subscriptions')
    .insert({
      admin_id: options.adminId,
      endpoint: options.input.endpoint,
      p256dh: options.input.keys.p256dh,
      auth: options.input.keys.auth,
      user_agent: options.input.userAgent ?? null,
      last_seen_at: now,
    })
    .select('id')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível salvar a assinatura.', {
      cause: error,
    });
  }
  return ok({ id: data.id });
}

export async function revokeAdminPushSubscription(options: {
  adminId: string;
  endpoint: string;
}): Promise<Result<{ revoked: boolean }>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('admin_push_subscriptions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('endpoint', options.endpoint)
    .eq('admin_id', options.adminId)
    .is('revoked_at', null)
    .select('id');

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover a assinatura.', {
      cause: error,
    });
  }
  return ok({ revoked: (data?.length ?? 0) > 0 });
}

export async function revokeAdminPushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('admin_push_subscriptions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('endpoint', endpoint)
    .is('revoked_at', null);
  if (error) {
    logger.warn('Falha ao invalidar assinatura push do admin', {
      message: error.message,
    });
  }
}

export async function listActiveAdminSubscriptions(): Promise<
  AdminPushTarget[]
> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('admin_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .is('revoked_at', null);

  if (error) {
    logger.warn('Falha ao listar assinaturas push do admin', {
      message: error.message,
    });
    return [];
  }

  return (data ?? []).map((row) => ({
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
  }));
}
