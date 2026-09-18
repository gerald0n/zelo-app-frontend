import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/modules/admin/auth';
import type { OrderStatus, PaymentMethod } from '@/modules/orders/types';
import type { OrderReportRow, OrdersReportFilters } from '@/modules/admin/orders-report';

const PAGE_SIZE = 1000;
/** Teto de segurança: até 20 mil pedidos por consulta. */
const MAX_PAGES = 20;

const REPORT_SELECT = `
  id,
  order_number,
  status,
  delivery_method,
  payment_method,
  subtotal_cents,
  add_ons_total_cents,
  delivery_fee_cents,
  coupon_discount_cents,
  total_cents,
  timing,
  scheduled_for,
  created_at,
  order_addresses ( neighborhood, route_distance_meters )
`;

type ReportRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  delivery_method: 'delivery' | 'pickup';
  payment_method: PaymentMethod;
  subtotal_cents: number;
  add_ons_total_cents: number;
  delivery_fee_cents: number;
  coupon_discount_cents: number;
  total_cents: number;
  timing: 'immediate' | 'scheduled';
  scheduled_for: string | null;
  created_at: string;
  order_addresses:
    | { neighborhood: string; route_distance_meters: number }
    | { neighborhood: string; route_distance_meters: number }[]
    | null;
};

function mapRow(row: ReportRow): OrderReportRow {
  const addr = Array.isArray(row.order_addresses)
    ? row.order_addresses[0]
    : row.order_addresses;
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    deliveryMethod: row.delivery_method,
    paymentMethod: row.payment_method,
    subtotalCents: row.subtotal_cents,
    addOnsCents: row.add_ons_total_cents,
    discountCents: row.coupon_discount_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    totalCents: row.total_cents,
    timing: row.timing,
    scheduledFor: row.scheduled_for,
    neighborhood: addr?.neighborhood ?? null,
    distanceMeters: addr?.route_distance_meters ?? null,
    createdAt: row.created_at,
  };
}

/**
 * Busca TODOS os pedidos que casam com os filtros (paginação real via
 * `.range()`, sem teto de 1000 linhas) — usado tanto pra tela quanto pra
 * exportação, então os totais/indicadores nunca divergem do que foi
 * exportado. Filtro por distância é aplicado em memória (a coluna vive em
 * `order_addresses`, e só interessa a pedidos de entrega — o volume por
 * período não justifica a complexidade extra de um `!inner` join filtrado).
 */
export async function getOrdersReport(
  filters: OrdersReportFilters,
): Promise<Result<{ orders: OrderReportRow[]; total: number; truncated: boolean }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const rows: OrderReportRow[] = [];
  let truncated = false;
  let page = 0;

  while (true) {
    let query = admin
      .from('orders')
      .select(REPORT_SELECT)
      .gte('created_at', filters.from)
      .lt('created_at', filters.to)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filters.deliveryMethod) {
      query = query.eq('delivery_method', filters.deliveryMethod);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.paymentMethod) {
      query = query.eq('payment_method', filters.paymentMethod);
    }
    if (filters.hasDiscount === true) {
      query = query.gt('coupon_discount_cents', 0);
    } else if (filters.hasDiscount === false) {
      query = query.eq('coupon_discount_cents', 0);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Falha ao carregar relatório de pedidos', {
        message: error.message,
      });
      return err('INTERNAL_ERROR', 'Não foi possível carregar o relatório.', {
        cause: error,
      });
    }

    const batch = (data ?? []) as ReportRow[];
    for (const row of batch) rows.push(mapRow(row));

    if (batch.length < PAGE_SIZE) break;
    page += 1;
    if (page >= MAX_PAGES) {
      truncated = true;
      break;
    }
  }

  const filtered =
    filters.minDistanceMeters === undefined && filters.maxDistanceMeters === undefined
      ? rows
      : rows.filter((r) => {
          if (r.distanceMeters === null) return false;
          if (
            filters.minDistanceMeters !== undefined &&
            r.distanceMeters < filters.minDistanceMeters
          ) {
            return false;
          }
          if (
            filters.maxDistanceMeters !== undefined &&
            r.distanceMeters > filters.maxDistanceMeters
          ) {
            return false;
          }
          return true;
        });

  return ok({ orders: filtered, total: filtered.length, truncated });
}
