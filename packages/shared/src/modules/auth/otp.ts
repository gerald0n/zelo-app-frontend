import 'server-only';

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { getAppEnv, getOtpHashSecret, hasTwilioVerifyConfig } from '@/config/env';
import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { toPhoneE164 } from '@/lib/phone';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { deliverCustomerOtp } from '@/modules/auth/otp-delivery';
import { establishCustomerSession } from '@/modules/auth/establish-session';
import type { CustomerIdentity } from '@/modules/auth/customer-identity';
import { requireRequestStoreId } from '@/modules/tenant/resolve-store-id';
import {
  TWILIO_VERIFY_SENTINEL,
  checkTwilioVerification,
  isTwilioVerifyHash,
  serviceSidFromTwilioVerifyHash,
  twilioVerifyHashForService,
} from '@/modules/notifications/twilio-verify';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

export type SendOtpResult = {
  expiresInSeconds: number;
  debugCode?: string;
  deliveredVia?: 'sms' | 'debug';
};

export type VerifyOtpResult = {
  customer: CustomerIdentity;
  accessToken: string;
  refreshToken: string;
};

function hashOtp(phoneE164: string, code: string): string {
  return createHmac('sha256', getOtpHashSecret())
    .update(`${phoneE164}:${code}`)
    .digest('hex');
}

/** Comparação em tempo constante de dois hashes hex. */
function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function sendCustomerOtp(options: {
  phone: string;
}): Promise<Result<SendOtpResult>> {
  const phoneE164 = toPhoneE164(options.phone);
  if (!phoneE164) {
    return err('VALIDATION_ERROR', 'Informe um celular válido com DDD.');
  }

  const admin = createAdminSupabaseClient();
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from('customer_otp_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('phone_e164', phoneE164)
    .gte('created_at', sinceHour);

  if (countError) {
    logger.error('Falha ao contar desafios OTP', {
      message: countError.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível enviar o código.', {
      cause: countError,
    });
  }
  if ((count ?? 0) >= MAX_SENDS_PER_HOUR) {
    return err(
      'VALIDATION_ERROR',
      'Muitas tentativas. Aguarde alguns minutos para pedir um novo código.',
    );
  }

  const { data: latest } = await admin
    .from('customer_otp_challenges')
    .select('created_at')
    .eq('phone_e164', phoneE164)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.created_at) {
    const elapsed = Date.now() - new Date(latest.created_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return err(
        'VALIDATION_ERROR',
        `Aguarde ${wait}s para reenviar o código.`,
      );
    }
  }

  const useTwilioVerify = hasTwilioVerifyConfig();
  const debugCode = useTwilioVerify ? undefined : generateCode();
  const { data: challenge, error: insertError } = await admin
    .from('customer_otp_challenges')
    .insert({
      phone_e164: phoneE164,
      name: '',
      code_hash: useTwilioVerify
        ? TWILIO_VERIFY_SENTINEL
        : hashOtp(phoneE164, debugCode ?? ''),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !challenge) {
    logger.error('Falha ao gravar desafio OTP', {
      message: insertError?.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível enviar o código.', {
      cause: insertError,
    });
  }

  const delivered = await deliverCustomerOtp(phoneE164);
  if (!delivered.ok) return delivered;

  if (delivered.data.serviceSid) {
    await admin
      .from('customer_otp_challenges')
      .update({
        code_hash: twilioVerifyHashForService(delivered.data.serviceSid),
      })
      .eq('id', challenge.id);
  }

  return ok({
    expiresInSeconds: OTP_TTL_MS / 1000,
    deliveredVia: delivered.data.deliveredVia,
    debugCode:
      delivered.data.deliveredVia === 'debug' &&
      debugCode &&
      getAppEnv() !== 'production'
        ? debugCode
        : undefined,
  });
}

export async function verifyCustomerOtp(options: {
  phone: string;
  code: string;
}): Promise<Result<VerifyOtpResult>> {
  const phoneE164 = toPhoneE164(options.phone);
  const code = options.code.replace(/\D/g, '');
  if (!phoneE164) {
    return err('VALIDATION_ERROR', 'Informe um celular válido com DDD.');
  }
  if (code.length !== 6) {
    return err('OTP_INVALID', 'Código inválido.');
  }

  const admin = createAdminSupabaseClient();
  const { data: challenge, error: challengeError } = await admin
    .from('customer_otp_challenges')
    .select('id, code_hash, expires_at, attempt_count, consumed_at')
    .eq('phone_e164', phoneE164)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (challengeError) {
    logger.error('Falha ao ler desafio OTP', {
      message: challengeError.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível validar o código.', {
      cause: challengeError,
    });
  }

  if (!challenge) {
    return err('OTP_INVALID', 'Código expirado. Solicite um novo.');
  }

  if (challenge.attempt_count >= MAX_ATTEMPTS) {
    return err('OTP_INVALID', 'Muitas tentativas. Solicite um novo código.');
  }

  await admin
    .from('customer_otp_challenges')
    .update({ attempt_count: challenge.attempt_count + 1 })
    .eq('id', challenge.id);

  if (isTwilioVerifyHash(challenge.code_hash)) {
    const checked = await checkTwilioVerification(
      phoneE164,
      code,
      serviceSidFromTwilioVerifyHash(challenge.code_hash),
    );
    if (!checked.ok) return checked;
  } else if (!hashesMatch(challenge.code_hash, hashOtp(phoneE164, code))) {
    return err('OTP_INVALID', 'Código inválido.');
  }

  await admin
    .from('customer_otp_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', challenge.id);

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

/**
 * Resolve (ou cria) o perfil de cliente da loja atual pra este telefone.
 *
 * Identidade de login (telefone -> `auth.users`) é compartilhada entre
 * tenants — `auth.users.phone`/`email` têm unique constraint global no
 * schema do GoTrue, não dá pra tornar isso por tenant sem mexer em schema
 * que não é nosso. O que é por tenant é o PERFIL (`customers`): mesmo
 * telefone pode ter um perfil por loja, cada um com seu próprio `id`
 * (dono de carrinho/pedidos daquela loja) — ver ADR-0001, Fase C.
 */
export async function upsertCustomerFromPhone(
  phoneE164: string,
  storeId: string,
): Promise<Result<{ identity: CustomerIdentity; userId: string }>> {
  const admin = createAdminSupabaseClient();
  const existingProfile = await admin
    .from('customers')
    .select('id, user_id, name, phone_e164')
    .eq('phone_e164', phoneE164)
    .eq('store_id', storeId)
    .maybeSingle();

  if (existingProfile.error) {
    logger.error('Falha ao buscar cliente por telefone', {
      message: existingProfile.error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível concluir o login.', {
      cause: existingProfile.error,
    });
  }

  if (existingProfile.data) {
    return ok({
      identity: {
        id: existingProfile.data.id,
        phoneE164: existingProfile.data.phone_e164,
        name: existingProfile.data.name,
      },
      userId: existingProfile.data.user_id,
    });
  }

  const digits = phoneE164.replace(/\D/g, '');
  const email = `c${digits}@customers.zelo.internal`;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    phone: phoneE164,
    phone_confirm: true,
  });

  let userId = created.data.user?.id;
  if (created.error || !userId) {
    const alreadyExists = /already|exists|registered|duplicate/i.test(
      created.error?.message ?? '',
    );
    if (!alreadyExists) {
      logger.error('Falha ao criar usuário Auth do cliente', {
        message: created.error?.message,
      });
      return err('INTERNAL_ERROR', 'Não foi possível criar a conta.', {
        cause: created.error,
      });
    }

    // Já existe um `auth.users` pra esse telefone (login em outro tenant) —
    // reaproveita a mesma identidade, só cria o perfil (`customers`) novo
    // pra esta loja.
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = listed.data.users.find(
      (user) => user.phone === phoneE164 || user.email === email,
    );
    if (!match) {
      return err('INTERNAL_ERROR', 'Não foi possível localizar a conta.');
    }
    userId = match.id;
  }

  const inserted = await admin
    .from('customers')
    .insert({
      user_id: userId,
      store_id: storeId,
      name: '',
      phone_e164: phoneE164,
      email,
    })
    .select('id, name, phone_e164')
    .single();

  if (inserted.error || !inserted.data) {
    if (inserted.error?.code === '23505') {
      // Corrida: outra verificação concorrente já criou o perfil desta loja
      // pro mesmo telefone entre o select acima e este insert.
      const retry = await admin
        .from('customers')
        .select('id, name, phone_e164')
        .eq('user_id', userId)
        .eq('store_id', storeId)
        .maybeSingle();
      if (retry.data) {
        return ok({
          identity: {
            id: retry.data.id,
            phoneE164: retry.data.phone_e164,
            name: retry.data.name,
          },
          userId,
        });
      }
    }
    logger.error('Falha ao gravar perfil do cliente', {
      message: inserted.error?.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível criar a conta.', {
      cause: inserted.error,
    });
  }

  return ok({
    identity: {
      id: inserted.data.id,
      phoneE164: inserted.data.phone_e164,
      name: inserted.data.name,
    },
    userId,
  });
}
