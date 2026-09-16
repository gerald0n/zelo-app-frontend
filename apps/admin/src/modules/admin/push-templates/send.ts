import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import {
  broadcastCustomerPush,
  type BroadcastPushSummary,
} from '@/modules/notifications/broadcast';
import {
  PUSH_TEMPLATE_SELECT,
  mapPushTemplate,
  type AdminPushTemplate,
} from './shared';

async function deliverPushTemplate(
  template: AdminPushTemplate,
  options: { triggeredBy: 'manual' | 'scheduled'; sentBy: string | null },
): Promise<BroadcastPushSummary> {
  const admin = createAdminSupabaseClient();

  const summary = await broadcastCustomerPush({
    title: template.title,
    body: template.body,
    url: template.url,
  });

  await admin.from('push_template_sends').insert({
    template_id: template.id,
    triggered_by: options.triggeredBy,
    sent_by: options.sentBy,
    customers: summary.customers,
    devices: summary.devices,
    sent: summary.sent,
    failed: summary.failed,
    revoked: summary.revoked,
  });

  await admin
    .from('push_templates')
    .update({
      last_sent_at: new Date().toISOString(),
      send_count: template.sendCount + 1,
      // Agendado já disparou: volta pra rascunho (reutilizável, não trava).
      ...(template.status === 'scheduled'
        ? { status: 'draft', scheduled_at: null }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', template.id);

  return summary;
}

async function fetchTemplate(
  id: string,
): Promise<Result<AdminPushTemplate>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('push_templates')
    .select(PUSH_TEMPLATE_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível localizar o modelo.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Modelo não encontrado.');
  return ok(mapPushTemplate(data));
}

/** Disparo manual, feito por um admin logado a partir do painel. */
export async function sendPushTemplateNow(
  id: string,
): Promise<Result<BroadcastPushSummary>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const templateResult = await fetchTemplate(id);
  if (!templateResult.ok) return templateResult;
  const template = templateResult.data;

  const summary = await deliverPushTemplate(template, {
    triggeredBy: 'manual',
    sentBy: auth.data.id,
  });

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'push_template.send',
    entityType: 'push_template',
    entityId: id,
    metadata: {
      title: template.title,
      customers: summary.customers,
      devices: summary.devices,
      sent: summary.sent,
      failed: summary.failed,
    },
  });

  return ok(summary);
}

/**
 * Disparo agendado, chamado pela rota de cron (`/api/v1/cron/send-scheduled-pushes`)
 * sem sessão de admin — a autorização é o segredo do cron, validado na rota.
 * `status='scheduled'` já foi travado pra `'draft'` por essa rota antes de
 * chamar aqui (update condicional), então isso nunca dispara em duplicidade.
 */
export async function sendScheduledPushTemplate(
  id: string,
): Promise<Result<BroadcastPushSummary>> {
  const templateResult = await fetchTemplate(id);
  if (!templateResult.ok) return templateResult;
  const template = templateResult.data;

  const summary = await deliverPushTemplate(template, {
    triggeredBy: 'scheduled',
    sentBy: null,
  });

  return ok(summary);
}
