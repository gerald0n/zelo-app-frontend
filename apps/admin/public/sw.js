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
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/pedidos';

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
