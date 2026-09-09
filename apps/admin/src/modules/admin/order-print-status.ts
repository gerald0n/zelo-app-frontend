import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/modules/admin/auth';

/**
 * Rastreio de "a comanda de cozinha deste pedido já saiu na térmica".
 * `orders.kitchen_printed_at` é a fonte da verdade; o painel enfileira a
 * impressão de todo pedido e marca aqui após o corte confirmar.
 */

/**
 * Pedidos cuja comanda de cozinha ainda não imprimiu. O painel chama isto ao
 * (re)abrir e reenfileira — cobre pedidos que entraram com o app fechado.
 * Janela curta + limite baixo pra nunca despejar o histórico inteiro na fila;
 * `cancelled` fica de fora.
 */
export async function listUnprintedKitchenOrders(): Promise<
  Result<Array<{ id: string; number: string }>>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('orders')
    .select('id, order_number')
    .is('kitchen_printed_at', null)
    .neq('status', 'cancelled')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(30);

  if (error) {
    logger.error('Falha ao listar comandas pendentes de impressão', {
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível carregar a fila.', {
      cause: error,
    });
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      number: `#${row.order_number}`,
    })),
  );
}

/**
 * Marca a comanda de cozinha como impressa. Idempotente: só grava se ainda
 * estiver nula, então reimpressões manuais e corridas entre abas não
 * "reabrem" o pedido nem sobrescrevem o horário original.
 */
export async function markOrderKitchenPrinted(
  orderId: string,
): Promise<Result<{ printedAt: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const printedAt = new Date().toISOString();
  const { data, error } = await admin
    .from('orders')
    .update({ kitchen_printed_at: printedAt })
    .eq('id', orderId)
    .is('kitchen_printed_at', null)
    .select('id, kitchen_printed_at')
    .maybeSingle();

  if (error) {
    logger.error('Falha ao marcar comanda como impressa', {
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível registrar a impressão.', {
      cause: error,
    });
  }

  // Sem linha = já estava marcada (ou pedido inexistente): trata como sucesso.
  return ok({ printedAt: data?.kitchen_printed_at ?? printedAt });
}
