import React, { useMemo } from 'react'

export default function Pedidos({ orders, filters, setFilters, statusLabels, statusTone, onUpdateStatus }) {
  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase()

    return orders.filter((order) => {
      const matchesStatus = filters.status === 'all' || order.status === filters.status
      const matchesType = filters.type === 'all' || order.type === filters.type
      const matchesSearch =
        !search ||
        order.customerName.toLowerCase().includes(search) ||
        order.number.toString().includes(search) ||
        order.items.some((item) => item.name.toLowerCase().includes(search))

      return matchesStatus && matchesType && matchesSearch
    })
  }, [filters, orders])

  const counts = useMemo(
    () =>
      orders.reduce(
        (acc, order) => {
          acc.total += 1
          acc[order.status] += 1
          return acc
        },
        {
          total: 0,
          novo: 0,
          enviado_cozinha: 0,
          em_preparo: 0,
          pronto: 0,
          saiu_entrega: 0,
          entregue: 0,
          cancelado: 0,
        },
      ),
    [orders],
  )

  const formatMoney = (value) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const getActions = (order) => {
    const actions = []

    if (order.status === 'novo') {
      actions.push({ label: 'Enviar cozinha', action: 'send-kitchen', primary: true })
    }

    if (order.status === 'enviado_cozinha') {
      actions.push({ label: 'Iniciar preparo', action: 'start-prep', primary: true })
    }

    if (order.status === 'em_preparo') {
      actions.push({ label: 'Marcar pronto', action: 'mark-ready', primary: true })
    }

    if (order.status === 'pronto') {
      if (order.type === 'delivery') {
        actions.push({ label: 'Saiu entrega', action: 'start-delivery', primary: true })
      } else {
        actions.push({ label: 'Finalizar pedido', action: 'complete', primary: true })
      }
    }

    if (order.status === 'saiu_entrega') {
      actions.push({ label: 'Confirmar entrega', action: 'complete', primary: true })
    }

    if (order.status !== 'entregue' && order.status !== 'cancelado') {
      actions.push({ label: 'Cancelar', action: 'cancel' })
    }

    return actions
  }

  const handleAction = async (orderId, action) => {
    switch (action) {
      case 'send-kitchen':
        await onUpdateStatus(orderId, 'enviado_cozinha')
        break
      case 'start-prep':
        await onUpdateStatus(orderId, 'em_preparo')
        break
      case 'mark-ready':
        await onUpdateStatus(orderId, 'pronto')
        break
      case 'start-delivery':
        await onUpdateStatus(orderId, 'saiu_entrega')
        break
      case 'complete':
        await onUpdateStatus(orderId, 'entregue')
        break
      case 'cancel':
        await onUpdateStatus(orderId, 'cancelado')
        break
      default:
        break
    }
  }

  return (
    <>
      <section className="cards">
        <div className="card metric">
          <div>
            <span>Total hoje</span>
            <strong>{counts.total}</strong>
          </div>
          <div className="metric-icon badge-orange">{counts.novo}</div>
        </div>
        <div className="card metric">
          <div>
            <span>Cozinha</span>
            <strong>{counts.enviado_cozinha + counts.em_preparo}</strong>
          </div>
          <div className="metric-icon badge-blue">{counts.em_preparo}</div>
        </div>
        <div className="card metric">
          <div>
            <span>Prontos</span>
            <strong>{counts.pronto}</strong>
          </div>
          <div className="metric-icon badge-green">{counts.pronto}</div>
        </div>
        <div className="card metric">
          <div>
            <span>Entrega</span>
            <strong>{counts.saiu_entrega}</strong>
          </div>
          <div className="metric-icon badge-lime">{counts.saiu_entrega}</div>
        </div>
      </section>

      <section className="filters card">
        <div className="filter-group">
          <label>Busca</label>
          <input
            id="filterSearch"
            type="search"
            placeholder="Cliente, numero ou item"
            value={filters.search}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                search: event.target.value,
              }))
            }
          />
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select
            id="filterStatus"
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                status: event.target.value,
              }))
            }
          >
            <option value="all">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Tipo</label>
          <select
            id="filterType"
            value={filters.type}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                type: event.target.value,
              }))
            }
          >
            <option value="all">Todos</option>
            <option value="mesa">Mesa</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>
        <div className="filter-group filter-actions">
          <button
            className="btn btn-light"
            id="filterReset"
            type="button"
            onClick={() => setFilters({ search: '', status: 'all', type: 'all' })}
          >
            Limpar filtros
          </button>
        </div>
      </section>

      <section className="status-tabs">
        {[
          { label: 'Todos', value: 'all' },
          { label: 'Novos', value: 'novo' },
          { label: 'Cozinha', value: 'enviado_cozinha' },
          { label: 'Preparando', value: 'em_preparo' },
          { label: 'Prontos', value: 'pronto' },
          { label: 'Entrega', value: 'saiu_entrega' },
        ].map((tab) => (
          <button
            key={tab.value}
            className={`tab ${filters.status === tab.value ? 'active' : ''}`}
            data-tab={tab.value}
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, status: tab.value }))}
          >
            {tab.label}
          </button>
        ))}
      </section>

      <section className="orders">
        {filtered.map((order, index) => {
          const nextActions = getActions(order)
          return (
            <article className="card order-card fade-in" style={{ '--i': index }} key={order.id}>
              <div className="order-header">
                <div>
                  <span className="order-number">#{order.number}</span>
                  <span className={`badge ${statusTone[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                </div>
                <span className="order-time">{order.createdAt}</span>
              </div>
              <div className="order-body">
                <div>
                  <h3>{order.customerName}</h3>
                  <p>{order.type === 'mesa' ? `Mesa ${order.tableNumber}` : order.address}</p>
                  <ul>
                    {order.items.map((item, itemIndex) => (
                      <li key={`${item.name}-${itemIndex}`}>
                        {item.qty}x {item.name}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="order-total">
                  <span>Total</span>
                  <strong>{formatMoney(order.total)}</strong>
                  <span className="badge badge-muted">{order.type}</span>
                </div>
              </div>
              <div className="order-actions">
                {nextActions.map((action) => (
                  <button
                    key={action.action}
                    className={`btn ${action.primary ? 'btn-primary' : 'btn-light'}`}
                    type="button"
                    onClick={() => handleAction(order.id, action.action)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </article>
          )
        })}
      </section>
    </>
  )
}
