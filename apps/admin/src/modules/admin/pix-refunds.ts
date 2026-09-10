import 'server-only';

import { ok, type Result } from '@/lib/errors';
import { requireAdmin } from '@/modules/admin/auth';
import {
  countCancelledPixAwaitingRefund,
  reconcileCancelledPixRefunds,
  type PixRefundSweepSummary,
} from '@/modules/payments';

/** Quantos Pix pagos de pedidos cancelados ainda estão sem estorno. */
export async function getPendingPixRefundCount(): Promise<
  Result<{ pending: number }>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const count = await countCancelledPixAwaitingRefund();
  if (!count.ok) return count;
  return ok({ pending: count.data });
}

/**
 * Dispara agora o mesmo estorno em lote que o cron faz. Teto por chamada para
 * caber no limite de tempo da rota — se sobrar, o admin roda de novo (ou o cron
 * pega o resto).
 */
export async function runPixRefundSweep(): Promise<
  Result<PixRefundSweepSummary>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  return reconcileCancelledPixRefunds({ limit: 20 });
}
