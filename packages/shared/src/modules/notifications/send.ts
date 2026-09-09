import 'server-only';

import { hasWebPushConfig } from '@/config/env';
import { logger } from '@/lib/logger';
import { sendWebPushNotification } from '@/lib/push/web-push';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  listActiveAdminSubscriptions,
  revokeAdminPushSubscriptionByEndpoint,
} from '@/modules/notifications/admin-subscriptions';
import {
  listActiveSubscriptionsForCustomer,
  revokePushSubscriptionByEndpoint,
} from '@/modules/notifications/subscriptions';
import { formatCatalogPrice } from '@/modules/catalog/types';
import {
  statusLabel,
  STATUS_COPY,
  type OrderStatus,
} from '@/modules/orders/types';

const NOTIFIABLE: OrderStatus[] = [
  'confirmed',
  'in_production',
  'ready_for_delivery',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

/**
 * Avisa os aparelhos do painel que entrou um pedido novo — mesmo com o
 * painel fechado. Nunca lança: qualquer falha aqui não pode derrubar o
 * checkout do cliente.
 */
export async function notifyAdminNewOrder(options: {
  orderId: string;
}): Promise<void> {
  if (!hasWebPushConfig()) return;

  try {
    const admin = createAdminSupabaseClient();
    const { data: order, error } = await admin
      .from('orders')
      .select('id, order_number, delivery_method, timing, total_cents')
      .eq('id', options.orderId)
      .maybeSingle();

    if (error || !order) return;

    const subscriptions = await listActiveAdminSubscriptions();
    if (!subscriptions.length) return;

    const method =
      order.delivery_method === 'delivery' ? 'Entrega' : 'Retirada';
    const scheduled = order.timing === 'scheduled' ? ' · Agendado' : '';
    const title = `Novo pedido #${order.order_number}`;
    const body = `${formatCatalogPrice(order.total_cents)} · ${method}${scheduled}`;

    await Promise.all(
      subscriptions.map(async (sub) => {
        const result = await sendWebPushNotification({
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          payload: {
            title,
            body,
            url: '/pedidos',
            orderId: order.id,
            tag: `admin-new-order-${order.id}`,
          },
        });
        if (!result.ok && result.gone) {
          await revokeAdminPushSubscriptionByEndpoint(sub.endpoint);
        }
      }),
    );
  } catch (error) {
    logger.warn('Push admin: falha inesperada (não afeta o pedido)', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyOrderStatusChange(options: {
  orderId: string;
  newStatus: OrderStatus;
  orderNumber?: number | null;
}): Promise<void> {
  if (!NOTIFIABLE.includes(options.newStatus)) return;
  if (!hasWebPushConfig()) return;

  try {
    const admin = createAdminSupabaseClient();
    const { data: order, error } = await admin
      .from('orders')
      .select('id, order_number, customer_id, status')
      .eq('id', options.orderId)
      .maybeSingle();

    if (error || !order) {
      logger.warn('Push: pedido não encontrado', {
        orderId: options.orderId,
        message: error?.message,
      });
      return;
    }

    // Comanda manual sem conta vinculada: não há assinatura de push pra notificar.
    if (!order.customer_id) return;

    const subscriptions = await listActiveSubscriptionsForCustomer(
      order.customer_id,
    );
    if (!subscriptions.length) return;

    const number = options.orderNumber ?? order.order_number;
    const isDelivered = options.newStatus === 'delivered';
    const title = isDelivered
      ? `Zelo · Como foi o pedido #${number}?`
      : `Zelo · Pedido #${number}`;
    const body = isDelivered
      ? 'Toque para avaliar em 10 segundos — a sua opinião ajuda muito.'
      : (STATUS_COPY[options.newStatus] ?? statusLabel(options.newStatus));
    const url = isDelivered
      ? `/acompanhamento/${order.id}?avaliar=1`
      : `/acompanhamento/${order.id}`;

    await Promise.all(
      subscriptions.map(async (sub) => {
        const result = await sendWebPushNotification({
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          payload: {
            title,
            body,
            url,
            orderId: order.id,
            tag: `order-${order.id}-${options.newStatus}`,
          },
        });

        if (!result.ok && result.gone) {
          await revokePushSubscriptionByEndpoint(sub.endpoint);
        }
      }),
    );
  } catch (error) {
    logger.warn('Push: falha inesperada (não afeta o pedido)', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
