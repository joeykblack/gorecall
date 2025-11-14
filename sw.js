const CACHE_NAME = 'gorecall-v1'
const APP_SHELL = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/index.css',
  '/manifest.webmanifest',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  // For same-origin requests, try cache first then network fallback
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => {
      // If fetch fails, optionally return cached index.html for navigation
      if (event.request.mode === 'navigate') return caches.match('/index.html')
    }))
  )
})
