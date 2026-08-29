import { hasWebPushConfig } from '@/config/env';
import { logger } from '@/lib/logger';
import { sendWebPushNotification } from '@/lib/push/web-push';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  listActiveSubscriptionsForCustomer,
  revokePushSubscriptionByEndpoint,
} from '@/modules/notifications/subscriptions';
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

    const subscriptions = await listActiveSubscriptionsForCustomer(
      order.customer_id,
    );
    if (!subscriptions.length) return;

    const number = options.orderNumber ?? order.order_number;
    const title = `Zelo · Pedido #${number}`;
    const body =
      STATUS_COPY[options.newStatus] ?? statusLabel(options.newStatus);
    const url = `/acompanhamento/${order.id}`;

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
