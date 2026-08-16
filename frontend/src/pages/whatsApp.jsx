import React from 'react'

export default function WhatsApp({ whatsappData }) {
  return (
    <section className="page-grid page-grid-2-1">
      <div className="page-stack">
        <article className="card section-card fade-in" style={{ '--i': 0 }}>
          <div className="section-head">
            <div>
              <h2>Caixa de entrada</h2>
              <p>Volume atual de contatos e distribuicao por assunto.</p>
            </div>
          </div>
          <div className="mini-grid">
            {whatsappData.inbox.map((item) => (
              <div className="info-tile" key={item.id}>
                <span>{item.channel}</span>
                <strong>{item.total}</strong>
                <p>Conversas ativas</p>
                <span className={`badge badge-${item.tone}`}>Em andamento</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card section-card fade-in" style={{ '--i': 1 }}>
          <div className="section-head">
            <div>
              <h2>Automacoes</h2>
              <p>Fluxos que ajudam a vender e acompanhar pedidos.</p>
            </div>
          </div>
          <div className="data-table">
            {whatsappData.automations.map((automation) => (
              <div className="data-row" key={automation.id} style={{ gridTemplateColumns: '1fr 1fr 0.6fr' }}>
                <strong>{automation.name}</strong>
                <span>{automation.trigger}</span>
                <span>{automation.status}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="card section-card fade-in" style={{ '--i': 2 }}>
        <div className="section-head">
          <div>
            <h2>Campanhas agendadas</h2>
            <p>Envios planejados para ativacao e recompra.</p>
          </div>
        </div>
        <div className="data-table">
          {whatsappData.campaigns.map((campaign) => (
            <div className="data-row" key={campaign.id} style={{ gridTemplateColumns: '1fr 1fr 0.6fr' }}>
              <strong>{campaign.title}</strong>
              <span>{campaign.audience}</span>
              <span>{campaign.sendAt}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
