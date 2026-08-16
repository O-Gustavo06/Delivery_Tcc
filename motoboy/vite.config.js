import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const certPath = path.resolve(__dirname, '../.tools/dev-cert.pem')
const keyPath = path.resolve(__dirname, '../.tools/dev-key.pem')
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath)

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    https: hasCerts
      ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
      : undefined,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
