import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import {
  broadcastCustomerPush,
  countActiveCustomerPushRecipients,
  type BroadcastPushSummary,
  type BroadcastRecipients,
} from '@/modules/notifications/broadcast';

export async function getBroadcastRecipientCount(): Promise<
  Result<BroadcastRecipients>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  return ok(await countActiveCustomerPushRecipients());
}

export type SendBroadcastInput = {
  title: string;
  body: string;
  url?: string | null;
};

export async function sendCustomerBroadcast(
  input: SendBroadcastInput,
): Promise<Result<BroadcastPushSummary>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (!input.title.trim() || !input.body.trim()) {
    return err('VALIDATION_ERROR', 'Título e mensagem são obrigatórios.');
  }

  const summary = await broadcastCustomerPush(input);

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'notification.broadcast',
    entityType: 'notification',
    metadata: {
      title: input.title,
      body: input.body,
      url: input.url ?? null,
      customers: summary.customers,
      devices: summary.devices,
      sent: summary.sent,
      failed: summary.failed,
      revoked: summary.revoked,
    },
  });

  return ok(summary);
}
