import 'server-only';

import { hasWebPushConfig } from '@/config/env';
import { logger } from '@/lib/logger';
import { sendWebPushNotification } from '@/lib/push/web-push';
import {
  listAllActiveCustomerSubscriptions,
  revokePushSubscriptionByEndpoint,
} from '@/modules/notifications/subscriptions';

/** Envios simultâneos por leva — evita saturar o serviço de push de um fôlego só. */
const CONCURRENCY = 15;

export type BroadcastPushInput = {
  title: string;
  body: string;
  url?: string | null;
};

export type BroadcastRecipients = { customers: number; devices: number };

export type BroadcastPushSummary = BroadcastRecipients & {
  sent: number;
  failed: number;
  revoked: number;
};

export async function countActiveCustomerPushRecipients(): Promise<BroadcastRecipients> {
  const subscriptions = await listAllActiveCustomerSubscriptions();
  return {
    customers: new Set(subscriptions.map((sub) => sub.customerId)).size,
    devices: subscriptions.length,
  };
}

/**
 * Manda o mesmo push pra todo cliente com assinatura ativa (promoção, cupom,
 * aviso geral). Envia em levas de `CONCURRENCY` — sequencial entre levas,
 * paralelo dentro delas — e revoga assinaturas mortas (404/410) no caminho.
 */
export async function broadcastCustomerPush(
  input: BroadcastPushInput,
): Promise<BroadcastPushSummary> {
  const subscriptions = await listAllActiveCustomerSubscriptions();
  const customers = new Set(subscriptions.map((sub) => sub.customerId)).size;
  const devices = subscriptions.length;

  if (!devices || !hasWebPushConfig()) {
    return { customers, devices, sent: 0, failed: 0, revoked: 0 };
  }

  let sent = 0;
  let failed = 0;
  let revoked = 0;

  for (let i = 0; i < subscriptions.length; i += CONCURRENCY) {
    const batch = subscriptions.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (sub) => {
        const result = await sendWebPushNotification({
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          payload: {
            title: input.title,
            body: input.body,
            url: input.url || '/',
            tag: 'broadcast',
          },
        });

        if (result.ok) {
          sent += 1;
          return;
        }

        failed += 1;
        if (result.gone) {
          revoked += 1;
          await revokePushSubscriptionByEndpoint(sub.endpoint);
        }
      }),
    );
  }

  logger.info('Push: broadcast pra clientes concluído', {
    customers,
    devices,
    sent,
    failed,
    revoked,
  });

  return { customers, devices, sent, failed, revoked };
}
