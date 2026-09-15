import 'server-only';

import { type Result } from '@/lib/errors';
import { requireAdmin } from '@/modules/admin/auth';
import {
  approveSupportRequest as approveSupportRequestShared,
  createSupportRequest,
  listSupportRequests as listSupportRequestsShared,
  type AdminOtpSupportRequest,
} from '@/modules/auth/otp-manual-approval';

export type { AdminOtpSupportRequest };

export async function listAdminOtpSupportRequests(): Promise<
  Result<AdminOtpSupportRequest[]>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  return listSupportRequestsShared();
}

export async function approveAdminOtpSupportRequest(
  requestId: string,
): Promise<Result<void>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  return approveSupportRequestShared(requestId, auth.data.id);
}

/** Aprova um telefone direto, sem solicitação prévia do cliente (fallback). */
export async function createAndApproveAdminOtpSupportRequest(
  phone: string,
): Promise<Result<void>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const created = await createSupportRequest(phone);
  if (!created.ok) return created;
  return approveSupportRequestShared(created.data.id, auth.data.id);
}
