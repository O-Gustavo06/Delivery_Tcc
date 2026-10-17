const CACHE_NAME = 'motoboy-shell-v3'
// Caminhos relativos ao proprio sw.js - o app roda em /motoboy/, nao na raiz.
const APP_SHELL = ['./', './favicon.png', './manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return

  // Network-first, cache so como fallback offline - cache-first prendia quem ja tinha
  // instalado o app numa versao antiga pra sempre, sem nunca buscar atualizacao de novo.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
      .catch(() => caches.match(request)),
  )
})
