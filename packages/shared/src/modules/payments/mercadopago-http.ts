import 'server-only';

import { getMercadoPagoAccessToken } from '@/config/env';

const API_BASE = 'https://api.mercadopago.com';
const REQUEST_TIMEOUT_MS = 10_000;

export function accessToken(): string | undefined {
  return getMercadoPagoAccessToken();
}

/**
 * `fetch` para a API do Mercado Pago já com Authorization, timeout e, quando
 * informado, a `X-Idempotency-Key`. `headers` extras sobrescrevem os padrões.
 */
export async function mpFetch(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<Response> {
  const token = accessToken();
  if (!token) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN ausente');
  }
  const { idempotencyKey, headers, ...rest } = init;
  return fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
}
