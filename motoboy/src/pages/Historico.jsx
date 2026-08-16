import React, { useEffect, useState } from 'react'

const PAYMENT_LABEL = { PIX: 'Pix', CARTAO: 'Cartao', DINHEIRO: 'Dinheiro' }

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Historico({ fetchHistorico }) {
  const [periodo, setPeriodo] = useState('dia')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchHistorico(periodo).then((result) => {
      if (!cancelled) {
        setData(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [periodo, fetchHistorico])

  return (
    <div>
      <div className="period-toggle" style={{ marginBottom: 16 }}>
        <button className={`tab ${periodo === 'dia' ? 'active' : ''}`} type="button" onClick={() => setPeriodo('dia')}>
          Hoje
        </button>
        <button className={`tab ${periodo === 'geral' ? 'active' : ''}`} type="button" onClick={() => setPeriodo('geral')}>
          Geral
        </button>
      </div>

      {loading && <div className="empty">Carregando...</div>}

      {!loading && data && (
        <>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginBottom: 16 }}>
            <div className="card metric">
              <div>
                <span>Entregas</span>
                <strong>{data.total_entregas}</strong>
              </div>
            </div>
            <div className="card metric">
              <div>
                <span>Taxas</span>
                <strong>R$ {Number(data.total_taxas || 0).toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {data.entregas.length === 0 ? (
            <div className="empty">Nenhuma entrega concluida nesse periodo.</div>
          ) : (
            <div className="stop-list">
              {data.entregas.map((entrega) => (
                <div key={entrega.id_entrega} className="card order-card">
                  <div className="order-header">
                    <span className="order-number">Pedido #{entrega.nr_pedido_delivery ?? entrega.id_pedido}</span>
                    <span className="order-time">{formatDateTime(entrega.concluida_em)}</span>
                  </div>
                  <p className="order-body">
                    <span>{PAYMENT_LABEL[entrega.forma_pagamento] || entrega.forma_pagamento || '-'}</span>
                    <span>Taxa: R$ {Number(entrega.taxa || 0).toFixed(2)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
