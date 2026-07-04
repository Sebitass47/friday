// FRIDAY Service Worker — handles push notifications

self.addEventListener('push', function (event) {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: 'FRIDAY', body: event.data.text() } }

  const title = payload.title || 'FRIDAY'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || ('friday-' + Date.now()),
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url: payload.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
