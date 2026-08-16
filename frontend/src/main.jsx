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
