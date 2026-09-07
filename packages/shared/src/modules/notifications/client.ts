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

export async function registerZeloServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'missing_vapid' | 'failed' }
> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return { ok: false, reason: 'unsupported' };
  }

  const vapidRes = await fetch('/api/v1/push/vapid-public-key', {
    cache: 'no-store',
  });
  const vapidJson = await vapidRes.json().catch(() => null);
  if (!vapidJson?.enabled || !vapidJson?.publicKey) {
    return { ok: false, reason: 'missing_vapid' };
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  const registration = await registerZeloServiceWorker();
  if (!registration) return { ok: false, reason: 'failed' };

  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        vapidJson.publicKey as string,
      ) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: 'failed' };
  }

  // Garante sessão de cliente autenticada antes de gravar a assinatura.
  await fetch('/api/v1/auth/session', { method: 'POST' }).catch(() => null);

  const response = await fetch('/api/v1/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      userAgent: navigator.userAgent,
    }),
  });

  if (!response.ok) return { ok: false, reason: 'failed' };
  return { ok: true };
}

export async function getPushSubscriptionState(): Promise<{
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
}> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { permission: 'unsupported', subscribed: false };
  }

  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  return {
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
}

export async function unsubscribeFromPush(): Promise<
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'failed' }
> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { ok: false, reason: 'unsupported' };
  }

  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return { ok: true };

  try {
    await fetch('/api/v1/push/subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
