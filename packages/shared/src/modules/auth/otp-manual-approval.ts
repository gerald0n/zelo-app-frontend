import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { toPhoneE164 } from '@/lib/phone';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { establishCustomerSession } from '@/modules/auth/establish-session';
import { upsertCustomerFromPhone } from '@/modules/auth/otp';
import type { CustomerIdentity } from '@/modules/auth/customer-identity';
import { requireRequestStoreId } from '@/modules/tenant/resolve-store-id';

/** Janela de validade de uma aprovação manual após o admin confirmar. */
const APPROVAL_TTL_MS = 15 * 60 * 1000;
/** Teto de linhas na tela de suporte do admin. */
const LIST_LIMIT = 50;

export type OtpSupportStatus =
  | 'pending'
  | 'approved'
  | 'consumed'
  | 'expired';

export type AdminOtpSupportRequest = {
  id: string;
  phoneE164: string;
  requestedAt: string;
  approvedAt: string | null;
  consumedAt: string | null;
  expiresAt: string | null;
  status: OtpSupportStatus;
};

export type ManualApprovalSession = {
  customer: CustomerIdentity;
  accessToken: string;
  refreshToken: string;
};

function statusFor(row: {
  approved_at: string | null;
  consumed_at: string | null;
  expires_at: string | null;
}): OtpSupportStatus {
  if (row.consumed_at) return 'consumed';
  if (!row.approved_at) return 'pending';
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return 'expired';
  }
  return 'approved';
}

/** Cliente pediu ajuda pelo botão de suporte na tela de OTP. */
export async function createSupportRequest(
  phone: string,
): Promise<Result<{ id: string; phoneE164: string }>> {
  const phoneE164 = toPhoneE164(phone);
  if (!phoneE164) {
    return err('VALIDATION_ERROR', 'Informe um celular válido com DDD.');
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('customer_otp_support_requests')
    .insert({ phone_e164: phoneE164 })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('Falha ao registrar solicitação de suporte OTP', {
      message: error?.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível registrar a solicitação.', {
      cause: error,
    });
  }

  return ok({ id: data.id, phoneE164 });
}

/** Lista as solicitações recentes pra tela `/suporte-acesso` do admin. */
export async function listSupportRequests(): Promise<
  Result<AdminOtpSupportRequest[]>
> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('customer_otp_support_requests')
    .select('id, phone_e164, requested_at, approved_at, consumed_at, expires_at')
    .order('requested_at', { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    logger.error('Falha ao listar solicitações de suporte OTP', {
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível carregar as solicitações.', {
      cause: error,
    });
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      phoneE164: row.phone_e164,
      requestedAt: row.requested_at,
      approvedAt: row.approved_at,
      consumedAt: row.consumed_at,
      expiresAt: row.expires_at,
      status: statusFor(row),
    })),
  );
}

/**
 * Admin aprova o acesso — nenhum código em texto puro entra em jogo, só uma
 * janela de validade que o polling do client consome sozinho.
 */
export async function approveSupportRequest(
  requestId: string,
  adminId: string,
): Promise<Result<void>> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('customer_otp_support_requests')
    .update({
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + APPROVAL_TTL_MS).toISOString(),
    })
    .eq('id', requestId)
    .is('consumed_at', null);

  if (error) {
    logger.error('Falha ao aprovar solicitação de suporte OTP', {
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível aprovar o acesso.', {
      cause: error,
    });
  }

  return ok(undefined);
}

/**
 * Consultado pelo polling da tela de OTP do client. Quando encontra uma
 * aprovação válida ainda não usada, já consome e abre a sessão — mesmo
 * caminho de `verifyCustomerOtp()`, só que sem código.
 */
export async function checkAndConsumeApproval(
  phone: string,
): Promise<Result<ManualApprovalSession | null>> {
  const phoneE164 = toPhoneE164(phone);
  if (!phoneE164) {
    return err('VALIDATION_ERROR', 'Informe um celular válido com DDD.');
  }

  const admin = createAdminSupabaseClient();
  const { data: request, error } = await admin
    .from('customer_otp_support_requests')
    .select('id, expires_at')
    .eq('phone_e164', phoneE164)
    .not('approved_at', 'is', null)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('approved_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error('Falha ao consultar aprovação manual de OTP', {
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível verificar a aprovação.', {
      cause: error,
    });
  }

  if (!request) return ok(null);

  const { error: consumeError } = await admin
    .from('customer_otp_support_requests')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', request.id)
    .is('consumed_at', null);

  if (consumeError) {
    logger.error('Falha ao consumir aprovação manual de OTP', {
      message: consumeError.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível concluir o acesso.', {
      cause: consumeError,
    });
  }

  const storeId = await requireRequestStoreId();
  if (!storeId.ok) return storeId;

  const customer = await upsertCustomerFromPhone(phoneE164, storeId.data);
  if (!customer.ok) return customer;

  const session = await establishCustomerSession(customer.data.userId);
  if (!session.ok) return session;

  return ok({
    customer: customer.data.identity,
    accessToken: session.data.accessToken,
    refreshToken: session.data.refreshToken,
  });
}
