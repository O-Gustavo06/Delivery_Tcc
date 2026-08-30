import React, { useState } from 'react'

function LinkCardapioOnline() {
  const [status, setStatus] = useState('')
  const link = `${window.location.origin}/cardapio/pedir`

  const copiarLink = async () => {
    try {
      await window.navigator.clipboard.writeText(link)
      setStatus('Link copiado.')
    } catch {
      setStatus('Nao foi possivel copiar automaticamente. Copie pelo campo acima.')
    }
  }

  return (
    <>
      <label>Link publico do cardapio</label>
      <div className="link-publico">
        <input type="text" value={link} readOnly />
        <a className="link-publico-primary" href={link} target="_blank" rel="noreferrer">
          Abrir cardapio
        </a>
      </div>
      <div className="link-publico-actions">
        <button className="link-publico-secondary" type="button" onClick={copiarLink}>
          Copiar link
        </button>
      </div>
      {status && <small className="cardapio-link-status">{status}</small>}
      <small className="cardapio-hint">
        Produtos e fotos sao gerenciados direto no cardapio, nao precisa cadastrar nada aqui.
      </small>
    </>
  )
}

export default function Pedidos_Ifood({ marketplaceData }) {
  return (
    <div className="page-stack">
      <section className="page-grid page-grid-2-1">
        <div className="page-stack">
          <article className="card section-card fade-in" style={{ '--i': 0 }}>
            <div className="section-head">
              <div>
                <h2>Saude dos canais</h2>
                <p>Indicadores de disponibilidade e velocidade de resposta.</p>
              </div>
            </div>
            <div className="mini-grid">
              {marketplaceData.scorecards.map((item) => (
                <div className="info-tile" key={item.id}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.helper}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="card section-card fade-in" style={{ '--i': 1 }}>
            <div className="section-head">
              <div>
                <h2>Filas por integracao</h2>
                <p>Pedidos externos em andamento por origem.</p>
              </div>
            </div>
            <div className="data-table">
              {marketplaceData.queues.map((queue) => (
                <div className="data-row" key={queue.id} style={{ gridTemplateColumns: '1fr 0.5fr 0.6fr 1fr' }}>
                  <strong>{queue.source}</strong>
                  <span>{queue.total}</span>
                  <span>{queue.status}</span>
                  <span>{queue.note}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <article className="card section-card fade-in" style={{ '--i': 2 }}>
          <div className="section-head">
            <div>
              <h2>Plano de acao</h2>
              <p>Rotina sugerida para manter os canais externos estaveis.</p>
            </div>
          </div>
          <div className="check-list">
            {marketplaceData.actions.map((action) => (
              <div className="check-item" key={action}>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card section-card fade-in painel-section" style={{ '--i': 3 }}>
        <div className="section-head">
          <div>
            <h2>Cardapio Online</h2>
            <p>Link publico pro cliente pedir delivery direto, sem precisar de app.</p>
          </div>
        </div>
        <LinkCardapioOnline />
      </section>
    </div>
  )
}
