import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  getTwilioAccountSid,
  getTwilioAuthToken,
  getTwilioOtpServiceSid,
  getTwilioVerifyServiceSid,
  getTwilioVerifySmsServiceSid,
} from '@/config/env';

const REQUEST_TIMEOUT_MS = 8_000;
const VERIFY_API_BASE = 'https://verify.twilio.com/v2';

export const TWILIO_VERIFY_SENTINEL = 'twilio-verify';

export type TwilioVerifyChannel = 'sms';

const UNAVAILABLE_MESSAGE = 'Não foi possível enviar o código.';

function userMessageForTwilioCode(code: number | undefined): string {
  switch (code) {
    case 60202:
      return 'Muitas tentativas. Solicite um novo código.';
    case 60203:
      return 'Muitas tentativas. Aguarde alguns minutos para pedir um novo código.';
    case 60223:
      return 'O canal SMS está desligado no serviço Twilio Verify.';
    case 60205:
      return 'O número informado não é um celular válido para SMS.';
    case 21408:
      return 'A Twilio não está autorizada a enviar SMS para este país. Ative o Brasil em Messaging > Geo Permissions.';
    case 21608:
      return 'Este celular ainda não está verificado na conta trial da Twilio.';
    default:
      return UNAVAILABLE_MESSAGE;
  }
}

function sanitizeTwilioMessage(
  message: string | undefined,
): string | undefined {
  if (!message) return undefined;
  return message.replace(/\+?\d{8,}/g, '[redacted]');
}

function readTwilioError(payload: unknown): {
  code?: number;
  message?: string;
} {
  if (!payload || typeof payload !== 'object') return {};
  const body = payload as { code?: unknown; message?: unknown };
  return {
    code: typeof body.code === 'number' ? body.code : undefined,
    message: typeof body.message === 'string' ? body.message : undefined,
  };
}

function basicAuth(accountSid: string, authToken: string): string {
  return Buffer.from(`${accountSid}:${authToken}`).toString('base64');
}

function verifyConfig(
  serviceSidOverride?: string,
): { accountSid: string; authToken: string; serviceSid: string } | undefined {
  const accountSid = getTwilioAccountSid();
  const authToken = getTwilioAuthToken();
  const serviceSid = serviceSidOverride || getTwilioVerifyServiceSid();
  if (!accountSid || !authToken || !serviceSid) return undefined;
  return { accountSid, authToken, serviceSid };
}

async function verifyFetch(
  path: string,
  config: { accountSid: string; authToken: string },
  body: URLSearchParams,
): Promise<Response> {
  return fetch(`${VERIFY_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth(config.accountSid, config.authToken)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
}

export function twilioVerifyHashForService(serviceSid: string): string {
  return `${TWILIO_VERIFY_SENTINEL}:${serviceSid}`;
}

export function isTwilioVerifyHash(codeHash: string): boolean {
  return (
    codeHash === TWILIO_VERIFY_SENTINEL ||
    codeHash.startsWith(`${TWILIO_VERIFY_SENTINEL}:`)
  );
}

export function serviceSidFromTwilioVerifyHash(
  codeHash: string,
): string | undefined {
  const prefix = `${TWILIO_VERIFY_SENTINEL}:`;
  if (!codeHash.startsWith(prefix)) return undefined;
  const sid = codeHash.slice(prefix.length).trim();
  return sid.startsWith('VA') ? sid : undefined;
}

export async function startTwilioVerification(
  phoneE164: string,
  channel: TwilioVerifyChannel,
  serviceSidOverride?: string,
): Promise<Result<{ serviceSid: string }>> {
  const config = verifyConfig(serviceSidOverride);
  if (!config) {
    return err(
      'INTEGRATION_UNAVAILABLE',
      'SMS não configurado para envio de código.',
    );
  }

  const body = new URLSearchParams();
  body.set('To', phoneE164);
  body.set('Channel', channel);
  body.set('Locale', 'pt');

  try {
    const response = await verifyFetch(
      `/Services/${encodeURIComponent(config.serviceSid)}/Verifications`,
      config,
      body,
    );

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const { code: twilioCode, message: twilioMessage } =
        readTwilioError(payload);
      logger.error(
        `Falha ao iniciar verificação ${channel} via Twilio Verify`,
        {
          status: response.status,
          twilioCode,
          twilioMessage: sanitizeTwilioMessage(twilioMessage),
        },
      );
      return err(
        'INTEGRATION_UNAVAILABLE',
        userMessageForTwilioCode(twilioCode),
      );
    }

    return ok({ serviceSid: config.serviceSid });
  } catch (cause) {
    logger.error(
      `Erro de rede ao iniciar verificação ${channel} via Twilio Verify`,
      {
        message: cause instanceof Error ? cause.message : 'unknown',
      },
    );
    return err('INTEGRATION_UNAVAILABLE', UNAVAILABLE_MESSAGE, { cause });
  }
}

async function checkOnService(
  phoneE164: string,
  code: string,
  serviceSid: string,
): Promise<Result<true>> {
  const config = verifyConfig(serviceSid);
  if (!config) {
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Envio de código ainda não está configurado.',
    );
  }

  const body = new URLSearchParams();
  body.set('To', phoneE164);
  body.set('Code', code);

  try {
    const response = await verifyFetch(
      `/Services/${encodeURIComponent(config.serviceSid)}/VerificationCheck`,
      config,
      body,
    );

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const { code: twilioCode, message: twilioMessage } =
        readTwilioError(payload);
      logger.error('Falha ao validar código via Twilio Verify', {
        status: response.status,
        twilioCode,
        twilioMessage: sanitizeTwilioMessage(twilioMessage),
      });
      if (response.status === 404 || twilioCode === 20404) {
        return err('OTP_INVALID', 'Código expirado. Solicite um novo.');
      }
      if (twilioCode === 60202) {
        return err(
          'OTP_INVALID',
          'Muitas tentativas. Solicite um novo código.',
        );
      }
      return err(
        'INTEGRATION_UNAVAILABLE',
        userMessageForTwilioCode(twilioCode),
      );
    }

    const status =
      payload &&
      typeof payload === 'object' &&
      'status' in payload &&
      typeof payload.status === 'string'
        ? payload.status
        : undefined;

    if (status !== 'approved') {
      return err('OTP_INVALID', 'Código inválido.');
    }

    return ok(true);
  } catch (cause) {
    logger.error('Erro de rede ao validar código via Twilio Verify', {
      message: cause instanceof Error ? cause.message : 'unknown',
    });
    return err('INTEGRATION_UNAVAILABLE', UNAVAILABLE_MESSAGE, { cause });
  }
}

export async function checkTwilioVerification(
  phoneE164: string,
  code: string,
  serviceSid?: string,
): Promise<Result<true>> {
  if (serviceSid) {
    return checkOnService(phoneE164, code, serviceSid);
  }

  const primary = getTwilioOtpServiceSid();
  if (!primary) {
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Envio de código ainda não está configurado.',
    );
  }

  const first = await checkOnService(phoneE164, code, primary);
  if (first.ok || first.error.code !== 'OTP_INVALID') return first;

  const other =
    getTwilioVerifySmsServiceSid() === primary
      ? getTwilioVerifyServiceSid()
      : getTwilioVerifySmsServiceSid();
  if (!other || other === primary) return first;
  if (first.error.message !== 'Código expirado. Solicite um novo.') {
    return first;
  }

  return checkOnService(phoneE164, code, other);
}
