// FRIDAY Service Worker — handles push notifications

self.addEventListener('push', function (event) {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: 'FRIDAY', body: event.data.text() } }

  const title = payload.title || 'FRIDAY'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: 'friday-payment',
    requireInteraction: false,
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/dashboard')
    })
  )
})
