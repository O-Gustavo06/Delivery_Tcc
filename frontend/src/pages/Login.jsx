import React, { useState } from 'react'

export default function Login({ onLogin, defaultEmail, defaultPassword }) {
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '')
    const password = String(formData.get('password') || '')

    const result = await onLogin(email, password)
    if (!result.ok) {
      setError(result.message)
    }

    setIsLoading(false)
  }

  return (
    <section className="card login-card">
      <div>
        <h2>Login</h2>
        <p>Use suas credenciais de administrador para acessar o painel.</p>
      </div>
      <form id="loginForm" className="login-form" onSubmit={handleSubmit}>
        <div className="filter-group">
          <label htmlFor="loginEmail">Email</label>
          <input
            id="loginEmail"
            type="email"
            name="email"
            defaultValue={defaultEmail}
            required
          />
        </div>
        <div className="filter-group">
          <label htmlFor="loginPassword">Senha</label>
          <input
            id="loginPassword"
            type="password"
            name="password"
            defaultValue={defaultPassword}
            required
          />
        </div>
        <div className="login-actions">
          <button className="btn btn-primary" type="submit" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
        <div id="loginError" className="login-error" role="alert" aria-live="polite">
          {error}
        </div>
      </form>
      <div className="login-footer">
        <span>Ambiente demo: {defaultEmail}</span>
      </div>
    </section>
  )
}
