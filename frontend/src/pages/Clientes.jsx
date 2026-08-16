import React from 'react'

export default function Clientes({ customersData }) {
  return (
    <section className="page-grid page-grid-2-1">
      <div className="page-stack">
        <article className="card section-card fade-in" style={{ '--i': 0 }}>
          <div className="section-head">
            <div>
              <h2>Segmentos</h2>
              <p>Distribuicao da base por recorrencia e valor medio.</p>
            </div>
          </div>
          <div className="mini-grid">
            {customersData.segments.map((segment) => (
              <div className="info-tile" key={segment.id}>
                <span>{segment.name}</span>
                <strong>{segment.customers} clientes</strong>
                <p>{segment.average}</p>
                <span>{segment.note}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card section-card fade-in" style={{ '--i': 1 }}>
          <div className="section-head">
            <div>
              <h2>Clientes em destaque</h2>
              <p>Relacionamento e comportamento recente de compra.</p>
            </div>
          </div>
          <div className="data-table">
            {customersData.spotlight.map((customer) => (
              <div className="data-row" key={customer.id} style={{ gridTemplateColumns: '1fr 0.6fr 0.8fr 0.8fr' }}>
                <strong>{customer.name}</strong>
                <span>{customer.orders} pedidos</span>
                <span>{customer.favorite}</span>
                <span>{customer.lastOrder}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="card section-card fade-in" style={{ '--i': 2 }}>
        <div className="section-head">
          <div>
            <h2>Campanhas</h2>
            <p>Acoes sugeridas para reter e ativar clientes.</p>
          </div>
        </div>
        <div className="check-list">
          {customersData.campaigns.map((campaign) => (
            <div className="check-item" key={campaign}>
              <span>{campaign}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
