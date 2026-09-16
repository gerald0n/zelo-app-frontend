import 'server-only';

import { ok, type Result } from '@/lib/errors';
import { requireAdmin } from '@/modules/admin/auth';
import {
  countActiveCustomerPushRecipients,
  type BroadcastRecipients,
} from '@/modules/notifications/broadcast';

/** Usado pela tela de modelos de push pra montar o texto de confirmação. */
export async function getBroadcastRecipientCount(): Promise<
  Result<BroadcastRecipients>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  return ok(await countActiveCustomerPushRecipients());
}
