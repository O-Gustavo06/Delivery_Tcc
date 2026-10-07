import React, { useState } from 'react'

export default function Login({ onLogin, defaultEmail, defaultPassword }) {
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')

    const result = await onLogin(email, password)

    if (!result.ok) {
      setError(result.message || 'Não foi possível realizar o login.')
    }

    setIsLoading(false)
  }

  return (
    <main className="login-fullscreen">
      <section className="login-hero">
        <div className="login-hero-content">
          <img src="/favicon.png" alt="Chef's Hub" className="login-hero-logo" />

          <h1>Chef&apos;s Hub</h1>

          <div className="login-hero-line" />

          <p>
            Sistema de gestão para restaurantes, pedidos, entregas e controle operacional.
          </p>

          <div className="login-benefits">
            <div className="login-benefit">
              <div className="benefit-icon">▦</div>
              <div>
                <strong>Gestão completa</strong>
                <span>Tenha o controle total do seu restaurante.</span>
              </div>
            </div>

            <div className="login-benefit">
              <div className="benefit-icon">↻</div>
              <div>
                <strong>Mais agilidade</strong>
                <span>Pedidos, entregas e operações integradas.</span>
              </div>
            </div>

            <div className="login-benefit">
              <div className="benefit-icon">▥</div>
              <div>
                <strong>Decisões inteligentes</strong>
                <span>Relatórios em tempo real para o seu negócio.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card-pro">
          <div className="login-security-icon">
            <svg
              className="login-security-svg"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 3L18.5 5.5V10.8C18.5 15.2 15.8 19.2 12 21C8.2 19.2 5.5 15.2 5.5 10.8V5.5L12 3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M9.8 11.8L11.3 13.3L14.7 9.9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="login-header">
            <h2>Acesso administrativo</h2>
            <p>
              Entre com suas credenciais para acessar o painel e gerenciar seu restaurante.
            </p>
          </div>

          <form id="loginForm" className="login-form" onSubmit={handleSubmit}>
            <div className="filter-group">
              <label htmlFor="loginEmail">E-mail</label>
              <input
                id="loginEmail"
                type="email"
                name="email"
                placeholder="seu@email.com"
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
                placeholder="Sua senha"
                defaultValue={defaultPassword}
                required
              />
            </div>

            {error && (
              <div id="loginError" className="login-error" role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <button className="btn btn-primary login-button" type="submit" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar no painel'}
            </button>
          </form>

          <div className="login-demo">
            <span>DEMONSTRAÇÃO</span>
            <p>Use as credenciais abaixo para explorar o sistema:</p>

            <div className="login-demo-box">
              <strong>E-mail:</strong> {defaultEmail}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}