const CACHE_NAME = 'restaurante-shell-v2'
const APP_SHELL = ['/', '/favicon.png', '/manifest.webmanifest']

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
  // Nunca cacheia chamada de API - painel, cardapio online e mesa dependem de dado sempre
  // fresco (pedidos, estoque, status da loja, polling de 15s etc). So o shell estatico
  // (JS/CSS/HTML/icones) e cacheado, pra abrir rapido e funcionar offline.
  if (request.url.includes('/api/')) return

  // Network-first, cache so como fallback pra quando cair a conexao. Cache-first (como era
  // antes) prendia quem ja tinha instalado o app numa versao antiga pra sempre - toda mudanca
  // de codigo (JS/CSS/HTML) ficava invisivel, porque o SW nunca ia de novo na rede buscar a
  // versao nova enquanto tivesse qualquer coisa em cache. Aqui sempre tenta a rede primeiro (o
  // caso comum, com internet) e so usa o cache guardado se a rede falhar de verdade.
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

// Notificacao push real de status do pedido (PushNotificationService no backend). O payload
// e um JSON simples {titulo, corpo, url} - ver PedidoOnlineController::inscreverPush.
self.addEventListener('push', (event) => {
  let dados = { titulo: "Chef's Hub", corpo: 'Seu pedido foi atualizado.', url: '/cardapio/pedir' }
  try {
    dados = { ...dados, ...event.data.json() }
  } catch {
    // payload vazio ou nao-JSON: usa o texto padrao acima mesmo
  }

  event.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: { url: dados.url },
    }),
  )
})

// Clicar na notificacao foca uma aba ja aberta do cardapio (se tiver) em vez de abrir outra.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/cardapio/pedir'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existente = clientList.find((client) => client.url.includes(url))
      if (existente) return existente.focus()
      return self.clients.openWindow(url)
    }),
  )
})
