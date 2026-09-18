/* Service worker do painel Zelo — só Web Push (sem cache offline). */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Zelo · Painel',
    body: 'Novo pedido.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: '/pedidos' },
    tag: 'zelo-admin',
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // mantém o default
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      data: payload.data,
      tag: payload.tag,
      renotify: true,
      actions: payload.actions,
    }),
  );
});

/** Aprova o suporte de acesso (OTP) direto pelo botão da notificação, sem abrir o painel. */
function approveOtpSupportFromNotification(requestId, fallbackUrl) {
  return fetch(`/api/v1/admin/otp-support/${requestId}/approve`, {
    method: 'POST',
  })
    .then((response) => {
      if (!response.ok) throw new Error(`approve falhou (${response.status})`);
      return self.registration.showNotification('Acesso aprovado', {
        body: 'O cliente já pode entrar.',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: `otp-support-${requestId}`,
      });
    })
    .catch(() =>
      self.clients.openWindow ? self.clients.openWindow(fallbackUrl) : undefined,
    );
}

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  const targetUrl = data.url || '/pedidos';

  if (event.action === 'approve-otp' && data.requestId) {
    event.notification.close();
    event.waitUntil(
      approveOtpSupportFromNotification(data.requestId, targetUrl),
    );
    return;
  }

  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.navigate?.(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow
          ? self.clients.openWindow(targetUrl)
          : undefined;
      }),
  );
});
