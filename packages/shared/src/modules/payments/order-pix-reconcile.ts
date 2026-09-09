import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  getMercadoPagoOrder,
  type NormalizedPaymentStatus,
} from '@/modules/payments/mercadopago';
import { applyStatus } from '@/modules/payments/order-pix-webhook';

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
