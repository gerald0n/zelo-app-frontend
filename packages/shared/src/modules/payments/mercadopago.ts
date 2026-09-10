import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { accessToken, mpFetch } from '@/modules/payments/mercadopago-http';
import {
  firstPayment,
  normalizePaymentStatus,
  paymentFinancials,
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

function amountString(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Converte minutos em duração ISO 8601 (`PT30M`). */
function isoDuration(minutes: number): string {
  return `PT${Math.max(1, Math.round(minutes))}M`;
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
      return err(
        'INTEGRATION_UNAVAILABLE',
        'Falha ao consultar pagamento Pix.',
      );
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

export type PaymentFinancials = {
  mpPaymentId: string;
  feeCents: number | null;
  netCents: number | null;
};

/**
 * Consulta um pagamento e extrai taxa/líquido reais
 * (`GET /v1/payments/{id}` — `fee_details`, `transaction_details`).
 * Retorna `null` quando o pagamento não é encontrado ou não tem os campos.
 */
export async function getMercadoPagoPaymentFinancials(
  paymentId: string,
): Promise<Result<PaymentFinancials | null>> {
  try {
    const response = await mpFetch(
      `/v1/payments/${encodeURIComponent(paymentId)}`,
    );
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok || !json || typeof json !== 'object') {
      return err('INTEGRATION_UNAVAILABLE', 'Falha ao consultar pagamento.');
    }
    const payment = json as MpPayment;
    const { feeCents, netCents } = paymentFinancials(payment);
    return ok({
      mpPaymentId: payment.id ? String(payment.id) : paymentId,
      feeCents,
      netCents,
    });
  } catch (cause) {
    return err('INTEGRATION_UNAVAILABLE', 'Falha ao consultar pagamento.', {
      cause,
    });
  }
}

type MpRefund = { id?: string; status?: string; status_detail?: string };

/** Extrai o primeiro refund de qualquer um dos formatos que o MP devolve. */
function firstRefund(json: unknown): MpRefund | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const order = json as MpOrder & {
    refunds?: MpRefund[];
    transactions?: { refunds?: MpRefund[]; payments?: MpPayment[] };
  };
  return (
    order.transactions?.refunds?.[0] ??
    order.refunds?.[0] ??
    (order.transactions?.payments?.[0] as { refunds?: MpRefund[] } | undefined)
      ?.refunds?.[0]
  );
}

/** O refund de Pix costuma nascer `in_process`/`pending` (contingência Bacen). */
function isRefundAccepted(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase();
  return (
    s === 'refunded' ||
    s === 'approved' ||
    s === 'processed' ||
    s === 'in_process' ||
    s === 'pending'
  );
}

/**
 * Estorno total de uma ordem paga (`POST /v1/orders/{id}/refund`, sem body).
 * Devolve o id da transação de refund criada pelo Mercado Pago.
 *
 * O header `X-Render-In-Process-Refunds` faz o MP responder `201` com
 * `status: in_process` quando o estorno Pix cai em contingência, em vez de um
 * `400` genérico — sem ele, um estorno que na verdade foi aceito era tratado
 * aqui como falha e nunca chegava a marcar o pedido.
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
      {
        method: 'POST',
        idempotencyKey,
        headers: { 'X-Render-In-Process-Refunds': 'true' },
      },
    );
    const json: unknown = await response.json().catch(() => null);
    const refund = firstRefund(json);

    if (!response.ok) {
      // Contingência do Pix: o MP às vezes devolve 4xx mesmo tendo aceitado o
      // estorno. Se o corpo traz um refund em andamento, seguimos em frente.
      if (isRefundAccepted(refund?.status)) {
        return ok({
          refundId: refund?.id ?? null,
          status: refund?.status ?? null,
        });
      }
      logger.error('Mercado Pago recusou o estorno', {
        mpOrderId,
        status: response.status,
        mpBody:
          json && typeof json === 'object'
            ? JSON.stringify(json).slice(0, 500)
            : String(json),
      });
      return err('INTEGRATION_UNAVAILABLE', 'Não foi possível estornar o Pix.');
    }

    const order = (json ?? {}) as MpOrder;
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
