import React, { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'

function PedidoQrModal({ order, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    let cancelado = false
    QRCode.toDataURL(order.codigoQr, { width: 260, margin: 1 }).then((url) => {
      if (!cancelado) setQrDataUrl(url)
    })
    return () => {
      cancelado = true
    }
  }, [order.codigoQr])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()} style={{ display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center' }}>
        <div className="modal-head" style={{ width: '100%' }}>
          <div>
            <h2>QR do pedido #{order.number}</h2>
            {order.deliveryNumber != null && (
              <span className="badge badge-blue" style={{ marginTop: 4 }}>Delivery #{order.deliveryNumber}</span>
            )}
            <p style={{ marginTop: 8 }}>Aponte a câmera do app do motoboy pra esse QR na aba Bipar.</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
        {qrDataUrl && <img src={qrDataUrl} alt={`QR do pedido ${order.number}`} width={260} height={260} />}
        <div className="login-demo-box" style={{ wordBreak: 'break-all' }}>{order.codigoQr}</div>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
          {order.customerName} · {order.address || `Mesa ${order.tableNumber}`}
        </p>
      </div>
    </div>
  )
}

export default function Pedidos({ orders, filters, setFilters, statusLabels, statusTone, onUpdateStatus }) {
  const [recusandoId, setRecusandoId] = useState(null)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [qrAberto, setQrAberto] = useState(null)
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

    if (order.status === 'novo' && order.channel === 'online') {
      actions.push({ label: 'Aceitar pedido', action: 'accept-online', primary: true })
      actions.push({ label: 'Recusar', action: 'reject-online' })
      return actions
    }

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
      case 'accept-online':
        await onUpdateStatus(orderId, 'em_preparo')
        break
      case 'reject-online':
        setMotivoRecusa('')
        setRecusandoId(orderId)
        break
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

  const confirmarRecusa = async (orderId) => {
    await onUpdateStatus(orderId, 'cancelado', motivoRecusa.trim() || 'Nao informado')
    setRecusandoId(null)
    setMotivoRecusa('')
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="order-number">#{order.number}</span>
                  {order.type === 'mesa' && order.tableNumber != null && (
                    <span className="badge badge-green">Mesa {order.tableNumber}</span>
                  )}
                  {order.type === 'delivery' && order.deliveryNumber != null && (
                    <span className="badge badge-blue">Delivery #{order.deliveryNumber}</span>
                  )}
                  {order.channel === 'online' && <span className="badge badge-sun">Online</span>}
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
                  {order.status === 'cancelado' && order.motivoCancelamento && (
                    <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 6 }}>
                      Recusado: {order.motivoCancelamento}
                    </p>
                  )}
                </div>
                <div className="order-total">
                  <span>Total</span>
                  <strong>{formatMoney(order.total)}</strong>
                  <span className="badge badge-muted">{order.type}</span>
                </div>
              </div>
              {recusandoId === order.id ? (
                <div className="confirm-box">
                  <input
                    type="text"
                    placeholder="Motivo da recusa (ex: fora da area de entrega)"
                    value={motivoRecusa}
                    onChange={(event) => setMotivoRecusa(event.target.value)}
                    autoFocus
                  />
                  <div className="order-actions">
                    <button className="btn btn-primary" type="button" onClick={() => confirmarRecusa(order.id)}>
                      Confirmar recusa
                    </button>
                    <button className="btn btn-light" type="button" onClick={() => setRecusandoId(null)}>
                      Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="order-actions">
                  {order.type === 'delivery' && order.codigoQr && (
                    <button className="btn btn-light" type="button" onClick={() => setQrAberto(order)}>
                      Ver QR
                    </button>
                  )}
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
              )}
            </article>
          )
        })}
      </section>

      {qrAberto && <PedidoQrModal order={qrAberto} onClose={() => setQrAberto(null)} />}
    </>
  )
}
