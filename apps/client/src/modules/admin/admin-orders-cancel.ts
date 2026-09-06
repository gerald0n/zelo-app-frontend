import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { refundOrderPixPayment } from '@/modules/payments';
import {
  getAdminOrder,
  transitionAdminOrderStatus,
} from '@/modules/admin/orders';
import type { AdminOrderDetail } from '@/modules/admin/types';

export type CancelAdminOrderResult = {
  order: AdminOrderDetail;
  /** Presente quando o pedido era um Pix pago: estado do estorno automático. */
  refund?: 'done' | 'already' | 'failed';
};

/** Um Pix pago que ainda não foi estornado. */
function needsPixRefund(order: AdminOrderDetail): boolean {
  return order.paymentMethod === 'pix' && order.paymentStatus === 'confirmed';
}

/**
 * Estorna o Pix e devolve o pedido já atualizado. Uma falha no estorno não
 * desfaz o cancelamento — o admin vê o aviso e pode tentar de novo.
 */
async function finishPixRefund(
  orderId: string,
  fallbackOrder: AdminOrderDetail,
): Promise<Result<CancelAdminOrderResult>> {
  const refund = await refundOrderPixPayment(orderId);
  if (!refund.ok) {
    logger.error('Cancelamento ok, mas o estorno Pix falhou', {
      orderId,
      code: refund.error.code,
    });
    return ok({ order: fallbackOrder, refund: 'failed' });
  }

  const refreshed = await getAdminOrder(orderId);
  return ok({
    order: refreshed.ok ? refreshed.data : fallbackOrder,
    refund: refund.data.alreadyRefunded ? 'already' : 'done',
  });
}

export async function cancelAdminOrder(options: {
  orderId: string;
  reason: string;
}): Promise<Result<CancelAdminOrderResult>> {
  const reason = options.reason.trim();
  if (reason.length < 3) {
    return err(
      'VALIDATION_ERROR',
      'Informe um motivo com pelo menos 3 caracteres.',
    );
  }

  const current = await getAdminOrder(options.orderId);
  if (!current.ok) return current;

  // Pedido já cancelado: não dá pra transicionar de novo, mas o estorno Pix
  // pode ter ficado pendente (falha na 1ª tentativa). Refaz só o estorno.
  if (current.data.status === 'cancelled') {
    if (!needsPixRefund(current.data)) {
      return err('VALIDATION_ERROR', 'Este pedido já está cancelado.');
    }
    return finishPixRefund(options.orderId, current.data);
  }

  const cancelled = await transitionAdminOrderStatus({
    orderId: options.orderId,
    newStatus: 'cancelled',
    reason,
  });
  if (!cancelled.ok) return cancelled;

  // Pix já pago → estorna automaticamente no Mercado Pago.
  if (needsPixRefund(cancelled.data)) {
    return finishPixRefund(options.orderId, cancelled.data);
  }

  return ok({ order: cancelled.data });
}
