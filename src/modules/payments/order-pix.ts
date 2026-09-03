import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { resolveCustomerForCheckout } from '@/modules/orders/customer';
import {
  createPixCharge,
  getMercadoPagoOrder,
  getMercadoPagoPayment,
  refundMercadoPagoOrder,
  type MercadoPagoSnapshot,
  type NormalizedPaymentStatus,
} from '@/modules/payments/mercadopago';

/**
 * E-mail do pagador exigido pela Orders API. O cliente se identifica no app do
 * banco na hora de pagar o Pix, então quando não temos o e-mail real usamos um
 * endereço sintético só para satisfazer a API.
 */
function payerEmailFor(customer: {
  id: string;
  email?: string | null;
}): string {
  const raw = customer.email?.trim();
  if (raw && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) return raw;
  return `cliente+${customer.id}@zeloconfeitaria.com.br`;
}

export type OrderPixCharge = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string | null;
  expiresAt: string;
};

/** Estado da cobrança Pix visto pela tela de pagamento do cliente. */
export type OrderPixView = {
  orderId: string;
  orderNumber: number;
  totalCents: number;
  status: string;
  paymentStatus: string;
  pix: OrderPixCharge | null;
};

async function persistCharge(
  orderId: string,
  charge: {
    mpOrderId: string;
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl: string | null;
    expiresAt: string;
  },
  attempt: number,
): Promise<Result<OrderPixCharge>> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('orders')
    .update({
      mp_order_id: charge.mpOrderId,
      pix_qr_code: charge.qrCode,
      pix_qr_code_base64: charge.qrCodeBase64,
      pix_ticket_url: charge.ticketUrl,
      pix_expires_at: charge.expiresAt,
      pix_attempt: attempt,
    })
    .eq('id', orderId);

  if (error) {
    logger.error('Cobrança Pix criada mas falhou ao gravar no pedido', {
      orderId,
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Falha ao registrar a cobrança Pix.', {
      cause: error,
    });
  }

  return ok({
    qrCode: charge.qrCode,
    qrCodeBase64: charge.qrCodeBase64,
    ticketUrl: charge.ticketUrl,
    expiresAt: charge.expiresAt,
  });
}

/**
 * Cria a cobrança Pix no Mercado Pago para um pedido recém-criado e grava o QR
 * (imagem + copia e cola) na linha do pedido. Idempotente por tentativa: a
 * Orders API usa `X-Idempotency-Key = order-<id>-<attempt>`.
 */
export async function createOrderPixCharge(input: {
  orderId: string;
  orderNumber: number;
  totalCents: number;
  customer: { id: string; email?: string | null };
}): Promise<Result<OrderPixCharge>> {
  const charge = await createPixCharge({
    orderId: input.orderId,
    amountCents: input.totalCents,
    payerEmail: payerEmailFor(input.customer),
    description: `Pedido #${input.orderNumber} — Zelo`,
    attempt: 1,
  });
  if (!charge.ok) return charge;

  return persistCharge(input.orderId, charge.data, 1);
}

type OwnedOrderRow = {
  id: string;
  order_number: number;
  total_cents: number;
  status: string;
  payment_method: string;
  payment_status: string;
  mp_order_id: string | null;
  pix_attempt: number;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  pix_ticket_url: string | null;
  pix_expires_at: string | null;
};

const OWNED_ORDER_SELECT =
  'id, order_number, total_cents, status, payment_method, payment_status, mp_order_id, pix_attempt, pix_qr_code, pix_qr_code_base64, pix_ticket_url, pix_expires_at';

/** Carrega um pedido garantindo que ele pertence ao cliente autenticado. */
async function loadOwnedOrder(orderId: string): Promise<Result<OwnedOrderRow>> {
  const identity = await resolveCustomerForCheckout();
  if (!identity.ok) return identity;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('orders')
    .select(OWNED_ORDER_SELECT)
    .eq('id', orderId)
    .eq('customer_id', identity.data.id)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Falha ao carregar o pedido.', {
      cause: error,
    });
  }
  if (!data) {
    return err('NOT_FOUND', 'Pedido não encontrado.');
  }
  return ok(data as OwnedOrderRow);
}

function viewFromRow(row: OwnedOrderRow): OrderPixView {
  const hasQr = Boolean(row.pix_qr_code && row.pix_qr_code_base64);
  return {
    orderId: row.id,
    orderNumber: row.order_number,
    totalCents: row.total_cents,
    status: row.status,
    paymentStatus: row.payment_status,
    pix:
      hasQr && row.pix_expires_at
        ? {
            qrCode: row.pix_qr_code as string,
            qrCodeBase64: row.pix_qr_code_base64 as string,
            ticketUrl: row.pix_ticket_url,
            expiresAt: row.pix_expires_at,
          }
        : null,
  };
}

/**
 * Só aceitamos operar a cobrança Pix de pedidos do fluxo dinâmico (Orders API),
 * que têm `mp_order_id`. Pedidos Pix antigos (fluxo manual: copia e cola +
 * WhatsApp) nunca tiveram cobrança no Mercado Pago e não devem gerar uma agora.
 */
function ensureDynamicPixOrder(row: OwnedOrderRow): Result<null> {
  if (row.payment_method !== 'pix') {
    return err('VALIDATION_ERROR', 'Este pedido não é Pix.');
  }
  if (!row.mp_order_id) {
    return err('VALIDATION_ERROR', 'Este pedido não tem cobrança Pix.');
  }
  return ok(null);
}

/** Estado atual da cobrança Pix de um pedido (para a tela de pagamento). */
export async function getOrderPixView(
  orderId: string,
): Promise<Result<OrderPixView>> {
  const owned = await loadOwnedOrder(orderId);
  if (!owned.ok) return owned;
  const guard = ensureDynamicPixOrder(owned.data);
  if (!guard.ok) return guard;
  return ok(viewFromRow(owned.data));
}

/**
 * Gera um novo código Pix para um pedido cujo código anterior expirou. Só é
 * permitido enquanto o pagamento está pendente e o pedido não saiu de "received".
 */
export async function regenerateOrderPixCharge(
  orderId: string,
): Promise<Result<OrderPixView>> {
  const owned = await loadOwnedOrder(orderId);
  if (!owned.ok) return owned;
  const row = owned.data;

  const guard = ensureDynamicPixOrder(row);
  if (!guard.ok) return guard;
  if (row.payment_status === 'confirmed') {
    return ok(viewFromRow(row));
  }
  if (row.payment_status !== 'pending' || row.status !== 'received') {
    return err(
      'VALIDATION_ERROR',
      'Este pedido não aceita mais um novo código Pix.',
    );
  }

  // Ainda válido? Não gera outro à toa.
  if (
    row.pix_qr_code &&
    row.pix_expires_at &&
    new Date(row.pix_expires_at).getTime() > Date.now() + 30_000
  ) {
    return ok(viewFromRow(row));
  }

  const attempt = row.pix_attempt + 1;
  const charge = await createPixCharge({
    orderId: row.id,
    amountCents: row.total_cents,
    payerEmail: `cliente+${orderId}@zeloconfeitaria.com.br`,
    description: `Pedido #${row.order_number} — Zelo`,
    attempt,
  });
  if (!charge.ok) return charge;

  const persisted = await persistCharge(row.id, charge.data, attempt);
  if (!persisted.ok) return persisted;

  return ok({
    orderId: row.id,
    orderNumber: row.order_number,
    totalCents: row.total_cents,
    status: row.status,
    paymentStatus: row.payment_status,
    pix: persisted.data,
  });
}

// --- Webhook ------------------------------------------------------------------

export type WebhookOutcome =
  | 'confirmed'
  | 'failed'
  | 'refunded'
  | 'pending'
  | 'ignored'
  | 'order_not_found'
  | 'lookup_failed';

type NotificationRef = {
  /** "order" ou "payment". */
  type: string | null;
  /** id do recurso: `ORD...` para order, id numérico para payment. */
  resourceId: string | null;
};

/**
 * Consulta o Mercado Pago para descobrir o estado real do pagamento
 * referenciado pela notificação. Nunca confiamos só no corpo do webhook.
 */
async function resolveSnapshot(
  ref: NotificationRef,
): Promise<Result<MercadoPagoSnapshot>> {
  if (!ref.resourceId) {
    return err('VALIDATION_ERROR', 'Notificação sem id de recurso.');
  }
  if (ref.type === 'payment') {
    return getMercadoPagoPayment(ref.resourceId);
  }
  // Default: tópico "order" (Pix via Orders API).
  return getMercadoPagoOrder(ref.resourceId);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findOrder(snapshot: MercadoPagoSnapshot): Promise<
  Result<{
    id: string;
    paymentStatus: string;
    paymentMethod: string;
  } | null>
> {
  const admin = createAdminSupabaseClient();

  // `external_reference` é sempre o UUID do nosso pedido. Se vier outra coisa
  // (order de teste, integração antiga), ignora esse caminho em vez de deixar
  // o Postgres estourar com "invalid input syntax for type uuid".
  const byRef =
    snapshot.externalReference && UUID_RE.test(snapshot.externalReference)
      ? snapshot.externalReference
      : null;
  if (byRef) {
    const { data, error } = await admin
      .from('orders')
      .select('id, payment_status, payment_method')
      .eq('id', byRef)
      .maybeSingle();
    if (error) {
      return err('INTERNAL_ERROR', 'Falha ao buscar pedido.', { cause: error });
    }
    if (data) {
      return ok({
        id: data.id,
        paymentStatus: data.payment_status,
        paymentMethod: data.payment_method,
      });
    }
  }

  if (snapshot.mpOrderId) {
    const { data, error } = await admin
      .from('orders')
      .select('id, payment_status, payment_method')
      .eq('mp_order_id', snapshot.mpOrderId)
      .maybeSingle();
    if (error) {
      return err('INTERNAL_ERROR', 'Falha ao buscar pedido.', { cause: error });
    }
    if (data) {
      return ok({
        id: data.id,
        paymentStatus: data.payment_status,
        paymentMethod: data.payment_method,
      });
    }
  }

  return ok(null);
}

async function applyStatus(
  orderId: string,
  status: NormalizedPaymentStatus,
  mpOrderId: string | null,
): Promise<Result<WebhookOutcome>> {
  const admin = createAdminSupabaseClient();

  if (status === 'confirmed') {
    const { error } = await admin.rpc('confirm_order_pix_payment', {
      p_order_id: orderId,
      p_mp_order_id: mpOrderId ?? undefined,
    });
    if (error) {
      return err('INTERNAL_ERROR', 'Falha ao confirmar pagamento.', {
        cause: error,
      });
    }
    return ok('confirmed');
  }

  if (status === 'failed') {
    const { error } = await admin.rpc('fail_order_pix_payment', {
      p_order_id: orderId,
      p_reason: 'Pagamento Pix não concluído (Mercado Pago)',
    });
    if (error) {
      return err('INTERNAL_ERROR', 'Falha ao registrar pagamento não pago.', {
        cause: error,
      });
    }
    return ok('failed');
  }

  if (status === 'refunded') {
    // Cobre tanto o webhook disparado pelo nosso próprio estorno quanto um
    // estorno feito direto no painel do Mercado Pago. Idempotente: se o pedido
    // já está `refunded`, a RPC não faz nada.
    const { error } = await admin.rpc('refund_order_pix_payment', {
      p_order_id: orderId,
    });
    if (error) {
      return err('INTERNAL_ERROR', 'Falha ao registrar o estorno.', {
        cause: error,
      });
    }
    return ok('refunded');
  }

  return ok('pending');
}

/**
 * Processa uma notificação já validada do Mercado Pago:
 * consulta o estado real, encontra o pedido e aplica a transição.
 * Grava o evento bruto em `payment_events` (idempotente por `event_id`).
 */
export async function processMercadoPagoNotification(params: {
  eventId: string | null;
  eventType: string | null;
  action: string | null;
  ref: NotificationRef;
  signatureValid: boolean;
  rawPayload: unknown;
}): Promise<Result<WebhookOutcome>> {
  const admin = createAdminSupabaseClient();

  // Idempotência: se já processamos esse event_id, não repete.
  if (params.eventId) {
    const { data: seen } = await admin
      .from('payment_events')
      .select('id, process_result')
      .eq('provider', 'mercadopago')
      .eq('event_id', params.eventId)
      .maybeSingle();
    if (seen?.process_result) {
      return ok('ignored');
    }
  }

  const snapshotResult = await resolveSnapshot(params.ref);

  const eventRow = {
    provider: 'mercadopago',
    event_id: params.eventId,
    event_type: params.eventType,
    action: params.action,
    mp_order_id: snapshotResult.ok ? snapshotResult.data.mpOrderId : null,
    mp_payment_id: snapshotResult.ok ? snapshotResult.data.mpPaymentId : null,
    payload: params.rawPayload as never,
    signature_valid: params.signatureValid,
  };

  if (!snapshotResult.ok) {
    await admin.from('payment_events').upsert(
      {
        ...eventRow,
        process_result: 'lookup_failed',
        processed_at: new Date().toISOString(),
      },
      { onConflict: 'provider,event_id' },
    );
    return ok('lookup_failed');
  }

  const snapshot = snapshotResult.data;
  const orderResult = await findOrder(snapshot);
  if (!orderResult.ok) {
    // Erro transitório de banco: não grava resultado, deixa o MP re-tentar.
    return orderResult;
  }

  if (!orderResult.data) {
    await admin.from('payment_events').upsert(
      {
        ...eventRow,
        process_result: 'order_not_found',
        processed_at: new Date().toISOString(),
      },
      { onConflict: 'provider,event_id' },
    );
    logger.warn('Webhook Mercado Pago sem pedido correspondente', {
      externalReference: snapshot.externalReference,
      mpOrderId: snapshot.mpOrderId,
    });
    return ok('order_not_found');
  }

  const order = orderResult.data;
  const applied = await applyStatus(
    order.id,
    snapshot.status,
    snapshot.mpOrderId,
  );
  if (!applied.ok) {
    // Erro transitório: deixa o MP re-tentar.
    return applied;
  }

  await admin.from('payment_events').upsert(
    {
      ...eventRow,
      order_id: order.id,
      process_result: applied.data,
      processed_at: new Date().toISOString(),
    },
    { onConflict: 'provider,event_id' },
  );

  return ok(applied.data);
}

// --- Estorno (admin) --------------------------------------------------------

/**
 * Estorna um Pix já pago no Mercado Pago e marca o pedido como `refunded`.
 * O caller (admin) já deve ter autorizado a ação. Idempotente.
 */
export async function refundOrderPixPayment(
  orderId: string,
): Promise<Result<{ refunded: boolean; alreadyRefunded: boolean }>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('orders')
    .select('id, payment_method, payment_status, mp_order_id')
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Falha ao carregar o pedido.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Pedido não encontrado.');
  if (data.payment_method !== 'pix') {
    return err('VALIDATION_ERROR', 'Estorno só se aplica a pagamentos Pix.');
  }
  if (data.payment_status === 'refunded') {
    return ok({ refunded: false, alreadyRefunded: true });
  }
  if (data.payment_status !== 'confirmed') {
    return err('VALIDATION_ERROR', 'Só é possível estornar um Pix pago.');
  }
  if (!data.mp_order_id) {
    return err(
      'VALIDATION_ERROR',
      'Pedido sem ordem do Mercado Pago para estornar.',
    );
  }

  const refund = await refundMercadoPagoOrder(
    data.mp_order_id,
    `refund-${orderId}`,
  );
  if (!refund.ok) return refund;

  const { error: rpcError } = await admin.rpc('refund_order_pix_payment', {
    p_order_id: orderId,
    p_mp_refund_id: refund.data.refundId ?? undefined,
  });
  if (rpcError) {
    logger.error('Estorno feito no MP mas falhou ao marcar o pedido', {
      orderId,
      message: rpcError.message,
    });
    return err(
      'INTERNAL_ERROR',
      'Estorno solicitado, mas falhou ao atualizar o pedido.',
      { cause: rpcError },
    );
  }

  return ok({ refunded: true, alreadyRefunded: false });
}

// --- Reconciliação (cron) --------------------------------------------------

export type ReconcileSummary = {
  scanned: number;
  confirmed: number;
  failed: number;
  stillPending: number;
  errors: number;
};

/**
 * Varre pedidos Pix ainda `pending` e reconcilia com o Mercado Pago: confirma
 * os que foram pagos (webhook perdido) e falha os expirados. Roda no cron.
 */
export async function reconcilePendingPixOrders(options?: {
  limit?: number;
}): Promise<Result<ReconcileSummary>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('orders')
    .select('id, mp_order_id, pix_expires_at')
    .eq('payment_method', 'pix')
    .eq('payment_status', 'pending')
    .not('mp_order_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(options?.limit ?? 50);

  if (error) {
    return err('INTERNAL_ERROR', 'Falha ao listar pedidos pendentes.', {
      cause: error,
    });
  }

  const summary: ReconcileSummary = {
    scanned: 0,
    confirmed: 0,
    failed: 0,
    stillPending: 0,
    errors: 0,
  };
  const now = Date.now();

  for (const row of data ?? []) {
    summary.scanned += 1;
    if (!row.mp_order_id) continue;

    const snap = await getMercadoPagoOrder(row.mp_order_id);
    if (!snap.ok) {
      summary.errors += 1;
      continue;
    }

    let status: NormalizedPaymentStatus = snap.data.status;
    // MP ainda pendente + código expirado do nosso lado → falha o pedido.
    if (
      status === 'pending' &&
      row.pix_expires_at &&
      new Date(row.pix_expires_at).getTime() < now
    ) {
      status = 'failed';
    }

    const applied = await applyStatus(row.id, status, row.mp_order_id);
    if (!applied.ok) {
      summary.errors += 1;
      continue;
    }
    if (applied.data === 'confirmed') summary.confirmed += 1;
    else if (applied.data === 'failed' || applied.data === 'refunded')
      summary.failed += 1;
    else summary.stillPending += 1;
  }

  return ok(summary);
}
