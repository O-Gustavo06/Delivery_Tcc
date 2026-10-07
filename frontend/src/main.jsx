import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import App from './App.jsx'

// O painel admin, o cardapio online e a mesa sao paginas diferentes do MESMO app (mesma
// porta/dominio), mas cada uma precisa instalar como um PWA proprio - senao o manifest fixo
// (start_url "/") faz o icone instalado a partir do cardapio ou da mesa abrir sempre o login
// do admin. Troca o <link rel="manifest"> por um gerado na hora com start_url/scope da pagina
// atual antes do usuario poder instalar (a instalacao e sempre uma acao manual dele, entao nao
// ha corrida contra o parser aqui).
async function ajustarManifestPelaRota() {
  const path = window.location.pathname
  let overrides = null

  if (path.startsWith('/cardapio/')) {
    overrides = {
      name: "Cardápio Online - Chef's Hub",
      short_name: 'Cardápio',
      start_url: path,
      scope: '/cardapio/',
    }
  } else if (path.startsWith('/mesa/')) {
    overrides = {
      name: "Mesa - Chef's Hub",
      short_name: 'Mesa',
      start_url: path,
      scope: path,
    }
  }

  if (!overrides) return

  try {
    const base = await fetch('/manifest.webmanifest').then((response) => response.json())
    const manifest = { ...base, ...overrides }
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
    const link = document.querySelector('link[rel="manifest"]')
    if (link) link.setAttribute('href', URL.createObjectURL(blob))
  } catch {
    // Falhou: fica com o manifest padrao mesmo (start_url "/"), mesmo comportamento de antes.
  }
}

ajustarManifestPelaRota()

const container = document.getElementById('app')

if (!container) {
  throw new Error('App root not found')
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // So registra em build de producao: em dev ele faz cache-first de tudo e passa a
    // servir versoes velhas dos arquivos, brigando com o hot-reload do Vite.
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  } else {
    // Auto-limpeza pra quem visitou o app em dev antes dessa guarda existir e ficou com
    // um service worker preso servindo versao antiga.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister())
    })
    if (window.caches) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
    }
  }
}
