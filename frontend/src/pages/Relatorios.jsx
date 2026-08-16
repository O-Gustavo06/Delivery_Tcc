import React from 'react'

export default function Relatorios({ reportsData }) {
  return (
    <section className="page-grid page-grid-2-1">
      <div className="page-stack">
        <article className="card section-card fade-in" style={{ '--i': 0 }}>
          <div className="section-head">
            <div>
              <h2>Relatorios principais</h2>
              <p>Resumo dos indicadores mais relevantes para gestao.</p>
            </div>
          </div>
          <div className="mini-grid">
            {reportsData.cards.map((card) => (
              <div className="info-tile" key={card.id}>
                <span>{card.period}</span>
                <strong>{card.title}</strong>
                <p>{card.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="card section-card fade-in" style={{ '--i': 1 }}>
          <div className="section-head">
            <div>
              <h2>Produtos lideres</h2>
              <p>Itens com maior giro e faturamento.</p>
            </div>
          </div>
          <div className="data-table">
            {reportsData.topProducts.map((product) => (
              <div className="data-row" key={product.id} style={{ gridTemplateColumns: '1fr 0.5fr 0.8fr' }}>
                <strong>{product.name}</strong>
                <span>{product.orders} pedidos</span>
                <span>{product.revenue}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="card section-card fade-in" style={{ '--i': 2 }}>
        <div className="section-head">
          <div>
            <h2>Agenda de exportacao</h2>
            <p>Entregas automaticas de relatorios e consolidacoes.</p>
          </div>
        </div>
        <div className="data-table">
          {reportsData.exports.map((entry) => (
            <div className="data-row" key={entry.id} style={{ gridTemplateColumns: '1fr 1fr 0.8fr' }}>
              <strong>{entry.name}</strong>
              <span>{entry.schedule}</span>
              <span>{entry.target}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
