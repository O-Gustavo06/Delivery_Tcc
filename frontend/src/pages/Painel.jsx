import React, { useMemo } from 'react'

const formatMoney = (value) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Painel({ orders, users, panelData, tablesData }) {
  const stats = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + order.total, 0)
    const averageTicket = orders.length ? revenue / orders.length : 0
    const activeDeliveries = orders.filter((order) => order.status === 'saiu_entrega').length

    return {
      revenue,
      averageTicket,
      activeDeliveries,
      occupiedTables: tablesData.summary.occupied,
      activeUsers: users.length || 12,
    }
  }, [orders, tablesData.summary.occupied, users.length])

  return (
    <>
      <section className="cards">
        <div className="card metric fade-in" style={{ '--i': 0 }}>
          <div>
            <span>Faturamento do turno</span>
            <strong>{formatMoney(stats.revenue)}</strong>
          </div>
          <div className="metric-icon badge-green">R$</div>
        </div>
        <div className="card metric fade-in" style={{ '--i': 1 }}>
          <div>
            <span>Ticket medio</span>
            <strong>{formatMoney(stats.averageTicket)}</strong>
          </div>
          <div className="metric-icon badge-blue">TM</div>
        </div>
        <div className="card metric fade-in" style={{ '--i': 2 }}>
          <div>
            <span>Mesas ocupadas</span>
            <strong>{stats.occupiedTables}</strong>
          </div>
          <div className="metric-icon badge-orange">MS</div>
        </div>
        <div className="card metric fade-in" style={{ '--i': 3 }}>
          <div>
            <span>Entregas em rota</span>
            <strong>{stats.activeDeliveries}</strong>
          </div>
          <div className="metric-icon badge-lime">RT</div>
        </div>
      </section>

      <section className="page-grid page-grid-2-1">
        <div className="page-stack">
          <article className="card section-card fade-in" style={{ '--i': 4 }}>
            <div className="section-head">
              <div>
                <h2>Visao por canal</h2>
                <p>Distribuicao de pedidos e receita por origem.</p>
              </div>
              <span className="badge badge-muted">Atualizado agora</span>
            </div>
            <div className="mini-grid">
              {panelData.channels.map((channel) => (
                <div className="info-tile" key={channel.id}>
                  <span>{channel.label}</span>
                  <strong>{channel.orders} pedidos</strong>
                  <p>{formatMoney(channel.revenue)}</p>
                  <span className="trend positive">{channel.delta}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="card section-card fade-in" style={{ '--i': 5 }}>
            <div className="section-head">
              <div>
                <h2>Radar operacional</h2>
                <p>Pedidos recentes com foco em execucao e fluxo.</p>
              </div>
              <span className="section-note">Equipe online: {stats.activeUsers}</span>
            </div>
            <div className="data-table">
              <div className="data-row row-head" style={{ gridTemplateColumns: '0.8fr 1.2fr 1fr 0.8fr' }}>
                <span>Pedido</span>
                <span>Cliente</span>
                <span>Status</span>
                <span>Total</span>
              </div>
              {orders.map((order) => (
                <div className="data-row" key={order.id} style={{ gridTemplateColumns: '0.8fr 1.2fr 1fr 0.8fr' }}>
                  <strong>#{order.number}</strong>
                  <span>{order.customerName}</span>
                  <span className="badge badge-light">{order.status.replaceAll('_', ' ')}</span>
                  <span>{formatMoney(order.total)}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="page-stack">
          <article className="card section-card fade-in" style={{ '--i': 6 }}>
            <div className="section-head">
              <div>
                <h2>Alertas</h2>
                <p>Pontos que exigem acao da gerencia.</p>
              </div>
            </div>
            <div className="notice-list">
              {panelData.alerts.map((alert) => (
                <div className={`notice notice-${alert.tone}`} key={alert.id}>
                  <strong>{alert.title}</strong>
                  <p>{alert.description}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="card section-card fade-in" style={{ '--i': 7 }}>
            <div className="section-head">
              <div>
                <h2>Linha do tempo</h2>
                <p>Eventos importantes da operacao durante o dia.</p>
              </div>
            </div>
            <div className="timeline-list">
              {panelData.timeline.map((event) => (
                <div className="timeline-item" key={`${event.time}-${event.title}`}>
                  <span className="timeline-time">{event.time}</span>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  )
}
