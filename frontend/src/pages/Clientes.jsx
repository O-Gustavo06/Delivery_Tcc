import React, { useState } from 'react'

function SegmentoModal({ segmento, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Clientes {segmento.name}</h2>
            <p>{segmento.note}</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        {segmento.clientes.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Nenhum cliente nesse segmento ainda.</p>
        ) : (
          <div className="data-table">
            <div className="data-row row-head" style={{ gridTemplateColumns: '1fr 0.5fr 0.6fr' }}>
              <span>Cliente</span>
              <span>Pedidos</span>
              <span>Ticket medio</span>
            </div>
            {segmento.clientes.map((cliente) => (
              <div className="data-row" key={cliente.id} style={{ gridTemplateColumns: '1fr 0.5fr 0.6fr' }}>
                <strong>{cliente.nome}</strong>
                <span>{cliente.pedidos}</span>
                <span>{cliente.ticketMedio}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Clientes({ customersData }) {
  const [segmentoAberto, setSegmentoAberto] = useState(null)

  return (
    <section className="page-grid page-grid-2-1">
      <div className="page-stack">
        <article className="card section-card fade-in" style={{ '--i': 0 }}>
          <div className="section-head">
            <div>
              <h2>Segmentos</h2>
              <p>Distribuicao da base por recorrencia e valor medio — toque num segmento pra ver os clientes.</p>
            </div>
          </div>
          <div className="mini-grid">
            {customersData.segments.map((segment) => (
              <button
                type="button"
                className="info-tile"
                key={segment.id}
                onClick={() => setSegmentoAberto(segment)}
                style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%' }}
              >
                <span>{segment.name}</span>
                <strong>{segment.customers} clientes</strong>
                <p>{segment.average}</p>
                <span>{segment.note}</span>
              </button>
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

      {segmentoAberto && (
        <SegmentoModal segmento={segmentoAberto} onClose={() => setSegmentoAberto(null)} />
      )}
    </section>
  )
}
