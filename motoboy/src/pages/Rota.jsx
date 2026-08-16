import React, { useMemo, useState } from 'react'

const STATUS_LABEL = {
  AGUARDANDO: 'Aguardando coleta',
  COLETADO: 'Coletado',
  EM_ROTA: 'Em rota',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
}

const STATUS_BADGE = {
  AGUARDANDO: 'badge-sun',
  COLETADO: 'badge-blue',
  EM_ROTA: 'badge-lime',
  ENTREGUE: 'badge-muted',
  CANCELADA: 'badge-red',
}

const PAYMENT_LABEL = { PIX: 'Pix', CARTAO: 'Cartao', DINHEIRO: 'Dinheiro' }

function normalizeStops(rota) {
  if (!rota?.itens) return []

  return [...rota.itens]
    .sort((a, b) => a.ordem_sequencia - b.ordem_sequencia)
    .map((item) => {
      const entrega = item.entrega || {}
      const pedido = entrega.pedido || {}
      const pagamento = pedido.pagamento || {}
      const vlFinal = pagamento.vl_final != null ? Number(pagamento.vl_final) : null
      const trocoPara = pagamento.troco_para != null ? Number(pagamento.troco_para) : null
      const trocoCalculado =
        pagamento.forma === 'DINHEIRO' && trocoPara != null && vlFinal != null
          ? Math.round((trocoPara - vlFinal) * 100) / 100
          : null

      return {
        idItem: item.id_rota_entrega_item,
        ordem: item.ordem_sequencia,
        idEntrega: entrega.id_entrega,
        idPedido: pedido.id_pedido,
        nrPedidoDelivery: pedido.nr_pedido_delivery,
        statusEntrega: entrega.status_entrega,
        dtEntregue: item.dt_entregue,
        endereco: pedido.ds_observacao || 'Endereco nao informado',
        lat: entrega.latitude_destino,
        lng: entrega.longitude_destino,
        clienteNome: pedido.cliente?.usuario?.nm_usuario,
        itensResumo: Array.isArray(pedido.itens)
          ? pedido.itens.map((i) => `${i.nr_quantidade}x ${i.produto?.nm_produto ?? 'Item'}`)
          : [],
        forma: pagamento.forma,
        vlFinal,
        trocoCalculado,
        precisaCodigo: Boolean(entrega.codigo_confirmacao_entrega),
      }
    })
}

function mapsUrl(stop) {
  if (stop.lat && stop.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.endereco)}`
}

function StopCard({ stop, isFirst, isLast, busy, onIniciar, onConcluir, onMove }) {
  const [codigo, setCodigo] = useState('')

  return (
    <div className="card order-card stop-card">
      <div className="order-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="stop-order-badge">{stop.ordem}</span>
          <div>
            <span className="order-number">Pedido #{stop.nrPedidoDelivery ?? stop.idPedido}</span>
            {stop.clienteNome && <div className="order-time">{stop.clienteNome}</div>}
          </div>
        </div>
        <span className={`badge ${STATUS_BADGE[stop.statusEntrega] || 'badge-muted'}`}>
          {STATUS_LABEL[stop.statusEntrega] || stop.statusEntrega}
        </span>
      </div>

      <p className="stop-address">{stop.endereco}</p>

      {stop.itensResumo.length > 0 && (
        <ul className="stop-items">
          {stop.itensResumo.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}

      {stop.forma === 'DINHEIRO' && stop.trocoCalculado != null && (
        <div className="troco-box">
          <span>Troco pra levar</span>
          <strong>R$ {stop.trocoCalculado.toFixed(2)}</strong>
        </div>
      )}

      {stop.forma && stop.forma !== 'DINHEIRO' && (
        <p className="order-body">
          <span>Pagamento: {PAYMENT_LABEL[stop.forma] || stop.forma}</span>
        </p>
      )}

      <div className="stop-actions">
        <a className="btn btn-light" href={mapsUrl(stop)} target="_blank" rel="noreferrer">
          Abrir no mapa
        </a>

        {(stop.statusEntrega === 'AGUARDANDO' || stop.statusEntrega === 'COLETADO') && (
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => onIniciar(stop.idEntrega)}>
            {busy ? 'Aguarde...' : 'Iniciar entrega'}
          </button>
        )}

        {stop.statusEntrega === 'EM_ROTA' && (
          <div className="confirm-box">
            {stop.precisaCodigo && (
              <input
                type="text"
                placeholder="Codigo de confirmacao"
                value={codigo}
                onChange={(event) => setCodigo(event.target.value)}
              />
            )}
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || (stop.precisaCodigo && !codigo.trim())}
              onClick={() => onConcluir(stop.idEntrega, codigo.trim())}
            >
              {busy ? 'Aguarde...' : 'Concluir entrega'}
            </button>
          </div>
        )}

        {(!isFirst || !isLast) && stop.statusEntrega !== 'ENTREGUE' && stop.statusEntrega !== 'CANCELADA' && (
          <div className="stop-reorder">
            <button className="btn btn-light" type="button" disabled={isFirst || busy} onClick={() => onMove(stop.idEntrega, -1)}>
              ▲ Mover pra cima
            </button>
            <button className="btn btn-light" type="button" disabled={isLast || busy} onClick={() => onMove(stop.idEntrega, 1)}>
              ▼ Mover pra baixo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Rota({ rota, loading, actingEntregaId, onIniciar, onConcluir, onReordenar }) {
  const stops = useMemo(() => normalizeStops(rota), [rota])

  const handleMove = (idEntrega, direction) => {
    const index = stops.findIndex((stop) => stop.idEntrega === idEntrega)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= stops.length) return

    const newOrder = stops.map((stop) => stop.idEntrega)
    ;[newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]]
    onReordenar(rota.id_rota_entrega, newOrder)
  }

  if (loading) {
    return <div className="empty">Carregando rota...</div>
  }

  if (!rota || stops.length === 0) {
    return (
      <div className="empty">
        <p>Nenhuma rota ativa no momento.</p>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Bipe a comanda de um pedido delivery pra comecar.</p>
      </div>
    )
  }

  return (
    <div className="stop-list">
      {stops.map((stop, index) => (
        <StopCard
          key={stop.idItem}
          stop={stop}
          isFirst={index === 0}
          isLast={index === stops.length - 1}
          busy={actingEntregaId === stop.idEntrega}
          onIniciar={onIniciar}
          onConcluir={onConcluir}
          onMove={handleMove}
        />
      ))}
    </div>
  )
}
