import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/modules/admin/auth';
import {
  aggregateDashboard,
  type DashboardQuery,
  type DashboardReport,
} from '@/modules/admin/dashboard';

/**
 * Indicadores da visão geral, agregados no servidor. Antes o painel puxava
 * até 200 pedidos com joins (`order_items`, `customers`) e somava no cliente
 * — agora só chegam os números.
 */
export async function getDashboardReport(
  query: DashboardQuery,
): Promise<Result<DashboardReport>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const earliest =
    query.prevFrom < query.bucketFrom ? query.prevFrom : query.bucketFrom;

  const [ordersRes, itemsRes] = await Promise.all([
    admin
      .from('orders')
      .select('created_at, total_cents, status, delivery_method')
      .gte('created_at', earliest),
    admin
      .from('order_items')
      .select('product_name, quantity, orders!inner(created_at, status)')
      .gte('orders.created_at', query.from)
      .neq('orders.status', 'cancelled'),
  ]);

  if (ordersRes.error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar os indicadores.', {
      cause: ordersRes.error,
    });
  }
  if (itemsRes.error) {
    return err(
      'INTERNAL_ERROR',
      'Não foi possível carregar os mais vendidos.',
      {
        cause: itemsRes.error,
      },
    );
  }

  return ok(
    aggregateDashboard(
      (ordersRes.data ?? []).map((row) => ({
        createdAt: row.created_at,
        totalCents: row.total_cents,
        status: row.status,
        deliveryMethod: row.delivery_method,
      })),
      (itemsRes.data ?? []).map((row) => ({
        name: row.product_name,
        quantity: row.quantity,
      })),
      query,
    ),
  );
}
