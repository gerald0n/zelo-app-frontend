import 'server-only';

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { logger } from '@/lib/logger';
import { getMercadoPagoWebhookSecret } from '@/config/env';

type ParsedSignature = { ts: string; v1: string };

function parseSignatureHeader(header: string | null): ParsedSignature | null {
  if (!header) return null;
  let ts = '';
  let v1 = '';
  for (const part of header.split(',')) {
    const [rawKey, rawValue] = part.split('=');
    const key = rawKey?.trim();
    const value = rawValue?.trim();
    if (!key || !value) continue;
    if (key === 'ts') ts = value;
    else if (key === 'v1') v1 = value;
  }
  if (!ts || !v1) return null;
  return { ts, v1 };
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Valida o header `x-signature` do webhook do Mercado Pago.
 * Manifesto: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * (segmentos ausentes são omitidos, inclusive o rótulo).
 */
export function verifyWebhookSignature(params: {
  signatureHeader: string | null;
  requestIdHeader: string | null;
  dataId: string | null;
}): boolean {
  const secret = getMercadoPagoWebhookSecret();
  if (!secret) {
    logger.error('MERCADOPAGO_WEBHOOK_SECRET ausente; webhook rejeitado');
    return false;
  }

  const parsed = parseSignatureHeader(params.signatureHeader);
  if (!parsed) return false;

  // O Mercado Pago normaliza ids alfanuméricos para minúsculas no manifesto.
  const dataId = params.dataId ? params.dataId.toLowerCase() : null;

  let manifest = '';
  if (dataId) manifest += `id:${dataId};`;
  if (params.requestIdHeader) {
    manifest += `request-id:${params.requestIdHeader};`;
  }
  manifest += `ts:${parsed.ts};`;

  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  return safeEqualHex(expected, parsed.v1);
}

/** Chave de idempotência avulsa para chamadas que não têm um pedido de origem. */
export function newIdempotencyKey(): string {
  return randomUUID();
}
