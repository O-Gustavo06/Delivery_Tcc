import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const certPath = path.resolve(__dirname, '../.tools/dev-cert.pem')
const keyPath = path.resolve(__dirname, '../.tools/dev-key.pem')
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath)
const useHttps = process.env.VITE_USE_HTTPS === 'true'

// Mesma lista do frontend - qualquer subdominio do ngrok.
const allowedHosts = ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app', '.ngrok.io', '.ngrok.dev']

export default defineConfig({
  // Servido em /motoboy/ pra caber no mesmo dominio do ngrok que o painel/cardapio: o
  // frontend (5173) faz proxy de /motoboy pra ca. Acesso direto na rede local continua
  // funcionando em http://<ip>:5174/motoboy/ (ou HTTPS com VITE_USE_HTTPS=true).
  base: '/motoboy/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    allowedHosts,
    https: hasCerts && useHttps
      ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
      : undefined,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    allowedHosts,
    https: hasCerts && useHttps
      ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
      : undefined,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
