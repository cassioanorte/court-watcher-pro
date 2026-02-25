// Push notification event handlers for Service Worker
// This file is imported by the Workbox-generated SW via importScripts

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Lex Imperium', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    tag: data.tag || 'default',
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Lex Imperium', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
