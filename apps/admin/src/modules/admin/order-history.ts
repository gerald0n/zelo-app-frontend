import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/modules/admin/auth';
import { deliveryAddressSummary } from '@/lib/admin/order-address';
import { LIST_SELECT } from '@/modules/admin/orders';
import type { OrderStatus } from '@/modules/orders/types';
import type { AdminOrderListItem } from '@/modules/admin/types';

/** Teto de linhas buscadas por consulta — rede de segurança, não paginação real. */
const HISTORY_MAX_ROWS = 1000;
const HISTORY_DEFAULT_PAGE_SIZE = 30;

export type AdminOrderHistoryResult = {
  orders: AdminOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Histórico completo de pedidos, com busca (número/cliente/produto) e
 * intervalo de datas — ao contrário de `listAdminOrders`, não existe pra
 * alimentar o quadro ao vivo, então não tem o filtro "só hoje/ativo" nem o
 * teto de 200 linhas. `from`/`to` (yyyy-mm-dd) limitam a busca no banco;
 * texto e paginação são aplicados em memória sobre esse recorte.
 */
export async function listAdminOrderHistory(options: {
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<Result<AdminOrderHistoryResult>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  let query = admin
    .from('orders')
    .select(LIST_SELECT)
    .order('created_at', { ascending: false })
    .limit(HISTORY_MAX_ROWS);

  if (options.from) {
    query = query.gte('created_at', `${options.from}T00:00:00.000Z`);
  }
  if (options.to) {
    query = query.lte('created_at', `${options.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('Falha ao listar histórico de pedidos', {
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível carregar o histórico.', {
      cause: error,
    });
  }

  const mapped = (data ?? []).map((row) => {
    const customer = Array.isArray(row.customers)
      ? row.customers[0]
      : row.customers;
    const addr = Array.isArray(row.order_addresses)
      ? row.order_addresses[0]
      : row.order_addresses;
    return {
      id: row.id,
      orderNumber: row.order_number,
      number: `#${row.order_number}`,
      status: row.status as OrderStatus,
      deliveryMethod: row.delivery_method,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      hasPixCharge: row.mp_order_id !== null,
      timing: row.timing,
      scheduledFor: row.scheduled_for,
      totalCents: row.total_cents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customerName: customer?.name ?? row.guest_name ?? null,
      customerPhone: customer?.phone_e164 ?? row.guest_phone_e164 ?? null,
      isGuest: !customer,
      deliveryAddress: deliveryAddressSummary(row.delivery_method, addr),
      items: (row.order_items ?? []).map(
        (item: { product_name: string; quantity: number }) => ({
          name: item.product_name,
          quantity: item.quantity,
        }),
      ),
    } satisfies AdminOrderListItem;
  });

  const q = options.q?.trim().toLowerCase();
  const filtered = !q
    ? mapped
    : mapped.filter(
        (order) =>
          order.number.toLowerCase().includes(q) ||
          String(order.orderNumber).includes(q) ||
          order.customerName?.toLowerCase().includes(q) ||
          order.items.some((item) => item.name.toLowerCase().includes(q)),
      );

  const pageSize = Math.min(
    100,
    Math.max(1, options.pageSize ?? HISTORY_DEFAULT_PAGE_SIZE),
  );
  const page = Math.max(1, options.page ?? 1);
  const start = (page - 1) * pageSize;

  return ok({
    orders: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  });
}
