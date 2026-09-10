import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  getMercadoPagoOrder,
  type NormalizedPaymentStatus,
} from '@/modules/payments/mercadopago';
import {
  applyStatus,
  refundOrderPixPayment,
} from '@/modules/payments/order-pix-webhook';

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

    const applied = await applyStatus(
      row.id,
      status,
      row.mp_order_id,
      snap.data.mpPaymentId,
    );
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

/** Pedidos Pix cancelados que continuam pagos e ainda não foram estornados. */
export async function countCancelledPixAwaitingRefund(): Promise<
  Result<number>
> {
  const admin = createAdminSupabaseClient();
  const { count, error } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('payment_method', 'pix')
    .eq('payment_status', 'confirmed')
    .eq('status', 'cancelled')
    .is('refunded_at', null)
    .not('mp_order_id', 'is', null);

  if (error) {
    return err('INTERNAL_ERROR', 'Falha ao contar estornos pendentes.', {
      cause: error,
    });
  }
  return ok(count ?? 0);
}

export type PixRefundSweepSummary = {
  scanned: number;
  /** Estorno criado agora no Mercado Pago. */
  refunded: number;
  /** Já estava estornado no MP (estorno manual pelo painel) — só reconciliado. */
  alreadyRefunded: number;
  failed: number;
};

/**
 * Varre pedidos Pix que foram cancelados mas continuam `confirmed` (pagos) e
 * sem estorno — o estorno automático não rodou ou falhou na hora do
 * cancelamento — e refaz o estorno no Mercado Pago. Idempotente. Roda no mesmo
 * cron da reconciliação.
 */
export async function reconcileCancelledPixRefunds(options?: {
  limit?: number;
}): Promise<Result<PixRefundSweepSummary>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('orders')
    .select('id, mp_order_id')
    .eq('payment_method', 'pix')
    .eq('payment_status', 'confirmed')
    .eq('status', 'cancelled')
    .is('refunded_at', null)
    .not('mp_order_id', 'is', null)
    .order('cancelled_at', { ascending: true })
    // Cada pedido custa até 2 chamadas ao MP; teto baixo para caber no
    // orçamento de 55s do cron. O backlog drena nas execuções seguintes.
    .limit(options?.limit ?? 20);

  if (error) {
    return err('INTERNAL_ERROR', 'Falha ao listar pedidos a estornar.', {
      cause: error,
    });
  }

  const summary: PixRefundSweepSummary = {
    scanned: 0,
    refunded: 0,
    alreadyRefunded: 0,
    failed: 0,
  };

  for (const row of data ?? []) {
    summary.scanned += 1;
    if (!row.mp_order_id) continue;

    // Se a loja já estornou direto no painel do MP, só reconcilia nosso lado.
    const snap = await getMercadoPagoOrder(row.mp_order_id);
    if (snap.ok && snap.data.status === 'refunded') {
      const applied = await applyStatus(
        row.id,
        'refunded',
        row.mp_order_id,
        snap.data.mpPaymentId,
      );
      if (applied.ok) summary.alreadyRefunded += 1;
      else summary.failed += 1;
      continue;
    }

    const result = await refundOrderPixPayment(row.id);
    if (!result.ok) {
      summary.failed += 1;
      logger.error('Sweep de estorno Pix falhou', {
        orderId: row.id,
        code: result.error.code,
      });
      continue;
    }
    if (result.data.alreadyRefunded) summary.alreadyRefunded += 1;
    else summary.refunded += 1;
  }

  return ok(summary);
}
