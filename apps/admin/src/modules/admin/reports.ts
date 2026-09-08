import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/modules/admin/auth';

export type ReportPeriod = 'today' | '7d' | '30d';

export type OperationsReport = {
  period: ReportPeriod;
  from: string;
  cancellations: {
    total: number;
    valueCents: number;
    byReason: Array<{ reason: string; count: number }>;
  };
  production: {
    totalItems: number;
    items: Array<{ name: string; quantity: number }>;
  };
};

function rangeStart(period: ReportPeriod, now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === '7d') start.setDate(start.getDate() - 6);
  if (period === '30d') start.setDate(start.getDate() - 29);
  return start;
}

/** Agrupa motivos de cancelamento por texto (sem diferenciar maiúsculas). */
function groupReasons(
  rows: Array<{ cancellation_reason: string | null }>,
): Array<{ reason: string; count: number }> {
  const map = new Map<string, { reason: string; count: number }>();
  for (const row of rows) {
    const raw = row.cancellation_reason?.trim();
    const label = raw && raw.length > 0 ? raw : 'Sem motivo informado';
    const key = label.toLowerCase();
    const entry = map.get(key);
    if (entry) entry.count += 1;
    else map.set(key, { reason: label, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export async function getOperationsReport(
  period: ReportPeriod,
): Promise<Result<OperationsReport>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const from = rangeStart(period).toISOString();

  const [cancelled, items] = await Promise.all([
    admin
      .from('orders')
      .select('cancellation_reason, total_cents')
      .eq('status', 'cancelled')
      .gte('cancelled_at', from),
    admin
      .from('order_items')
      .select('product_name, quantity, orders!inner(status, created_at)')
      .gte('orders.created_at', from)
      .neq('orders.status', 'cancelled'),
  ]);

  if (cancelled.error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar cancelamentos.', {
      cause: cancelled.error,
    });
  }
  if (items.error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar a produção.', {
      cause: items.error,
    });
  }

  const cancelledRows = cancelled.data ?? [];
  const productMap = new Map<string, number>();
  for (const item of items.data ?? []) {
    productMap.set(
      item.product_name,
      (productMap.get(item.product_name) ?? 0) + item.quantity,
    );
  }
  const production = [...productMap.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  return ok({
    period,
    from,
    cancellations: {
      total: cancelledRows.length,
      valueCents: cancelledRows.reduce((sum, row) => sum + row.total_cents, 0),
      byReason: groupReasons(cancelledRows),
    },
    production: {
      totalItems: production.reduce((sum, entry) => sum + entry.quantity, 0),
      items: production,
    },
  });
}
