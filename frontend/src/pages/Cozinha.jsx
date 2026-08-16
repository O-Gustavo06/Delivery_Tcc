import React, { useMemo } from 'react'

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
    <>
      <section className="cards">
        {kitchenData.stations.map((station, index) => (
          <div className="card metric fade-in" style={{ '--i': index }} key={station.id}>
            <div>
              <span>{station.name}</span>
              <strong>{station.leadTime}</strong>
            </div>
            <div className="metric-meta">
              <span>{station.load}</span>
              <span>{station.team}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="page-grid page-grid-2-1">
        <article className="card section-card fade-in" style={{ '--i': kitchenData.stations.length }}>
          <div className="section-head">
            <div>
              <h2>Fila da cozinha</h2>
              <p>Acompanhe o fluxo do novo pedido ate a expedicao.</p>
            </div>
          </div>
          <div className="kanban-grid">
            {Object.entries(groups).map(([status, items]) => (
              <div className="kanban-column" key={status}>
                <div className="kanban-head">
                  <strong>{statusLabels[status]}</strong>
                  <span>{items.length}</span>
                </div>
                <div className="kanban-stack">
                  {items.length === 0 && <div className="kanban-empty">Sem pedidos</div>}
                  {items.map((order) => (
                    <article className="ticket-card" key={order.id}>
                      <div className="ticket-head">
                        <strong>#{order.number}</strong>
                        <span>{order.createdAt}</span>
                      </div>
                      <p>{order.customerName}</p>
                      <ul>
                        {order.items.map((item, index) => (
                          <li key={`${order.id}-${index}`}>{item.qty}x {item.name}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="page-stack">
          <article className="card section-card fade-in" style={{ '--i': kitchenData.stations.length + 1 }}>
            <div className="section-head">
              <div>
                <h2>Mise en place</h2>
                <p>Itens com reposicao ou preparo antecipado.</p>
              </div>
            </div>
            <div className="data-table">
              {kitchenData.prepList.map((item) => (
                <div className="data-row" key={item.id} style={{ gridTemplateColumns: '1.2fr 0.5fr 1fr' }}>
                  <strong>{item.item}</strong>
                  <span>{item.pending} pend.</span>
                  <span>{item.note}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  )
}
