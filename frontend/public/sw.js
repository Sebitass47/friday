// FRIDAY Service Worker — push notifications + offline cache

const CACHE_VERSION = 'v2'
const STATIC_CACHE = `friday-static-${CACHE_VERSION}`
const PAGES_CACHE  = `friday-pages-${CACHE_VERSION}`
const API_CACHE    = `friday-api-${CACHE_VERSION}`
const ALL_CACHES   = [STATIC_CACHE, PAGES_CACHE, API_CACHE]

// API paths worth caching (GET only, same-origin /api/v1/*)
const CACHEABLE_API_PREFIXES = [
  '/api/v1/projection',
  '/api/v1/expenses',
  '/api/v1/incomes',
  '/api/v1/accounts',
  '/api/v1/tasks',
  '/api/v1/notes',
  '/api/v1/habits',
  '/api/v1/recurring-expenses',
  '/api/v1/installment-purchases',
  '/api/v1/savings-goals',
  '/api/v1/monthly-income',
  '/api/v1/auth/me',
  '/api/v1/credit-payments',
]

function isCacheableApi(pathname) {
  return CACHEABLE_API_PREFIXES.some(p => pathname.startsWith(p))
}

// ── Install: pre-cache shell assets ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll(['/offline.html', '/manifest.json', '/icon-192.png', '/icon-512.png'])
    ).then(() => self.skipWaiting())
  )
})

// ── Activate: delete old caches ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only intercept GET + same-origin
  if (request.method !== 'GET' || url.origin !== location.origin) return

  // Next.js static assets (content-hashed → cache-first, never expire)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // API calls — network-first, serve stale on failure
  if (url.pathname.startsWith('/api/v1/') && isCacheableApi(url.pathname)) {
    event.respondWith(networkFirstApi(request))
    return
  }

  // HTML navigation — network-first, fall back to cached page or offline.html
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstPage(request))
    return
  }

  // Everything else (images, fonts, sounds, icons) — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
})

// ── Cache strategies ─────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(PAGES_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || caches.match('/offline.html')
  }
}

async function networkFirstApi(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(API_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    // Return empty 503 so the app can handle it gracefully
    return new Response(JSON.stringify({ offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request)
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      caches.open(cacheName).then(cache => cache.put(request, response.clone()))
    }
    return response
  }).catch(() => null)
  return cached || fetchPromise
}

// ── Push notifications ───────────────────────────────────────────────────────
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
    renotify: true,
    silent: false,
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
