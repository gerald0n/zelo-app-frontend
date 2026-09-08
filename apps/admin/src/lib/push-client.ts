'use client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export type AdminPushState = {
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
};

export async function getAdminPushState(): Promise<AdminPushState> {
  if (!pushSupported()) return { permission: 'unsupported', subscribed: false };
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  return {
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
}

export async function enableAdminPush(): Promise<
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'missing_vapid' | 'failed' }
> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  const configRes = await fetch('/api/v1/admin/push/config', {
    cache: 'no-store',
  });
  const config = await configRes.json().catch(() => null);
  if (!config?.enabled || !config?.publicKey) {
    return { ok: false, reason: 'missing_vapid' };
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;
  } catch {
    return { ok: false, reason: 'failed' };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        config.publicKey as string,
      ) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: 'failed' };
  }

  const response = await fetch('/api/v1/admin/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent,
    }),
  });

  return response.ok ? { ok: true } : { ok: false, reason: 'failed' };
}

export async function disableAdminPush(): Promise<{ ok: boolean }> {
  if (!pushSupported()) return { ok: false };
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return { ok: true };

  try {
    await fetch('/api/v1/admin/push/subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
