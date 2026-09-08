import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { notifyAdminNewOrder } from '@/modules/notifications/send';
import {
  getMercadoPagoOrder,
  getMercadoPagoPayment,
  refundMercadoPagoOrder,
  type MercadoPagoSnapshot,
  type NormalizedPaymentStatus,
} from '@/modules/payments/mercadopago';

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

export async function applyStatus(
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
    // Pix confirmado: só agora o pedido entra pra produção — avisa o painel.
    await notifyAdminNewOrder({ orderId });
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
  const applied = await applyStatus(order.id, snapshot.status, snapshot.mpOrderId);
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
