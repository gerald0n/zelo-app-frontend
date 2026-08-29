import { err, ok, type Result } from '@/lib/errors';
import {
  getTurnstileSecretKey,
  hasTurnstileConfig,
  isProductionLike,
} from '@/config/env';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(
  token: string | undefined,
  ip: string,
): Promise<Result<true>> {
  if (!hasTurnstileConfig()) {
    if (isProductionLike()) {
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Proteção contra bots não configurada.',
      );
    }
    return ok(true);
  }

  const secret = getTurnstileSecretKey();
  if (!secret || !token?.trim()) {
    return err('VALIDATION_ERROR', 'Confirme que você não é um robô.');
  }

  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token.trim());
    if (ip && ip !== 'unknown') body.set('remoteip', ip);

    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
    } | null;
    if (!payload?.success) {
      return err('VALIDATION_ERROR', 'Confirme que você não é um robô.');
    }
    return ok(true);
  } catch (cause) {
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Não foi possível validar a proteção contra bots.',
      { cause },
    );
  }
}
