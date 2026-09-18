import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/modules/admin/auth';

/** Range de instantes ISO `[from, to)`, calculado no fuso do cliente. */
export type ReportRange = { from: string; to: string };

const CANCELLATIONS_RECENT_LIMIT = 12;

export type OperationsReport = {
  from: string;
  to: string;
  cancellations: {
    total: number;
    valueCents: number;
    byReason: Array<{ reason: string; count: number }>;
    recent: Array<{
      id: string;
      orderNumber: number;
      reason: string;
      totalCents: number;
      cancelledAt: string;
    }>;
  };
  production: {
    totalItems: number;
    items: Array<{ name: string; quantity: number }>;
  };
};

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
  range: ReportRange,
): Promise<Result<OperationsReport>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();

  const [cancelled, items] = await Promise.all([
    admin
      .from('orders')
      .select('id, order_number, cancellation_reason, total_cents, cancelled_at')
      .eq('status', 'cancelled')
      .gte('cancelled_at', range.from)
      .lt('cancelled_at', range.to)
      .order('cancelled_at', { ascending: false }),
    admin
      .from('order_items')
      .select('product_name, quantity, orders!inner(status, created_at)')
      .gte('orders.created_at', range.from)
      .lt('orders.created_at', range.to)
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
    from: range.from,
    to: range.to,
    cancellations: {
      total: cancelledRows.length,
      valueCents: cancelledRows.reduce((sum, row) => sum + row.total_cents, 0),
      byReason: groupReasons(cancelledRows),
      recent: cancelledRows.slice(0, CANCELLATIONS_RECENT_LIMIT).map((row) => ({
        id: row.id,
        orderNumber: row.order_number,
        reason: row.cancellation_reason?.trim() || 'Sem motivo informado',
        totalCents: row.total_cents,
        cancelledAt: row.cancelled_at as string,
      })),
    },
    production: {
      totalItems: production.reduce((sum, entry) => sum + entry.quantity, 0),
      items: production,
    },
  });
}
