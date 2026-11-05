import React, { useState } from 'react'

export default function Login({ onLogin }) {
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
    <div className="login-screen">
      <main className="login-fullscreen">
        <section className="login-hero">
          <div className="login-hero-content">
            <div className="login-brand-lockup">
              <img src="/favicon.png" alt="" className="login-hero-logo" />
              <div>
                <strong>Chef&apos;s Hub</strong>
                <span>GESTÃO GASTRONÔMICA</span>
              </div>
            </div>

            <div className="login-welcome">
              <span className="login-eyebrow">TECNOLOGIA QUE MOVIMENTA SUA COZINHA</span>
              <h1>
                Seu restaurante,
                <br />
                <span>em boas mãos.</span>
              </h1>
              <p>
                Pedidos, cardápio, entregas e equipe conectados para você cuidar do que importa:
                servir bem.
              </p>
            </div>

            <div className="login-benefits">
              <div className="login-benefit">
                <div className="benefit-icon">01</div>
                <div>
                  <strong>Operação simples</strong>
                  <span>Rotina em um só lugar.</span>
                </div>
              </div>

              <div className="login-benefit">
                <div className="benefit-icon">02</div>
                <div>
                  <strong>Mais agilidade</strong>
                  <span>Do pedido à entrega.</span>
                </div>
              </div>

              <div className="login-benefit">
                <div className="benefit-icon">03</div>
                <div>
                  <strong>Visão do negócio</strong>
                  <span>Decisões com clareza.</span>
                </div>
              </div>
            </div>

            <div className="login-hero-footer">
              <span className="login-footer-mark" aria-hidden="true" />
              Gestão conectada ao ritmo do seu restaurante
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
              <span className="login-header-label">ÁREA ADMINISTRATIVA</span>
              <h2>Bem-vindo de volta</h2>
              <p>Entre para acompanhar a operação e cuidar do seu restaurante.</p>
            </div>

            <form id="loginForm" className="login-form" onSubmit={handleSubmit}>
              <div className="filter-group">
                <label htmlFor="loginEmail">E-mail</label>
                <input
                  id="loginEmail"
                  type="email"
                  name="email"
                  placeholder="seu@email.com"
                  autoComplete="username"
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
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <div id="loginError" className="login-error" role="alert" aria-live="polite">
                  {error}
                </div>
              )}

              <button className="btn btn-primary login-button" type="submit" disabled={isLoading}>
                <span>{isLoading ? 'Entrando...' : 'Entrar no painel'}</span>
                {!isLoading && (
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M4 10H16M16 10L10.5 4.5M16 10L10.5 15.5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </form>

          </div>
        </section>
      </main>
    </div>
  )
}