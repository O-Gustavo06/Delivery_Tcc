import React, { useCallback, useState } from 'react'
import Scanner from './Scanner.jsx'
import Clock from '../components/Clock.jsx'

export default function Pareamento({ onPair, onLogin }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const handleDetect = useCallback(async (codigo) => {
    setBusy(true)
    setError('')
    const result = await onPair(codigo)
    if (!result.ok) {
      setError(result.message)
    }
    setBusy(false)
  }, [onPair])

  const handleLogin = async (event) => {
    event.preventDefault()
    setBusy(true)
    setLoginError('')
    const result = await onLogin(email, password)
    if (!result.ok) setLoginError(result.message)
    setBusy(false)
  }

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
        <form className="login-form" onSubmit={handleLogin} style={{ display: 'grid', gap: 12, marginTop: 24 }}>
          <strong>Equipe do restaurante</strong>
          <label className="filter-group">E-mail
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="filter-group">Senha
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {loginError && <p role="alert">{loginError}</p>}
          <button className="btn btn-primary login-button" type="submit" disabled={busy}>{busy ? 'Entrando...' : 'Entrar com e-mail e senha'}</button>
        </form>
      </div>
    </main>
  )
}
