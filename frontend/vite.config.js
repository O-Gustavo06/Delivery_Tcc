import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const certPath = path.resolve(__dirname, '../.tools/dev-cert.pem')
const keyPath = path.resolve(__dirname, '../.tools/dev-key.pem')
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath)
const useHttps = process.env.VITE_USE_HTTPS === 'true'

// Qualquer subdominio do ngrok (o ponto na frente libera o dominio e todos os subdominios),
// pra nao precisar editar isso toda vez que o dominio do tunel mudar.
const allowedHosts = ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app', '.ngrok.io', '.ngrok.dev']

// O ngrok gratis so tem UM dominio fixo, entao o tunel aponta so pra ca (5173) e daqui sai
// tudo: /api e /images pro backend e /motoboy pro app do motoboy (que roda com base
// /motoboy/ na 5174, usando o mesmo protocolo do frontend).
const proxy = {
  '/api': 'http://localhost:8000',
  '/images': 'http://localhost:8000',
  '/motoboy': {
    target: `${hasCerts && useHttps ? 'https' : 'http'}://127.0.0.1:5174`,
    changeOrigin: true,
    secure: false,
    ws: true,
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts,
    https: hasCerts && useHttps
      ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
      : undefined,
    proxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts,
    https: hasCerts && useHttps
      ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
      : undefined,
    proxy,
  },
})
