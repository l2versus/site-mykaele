// Myka Home Spa — Service Worker v1
// Offline-first caching strategy for premium app experience

const CACHE_NAME = 'myka-spa-v1'
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/offline',
]

// Install: pre-cache shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    )
    self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    )
    self.clients.claim()
})

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Skip non-GET
    if (request.method !== 'GET') return

    // API calls: network-first with 3s timeout
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            Promise.race([
                fetch(request).then((res) => {
                    if (res.ok) {
                        const clone = res.clone()
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
                    }
                    return res
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
            ]).catch(() => caches.match(request))
        )
        return
    }

    // Static assets: stale-while-revalidate
    if (
        url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|avif|svg|woff2?|ico)$/) ||
        url.pathname.startsWith('/_next/')
    ) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const fetchPromise = fetch(request).then((res) => {
                    if (res.ok && res.status !== 206) {
                        const clone = res.clone()
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
                    }
                    return res
                })
                return cached || fetchPromise
            })
        )
        return
    }

    // Pages: network-first, fallback to cache then offline page
    event.respondWith(
        fetch(request)
            .then((res) => {
                if (res.ok && res.status !== 206) {
                    const clone = res.clone()
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
                }
                return res
            })
            .catch(() => caches.match(request).then((cached) => cached || caches.match('/offline')))
    )
})

// Push notification handler
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {}
    const options = {
        body: data.body || 'Você tem uma novidade na Myka Spa!',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/' },
        actions: data.actions || [
            { action: 'open', title: 'Ver agora' },
            { action: 'dismiss', title: 'Depois' },
        ],
        tag: data.tag || 'myka-notification',
        renotify: true,
    }
    event.waitUntil(
        self.registration.showNotification(data.title || '✨ Myka Spa', options)
    )
})

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    if (event.action === 'dismiss') return
    const url = event.notification.data?.url || '/'
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            const existing = clients.find((c) => c.url.includes(url))
            if (existing) return existing.focus()
            return self.clients.openWindow(url)
        })
    )
})
