import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/modules/admin/auth';
import type { ReportPeriod } from '@/modules/admin/reports';

type Method = 'pix' | 'cash' | 'card';

export type FinancialReport = {
  period: ReportPeriod;
  from: string;
  /** bps usado pra estimar taxa onde não há o número real. */
  estimateBps: number;
  gross: { totalCents: number; orderCount: number };
  fees: { totalCents: number; realCents: number; estimatedCents: number };
  netCents: number;
  byMethod: Record<
    Method,
    { grossCents: number; feeCents: number; count: number }
  >;
  refunds: { count: number; valueCents: number; feeCostCents: number };
  pixTransactions: Array<{
    orderNumber: number;
    createdAt: string;
    grossCents: number;
    feeCents: number;
    netCents: number;
    estimated: boolean;
  }>;
};

function rangeStart(period: ReportPeriod, now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === '7d') start.setDate(start.getDate() - 6);
  if (period === '30d') start.setDate(start.getDate() - 29);
  return start;
}

type OrderRow = {
  order_number: number;
  created_at: string;
  payment_method: string;
  payment_status: string;
  status: string;
  total_cents: number;
  payment_fee_cents: number | null;
  payment_net_cents: number | null;
};

export async function getFinancialReport(
  period: ReportPeriod,
): Promise<Result<FinancialReport>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const from = rangeStart(period).toISOString();

  const [storeRes, ordersRes] = await Promise.all([
    admin
      .from('stores')
      .select('payment_fee_estimate_bps')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from('orders')
      .select(
        'order_number, created_at, payment_method, payment_status, status, total_cents, payment_fee_cents, payment_net_cents',
      )
      .gte('created_at', from),
  ]);

  if (ordersRes.error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar o financeiro.', {
      cause: ordersRes.error,
    });
  }

  const estimateBps = storeRes.data?.payment_fee_estimate_bps ?? 99;
  const estimate = (cents: number) => Math.round((cents * estimateBps) / 10000);

  const empty = () => ({ grossCents: 0, feeCents: 0, count: 0 });
  const byMethod: FinancialReport['byMethod'] = {
    pix: empty(),
    cash: empty(),
    card: empty(),
  };
  const gross = { totalCents: 0, orderCount: 0 };
  const fees = { totalCents: 0, realCents: 0, estimatedCents: 0 };
  const refunds = { count: 0, valueCents: 0, feeCostCents: 0 };
  const pixTransactions: FinancialReport['pixTransactions'] = [];

  for (const row of (ordersRes.data ?? []) as OrderRow[]) {
    const method = (['pix', 'cash', 'card'] as const).includes(
      row.payment_method as Method,
    )
      ? (row.payment_method as Method)
      : null;
    if (!method) continue;

    const isPix = method === 'pix';
    const realFee = row.payment_fee_cents;
    const fee = isPix ? (realFee ?? estimate(row.total_cents)) : 0;

    if (row.payment_status === 'refunded') {
      refunds.count += 1;
      refunds.valueCents += row.total_cents;
      refunds.feeCostCents += fee;
      continue;
    }

    // "Entrou dinheiro": Pix confirmado, ou dinheiro/cartão não cancelado.
    const isRevenue = isPix
      ? row.payment_status === 'confirmed'
      : row.status !== 'cancelled';
    if (!isRevenue) continue;

    gross.totalCents += row.total_cents;
    gross.orderCount += 1;
    fees.totalCents += fee;
    if (isPix && realFee != null) fees.realCents += fee;
    else if (fee > 0) fees.estimatedCents += fee;

    byMethod[method].grossCents += row.total_cents;
    byMethod[method].feeCents += fee;
    byMethod[method].count += 1;

    if (isPix) {
      pixTransactions.push({
        orderNumber: row.order_number,
        createdAt: row.created_at,
        grossCents: row.total_cents,
        feeCents: fee,
        netCents: row.payment_net_cents ?? row.total_cents - fee,
        estimated: realFee == null,
      });
    }
  }

  pixTransactions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return ok({
    period,
    from,
    estimateBps,
    gross,
    fees,
    netCents: gross.totalCents - fees.totalCents,
    byMethod,
    refunds,
    pixTransactions,
  });
}
