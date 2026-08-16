import React, { useCallback, useState } from 'react'
import Scanner from './Scanner.jsx'
import Clock from '../components/Clock.jsx'

export default function Pareamento({ onPair }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleDetect = useCallback(async (codigo) => {
    setBusy(true)
    setError('')
    const result = await onPair(codigo)
    if (!result.ok) {
      setError(result.message)
    }
    setBusy(false)
  }, [onPair])

  return (
    <main className="mobile-login-wrap">
      <Clock />
      <div className="login-card-pro" style={{ maxWidth: 420 }}>
        <div className="login-header">
          <h2>Motoboy</h2>
          <p>Peca pro administrador mostrar o QR de confirmacao na tela dele e bipe abaixo pra entrar.</p>
        </div>

        <Scanner
          onDetect={handleDetect}
          busy={busy}
          error={error}
          hintIdle="Aponte para o QR do administrador"
          hintBusy="Confirmando..."
          manualPlaceholder="Ou digite o codigo de confirmacao"
          manualButtonLabel="Entrar"
        />
      </div>
    </main>
  )
}
