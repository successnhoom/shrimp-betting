// Service Worker — Web Push handler
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || '🦐 บ่อตกกุ้ง', {
      body:  data.body  || '',
      icon:  data.icon  || '/icon-192.png',
      badge: '/icon-192.png',
      data:  { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})

// Cache static assets
const CACHE = 'shrimp-v1'
const STATIC = ['/', '/bet', '/wallet', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('/api/')) return // Never cache API
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  )
})
