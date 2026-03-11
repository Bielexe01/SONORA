self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'Sonora',
      body: event.data ? event.data.text() : 'Nova notificacao recebida.'
    };
  }

  const title = payload.title || 'Sonora';
  const body = payload.body || 'Voce recebeu uma nova notificacao.';
  const url = payload.url || '/?tab=notifications';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.tag || undefined,
      data: {
        url,
        entity_type: payload.entity_type || null,
        entity_id: payload.entity_id || null
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification?.data?.url || '/?tab=notifications';
  const targetUrl = new URL(rawUrl, self.location.origin).toString();

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if (!client.url) continue;
      const clientUrl = new URL(client.url);
      if (clientUrl.origin === self.location.origin) {
        await client.focus();
        client.navigate(targetUrl);
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});

