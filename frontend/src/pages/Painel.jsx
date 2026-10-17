import React, { useMemo } from 'react'
import './Painel.css'

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
    <div className="dashboard-page">
      <section className="dashboard-stats" aria-label="Resumo do turno">
        <div className="dashboard-stat">
          <span>Faturamento do turno</span>
          <strong>{formatMoney(stats.revenue)}</strong>
        </div>
        <div className="dashboard-stat">
          <span>Ticket médio</span>
          <strong>{formatMoney(stats.averageTicket)}</strong>
        </div>
        <div className="dashboard-stat">
          <span>Mesas ocupadas</span>
          <strong>{stats.occupiedTables}</strong>
        </div>
        <div className="dashboard-stat">
          <span>Entregas em rota</span>
          <strong>{stats.activeDeliveries}</strong>
        </div>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <section className="dashboard-section" aria-labelledby="dashboard-channels-title">
            <div className="dashboard-section-head">
              <div>
                <h2 id="dashboard-channels-title">Visão por canal</h2>
                <p>Pedidos e receita por origem</p>
              </div>
              <span className="dashboard-updated">Atualizado agora</span>
            </div>
            {panelData.channels.length > 0 ? (
              <div className="dashboard-channels">
                {panelData.channels.map((channel) => (
                  <div className="dashboard-channel" key={channel.id}>
                    <span className="dashboard-channel-name">{channel.label}</span>
                    <strong>{channel.orders} pedidos</strong>
                    <div className="dashboard-channel-details">
                      <span>{formatMoney(channel.revenue)}</span>
                      <span className="dashboard-trend">{channel.delta}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-empty">Ainda não há dados por canal.</p>
            )}
          </section>

          <section className="dashboard-section" aria-labelledby="dashboard-orders-title">
            <div className="dashboard-section-head">
              <div>
                <h2 id="dashboard-orders-title">Radar operacional</h2>
                <p>Pedidos recentes e andamento da operação</p>
              </div>
              <span className="dashboard-updated">Equipe online: {stats.activeUsers}</span>
            </div>
            <div className="dashboard-orders" role="table" aria-label="Pedidos recentes">
              <div className="dashboard-order dashboard-order-head" role="row">
                <span role="columnheader">Pedido</span>
                <span role="columnheader">Cliente</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Total</span>
              </div>
              {orders.length > 0 ? (
                orders.map((order) => (
                  <div className="dashboard-order" key={order.id} role="row">
                    <strong role="cell">#{order.number}</strong>
                    <span role="cell">{order.customerName}</span>
                    <span className="dashboard-status" data-status={order.status} role="cell">
                      {order.status.replaceAll('_', ' ')}
                    </span>
                    <span role="cell">{formatMoney(order.total)}</span>
                  </div>
                ))
              ) : (
                <p className="dashboard-empty">Nenhum pedido recente.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="dashboard-aside">
          <section className="dashboard-section" aria-labelledby="dashboard-alerts-title">
            <div className="dashboard-section-head">
              <div>
                <h2 id="dashboard-alerts-title">Alertas</h2>
                <p>Pontos que exigem atenção</p>
              </div>
            </div>
            {panelData.alerts.length > 0 ? (
              <div className="dashboard-notices">
                {panelData.alerts.map((alert) => (
                  <div className="dashboard-notice" data-tone={alert.tone} key={alert.id}>
                    <strong>{alert.title}</strong>
                    <p>{alert.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-empty">Nenhum alerta no momento.</p>
            )}
          </section>

          <section className="dashboard-section" aria-labelledby="dashboard-timeline-title">
            <div className="dashboard-section-head">
              <div>
                <h2 id="dashboard-timeline-title">Linha do tempo</h2>
                <p>Atividade recente</p>
              </div>
            </div>
            {panelData.timeline.length > 0 ? (
              <div className="dashboard-timeline">
                {panelData.timeline.map((event) => (
                  <div className="dashboard-timeline-event" key={`${event.time}-${event.title}`}>
                    <time>{event.time}</time>
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-empty">Nenhuma atividade recente.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
