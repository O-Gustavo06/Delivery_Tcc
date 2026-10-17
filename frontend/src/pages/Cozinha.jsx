import React, { useMemo } from 'react'
import './Cozinha.css'

export default function Cozinha({ orders, kitchenData, statusLabels }) {
  const groups = useMemo(
    () => ({
      novo: orders.filter((order) => order.status === 'novo'),
      enviado_cozinha: orders.filter((order) => order.status === 'enviado_cozinha'),
      em_preparo: orders.filter((order) => order.status === 'em_preparo'),
      pronto: orders.filter((order) => order.status === 'pronto'),
    }),
    [orders],
  )

  return (
    <div className="kitchen-page">
      <section className="kitchen-stations" aria-label="Tempo e carga por estação">
        {kitchenData.stations.map((station, index) => (
          <article className="kitchen-station-note fade-in" style={{ '--i': index }} key={station.id}>
            <div>
              <span className="kitchen-note-label">{station.name}</span>
              <strong className="kitchen-station-time">{station.leadTime}</strong>
            </div>
            <div className="kitchen-station-meta">
              <span>{station.load}</span>
              <span>{station.team}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="kitchen-workflow">
        <div className="kitchen-section-head">
          <div>
            <h2>Fila da cozinha</h2>
            <p>Acompanhe os pedidos desde a chegada até a expedição.</p>
          </div>
        </div>
        <div className="kanban-grid">
          {Object.entries(groups).map(([status, items]) => (
            <section className="kanban-column" key={status} aria-label={statusLabels[status]}>
              <div className="kanban-head">
                <strong>{statusLabels[status]}</strong>
                <span>{items.length}</span>
              </div>
              <div className="kanban-stack">
                {items.length === 0 && <div className="kanban-empty">Sem pedidos</div>}
                {items.map((order) => (
                  <article
                    className={`ticket-card ${order.hasNewItems ? 'ticket-card-has-new' : ''}`}
                    data-status={order.status}
                    key={order.id}
                  >
                    <div className="ticket-head">
                      <strong>#{order.number}</strong>
                      <span>{order.createdAt}</span>
                    </div>
                    <p>
                      {order.type === 'mesa' && order.tableNumber != null ? `Mesa ${order.tableNumber} · ` : ''}
                      {order.customerName}
                    </p>
                    {order.hasNewItems && (
                      <span className="badge badge-red badge-blink">+ Novos itens · {order.lastAddedAt}</span>
                    )}
                    <ul>
                      {order.items.map((item, index) => (
                        <li key={`${order.id}-${index}`} className={item.is_new ? 'order-item-novo' : undefined}>
                          {item.qty}x {item.name}
                          {item.is_new && <span className="order-item-tag">novo</span>}
                          {item.note && <em style={{ fontStyle: 'normal', color: 'var(--muted)' }}> — {item.note}</em>}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="kitchen-mise">
        <div className="kitchen-section-head">
          <div>
            <h2>Notas de preparo</h2>
            <p>Itens para reposição ou preparo antecipado.</p>
          </div>
        </div>
        {kitchenData.prepList.length > 0 ? (
          <div className="kitchen-prep-notes">
            {kitchenData.prepList.map((item) => (
              <article className="kitchen-prep-note" key={item.id}>
                <div className="kitchen-prep-note-head">
                  <h3>{item.item}</h3>
                  <span>
                    {item.pending} {item.pending === 1 ? 'unidade pendente' : 'unidades pendentes'}
                  </span>
                </div>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="kitchen-empty-note">Nenhuma nota de preparo no momento.</p>
        )}
      </section>
    </div>
  )
}
