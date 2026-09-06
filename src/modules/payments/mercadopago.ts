import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getMercadoPagoAccessToken } from '@/config/env';
import {
  firstPayment,
  normalizePaymentStatus,
  snapshotFromOrder,
  type MercadoPagoSnapshot,
  type MpOrder,
  type MpPayment,
  type PixCharge,
} from '@/modules/payments/mercadopago-types';

export {
  normalizePaymentStatus,
  type MercadoPagoSnapshot,
  type NormalizedPaymentStatus,
  type PixCharge,
} from '@/modules/payments/mercadopago-types';
export {
  newIdempotencyKey,
  verifyWebhookSignature,
} from '@/modules/payments/mercadopago-signature';

const API_BASE = 'https://api.mercadopago.com';
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_EXPIRATION_MINUTES = 30;

type CreatePixChargeInput = {
  /** UUID do pedido — vira o `external_reference` no Mercado Pago. */
  orderId: string;
  amountCents: number;
  payerEmail: string;
  description?: string;
  expirationMinutes?: number;
  /**
   * Número da tentativa (>= 1). Entra na `X-Idempotency-Key` para que cada
   * "gerar novo código" crie uma ordem nova sem duplicar a anterior.
   */
  attempt?: number;
};

const UNAVAILABLE_MESSAGE =
  'Não foi possível gerar a cobrança Pix. Tente outra forma de pagamento.';

function accessToken(): string | undefined {
  return getMercadoPagoAccessToken();
}

function amountString(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Converte minutos em duração ISO 8601 (`PT30M`). */
function isoDuration(minutes: number): string {
  return `PT${Math.max(1, Math.round(minutes))}M`;
}

async function mpFetch(
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

/**
 * Cria uma ordem Pix no Mercado Pago e devolve o QR (imagem + copia e cola).
 * O `X-Idempotency-Key` é derivado do `orderId`, então reenviar a mesma
 * criação não gera cobrança duplicada.
 */
export async function createPixCharge(
  input: CreatePixChargeInput,
): Promise<Result<PixCharge>> {
  if (!accessToken()) {
    return err('INTEGRATION_UNAVAILABLE', UNAVAILABLE_MESSAGE);
  }

  const minutes = input.expirationMinutes ?? DEFAULT_EXPIRATION_MINUTES;
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const amount = amountString(input.amountCents);

  const body = {
    type: 'online',
    total_amount: amount,
    external_reference: input.orderId,
    processing_mode: 'automatic',
    transactions: {
      payments: [
        {
          amount,
          payment_method: { id: 'pix', type: 'bank_transfer' },
          expiration_time: isoDuration(minutes),
        },
      ],
    },
    payer: { email: input.payerEmail },
    ...(input.description
      ? { description: input.description.slice(0, 256) }
      : {}),
  };

  let response: Response;
  try {
    response = await mpFetch('/v1/orders', {
      method: 'POST',
      body: JSON.stringify(body),
      // Chave estável por tentativa — reenvio da mesma tentativa não duplica a
      // cobrança; "gerar novo código" (attempt+1) cria uma ordem nova.
      idempotencyKey: `order-${input.orderId}-${input.attempt ?? 1}`,
    });
  } catch (cause) {
    logger.error('Erro de rede ao criar cobrança Pix no Mercado Pago', {
      orderId: input.orderId,
      message: cause instanceof Error ? cause.message : 'unknown',
    });
    return err('INTEGRATION_UNAVAILABLE', UNAVAILABLE_MESSAGE, { cause });
  }

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    logger.error('Mercado Pago recusou a criação da cobrança Pix', {
      orderId: input.orderId,
      status: response.status,
      mpError:
        json && typeof json === 'object'
          ? (json as { message?: string }).message
          : undefined,
    });
    return err('INTEGRATION_UNAVAILABLE', UNAVAILABLE_MESSAGE);
  }

  const order = (json ?? {}) as MpOrder;
  const payment = firstPayment(order);
  const method = payment?.payment_method;

  if (!order.id || !method?.qr_code || !method?.qr_code_base64) {
    logger.error('Resposta da Orders API sem QR Pix', {
      orderId: input.orderId,
      mpOrderId: order.id,
    });
    return err('INTEGRATION_UNAVAILABLE', UNAVAILABLE_MESSAGE);
  }

  return ok({
    mpOrderId: order.id,
    mpPaymentId: payment?.id ?? null,
    qrCode: method.qr_code,
    qrCodeBase64: method.qr_code_base64,
    ticketUrl: method.ticket_url ?? null,
    expiresAt,
    status: normalizePaymentStatus(payment?.status ?? order.status),
  });
}

/** Consulta o estado atual de uma ordem (`ORD...`) no Mercado Pago. */
export async function getMercadoPagoOrder(
  mpOrderId: string,
): Promise<Result<MercadoPagoSnapshot>> {
  try {
    const response = await mpFetch(
      `/v1/orders/${encodeURIComponent(mpOrderId)}`,
    );
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return err('INTEGRATION_UNAVAILABLE', 'Falha ao consultar ordem Pix.');
    }
    return ok(snapshotFromOrder((json ?? {}) as MpOrder));
  } catch (cause) {
    return err('INTEGRATION_UNAVAILABLE', 'Falha ao consultar ordem Pix.', {
      cause,
    });
  }
}

/**
 * Consulta um pagamento (`PAY...` / id numérico) no Mercado Pago.
 * A notificação de webhook às vezes traz o id do pagamento, não o da ordem.
 */
export async function getMercadoPagoPayment(
  paymentId: string,
): Promise<Result<MercadoPagoSnapshot>> {
  try {
    const response = await mpFetch(
      `/v1/payments/${encodeURIComponent(paymentId)}`,
    );
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return err('INTEGRATION_UNAVAILABLE', 'Falha ao consultar pagamento Pix.');
    }
    const payment = (json ?? {}) as MpPayment & {
      order?: { id?: string };
      date_approved?: string;
    };
    return ok({
      mpOrderId: payment.order?.id ?? null,
      mpPaymentId: payment.id ?? paymentId,
      externalReference: payment.external_reference ?? null,
      status: normalizePaymentStatus(payment.status),
      rawStatus: payment.status ?? null,
      rawStatusDetail: payment.status_detail ?? null,
    });
  } catch (cause) {
    return err('INTEGRATION_UNAVAILABLE', 'Falha ao consultar pagamento Pix.', {
      cause,
    });
  }
}

/**
 * Estorno total de uma ordem paga (`POST /v1/orders/{id}/refund`, sem body).
 * Devolve o id da transação de refund criada pelo Mercado Pago.
 */
export async function refundMercadoPagoOrder(
  mpOrderId: string,
  idempotencyKey: string,
): Promise<Result<{ refundId: string | null; status: string | null }>> {
  if (!accessToken()) {
    return err('INTEGRATION_UNAVAILABLE', 'Estorno indisponível no momento.');
  }
  try {
    const response = await mpFetch(
      `/v1/orders/${encodeURIComponent(mpOrderId)}/refund`,
      { method: 'POST', idempotencyKey },
    );
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      logger.error('Mercado Pago recusou o estorno', {
        mpOrderId,
        status: response.status,
        mpError:
          json && typeof json === 'object'
            ? (json as { message?: string }).message
            : undefined,
      });
      return err('INTEGRATION_UNAVAILABLE', 'Não foi possível estornar o Pix.');
    }
    const order = (json ?? {}) as MpOrder & {
      transactions?: { refunds?: Array<{ id?: string; status?: string }> };
    };
    const refund = order.transactions?.refunds?.[0];
    return ok({
      refundId: refund?.id ?? null,
      status: refund?.status ?? order.status ?? null,
    });
  } catch (cause) {
    return err('INTEGRATION_UNAVAILABLE', 'Não foi possível estornar o Pix.', {
      cause,
    });
  }
}
