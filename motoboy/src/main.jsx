import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import App from './App.jsx'

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
