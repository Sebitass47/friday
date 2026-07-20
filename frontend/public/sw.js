// FRIDAY Service Worker — push notifications + offline cache + offline queue

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

// POST endpoints that get queued when offline
const QUEUEABLE_POSTS = ['/api/v1/expenses', '/api/v1/tasks', '/api/v1/notes']

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(['/offline.html', '/manifest.json', '/icon-192.png', '/icon-512.png']))
      .then(() => self.skipWaiting())
  )
})

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin
  if (url.origin !== location.origin) return

  // Intercept POST to queueable endpoints (skip SW's own replay requests)
  if (request.method === 'POST'
      && QUEUEABLE_POSTS.some(p => url.pathname.startsWith(p))
      && !request.headers.get('X-SW-Replay')) {
    event.respondWith(handleOfflinePost(request))
    return
  }

  // Only cache GET from here on
  if (request.method !== 'GET') return

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
    return new Response(JSON.stringify({ offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request)
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) caches.open(cacheName).then(cache => cache.put(request, response.clone()))
    return response
  }).catch(() => null)
  return cached || fetchPromise
}

// ── Offline POST queue ────────────────────────────────────────────────────────

const DB_NAME = 'friday-offline'
const STORE   = 'queue'
const SYNC_TAG = 'friday-sync'
const BC_NAME  = 'friday-offline'

function dbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

async function dbAdd(record) {
  const db = await dbOpen()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).add(record)
    req.onsuccess = () => resolve(req.result)
    tx.onerror = e => reject(e.target.error)
    tx.oncomplete = () => db.close()
  })
}

async function dbGetAll() {
  const db = await dbOpen()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => { resolve(req.result); db.close() }
    req.onerror = e => reject(e.target.error)
  })
}

async function dbDelete(id) {
  const db = await dbOpen()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = e => reject(e.target.error)
  })
}

async function broadcastCount() {
  const queue = await dbGetAll()
  const ch = new BroadcastChannel(BC_NAME)
  ch.postMessage({ type: 'queue-count', count: queue.length })
  ch.close()
}

async function handleOfflinePost(request) {
  // Clone BEFORE fetch — body stream can only be read once
  const clone = request.clone()
  try {
    // Online: pass through normally
    return await fetch(request)
  } catch {
    // Offline: queue the action and return fake success
    let body = {}
    try { body = await clone.json() } catch {}

    await dbAdd({
      url: request.url,
      method: 'POST',
      body,
      token: request.headers.get('Authorization') || '',
      queuedAt: new Date().toISOString(),
    })

    // Register background sync if the browser supports it (Chrome/Android)
    if (self.registration.sync) {
      try { await self.registration.sync.register(SYNC_TAG) } catch {}
    }

    await broadcastCount()

    // Return a fake 200 so the form closes normally
    return new Response(JSON.stringify({ id: `pending-${Date.now()}`, _pending: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function processQueue() {
  const queue = await dbGetAll()
  for (const action of queue) {
    try {
      const res = await fetch(action.url, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': action.token,
          'X-SW-Replay': '1',  // Prevents the SW from re-intercepting this request
        },
        body: JSON.stringify(action.body),
      })
      if (res.ok) {
        await dbDelete(action.id)
      } else if (res.status < 500) {
        // 4xx: can't recover (e.g. expired token, validation error) — remove to avoid stuck state
        await dbDelete(action.id)
      }
      // 5xx: keep in queue for next retry
    } catch {
      break // Still offline
    }
  }
  await broadcastCount()
}

self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) event.waitUntil(processQueue())
})

self.addEventListener('message', event => {
  if (event.data === 'process-queue') processQueue()
  if (event.data === 'get-queue-count') broadcastCount()
})

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
