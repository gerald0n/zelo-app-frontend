import webpush from 'web-push';
import {
  getVapidPrivateKey,
  getVapidPublicKey,
  getVapidSubject,
  hasWebPushConfig,
} from '@/config/env';
import { logger } from '@/lib/logger';

let configured = false;

function ensureVapidConfigured() {
  if (configured) return true;
  if (!hasWebPushConfig()) return false;
  webpush.setVapidDetails(
    getVapidSubject(),
    getVapidPublicKey()!,
    getVapidPrivateKey()!,
  );
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url: string;
  orderId: string;
  tag?: string;
};

export type SendPushResult =
  | { ok: true }
  | { ok: false; gone: boolean; statusCode?: number; message: string };

export async function sendWebPushNotification(options: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: PushPayload;
}): Promise<SendPushResult> {
  if (!ensureVapidConfigured()) {
    return {
      ok: false,
      gone: false,
      message: 'Web Push não configurado (VAPID ausente).',
    };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: options.endpoint,
        keys: {
          p256dh: options.p256dh,
          auth: options.auth,
        },
      },
      JSON.stringify({
        title: options.payload.title,
        body: options.payload.body,
        icon: options.payload.icon ?? '/icons/icon-192.png',
        badge: options.payload.badge ?? '/icons/badge-72.png',
        data: {
          url: options.payload.url,
          orderId: options.payload.orderId,
        },
        tag: options.payload.tag ?? `order-${options.payload.orderId}`,
      }),
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : undefined;
    const gone = statusCode === 404 || statusCode === 410;
    const message =
      error instanceof Error ? error.message : 'Falha ao enviar Web Push.';

    logger.warn('Falha no Web Push', { statusCode, gone, message });
    return { ok: false, gone, statusCode, message };
  }
}
