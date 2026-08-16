import React, { useEffect, useMemo, useState } from 'react'

const formaLabel = { PIX: 'Pix', CARTAO: 'Cartão', DINHEIRO: 'Dinheiro' }

const statusEntregaLabel = {
  AGUARDANDO: 'Aguardando coleta',
  COLETADO: 'Coletado',
  EM_ROTA: 'Em rota',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function EntregadorDetalheModal({ entregadorId, nome, onClose, onFetch }) {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [detalhe, setDetalhe] = useState(null)

  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    onFetch(entregadorId).then((result) => {
      if (cancelado) return
      if (result.ok) {
        setDetalhe(result.data)
      } else {
        setErro(result.message)
      }
      setCarregando(false)
    })
    return () => {
      cancelado = true
    }
  }, [entregadorId, onFetch])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{nome}</h2>
            <p>Rotas e entregas feitas por esse entregador.</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        {carregando && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
        {erro && <div className="notice notice-danger">{erro}</div>}

        {detalhe && (
          detalhe.entregas.length === 0 ? (
            <div className="menu-carrinho-vazio-pro">Nenhuma entrega registrada ainda.</div>
          ) : (
            <div className="data-table">
              <div className="data-row row-head" style={{ gridTemplateColumns: '1.4fr 0.8fr 0.6fr 0.8fr' }}>
                <span>Endereço</span>
                <span>Valor</span>
                <span>Pagamento</span>
                <span>Status</span>
              </div>
              {detalhe.entregas.map((entrega) => (
                <div className="data-row" key={entrega.id_entrega} style={{ gridTemplateColumns: '1.4fr 0.8fr 0.6fr 0.8fr' }}>
                  <div>
                    <strong style={{ display: 'block' }}>{entrega.endereco || 'Endereço não informado'}</strong>
                    <small style={{ color: 'var(--muted)' }}>{entrega.cliente_nome}</small>
                  </div>
                  <span>{formatMoney(entrega.valor)}</span>
                  <span>{formaLabel[entrega.forma_pagamento] || entrega.forma_pagamento || '-'}</span>
                  <span className="badge badge-muted">{statusEntregaLabel[entrega.status_entrega] || entrega.status_entrega}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default function Entrega({ orders, deliveryData, onFetchEntregadorEntregas }) {
  const [entregadorAberto, setEntregadorAberto] = useState(null)

  const deliveryOrders = useMemo(
    () => orders.filter((order) => order.type === 'delivery'),
    [orders],
  )

  return (
    <>
      <section className="cards">
        <div className="card metric fade-in" style={{ '--i': 0 }}><div><span>Pedidos delivery</span><strong>{deliveryOrders.length}</strong></div><div className="metric-icon badge-blue">DL</div></div>
        <div className="card metric fade-in" style={{ '--i': 1 }}><div><span>Em rota</span><strong>{orders.filter((order) => order.status === 'saiu_entrega').length}</strong></div><div className="metric-icon badge-lime">RT</div></div>
        <div className="card metric fade-in" style={{ '--i': 2 }}><div><span>Motoboys ativos</span><strong>{deliveryData.couriers.length}</strong></div><div className="metric-icon badge-green">MB</div></div>
        <div className="card metric fade-in" style={{ '--i': 3 }}><div><span>Rotas agrupadas</span><strong>{deliveryData.routes.length}</strong></div><div className="metric-icon badge-sun">RG</div></div>
      </section>

      <section className="page-grid page-grid-2-1">
        <div className="page-stack">
          <article className="card section-card fade-in" style={{ '--i': 4 }}>
            <div className="section-head">
              <div>
                <h2>Equipe de entrega</h2>
                <p>Status atual dos entregadores — toque num nome pra ver as rotas dele.</p>
              </div>
            </div>
            <div className="mini-grid">
              {deliveryData.couriers.map((courier) => (
                <button
                  type="button"
                  className="info-tile"
                  key={courier.id}
                  onClick={() => onFetchEntregadorEntregas && setEntregadorAberto(courier)}
                  style={{ textAlign: 'left', cursor: onFetchEntregadorEntregas ? 'pointer' : 'default', font: 'inherit', width: '100%' }}
                >
                  <span>{courier.zone}</span>
                  <strong>{courier.name}</strong>
                  <p>{courier.status}</p>
                  <span>{courier.deliveries} entregas • nota {courier.rating}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="card section-card fade-in" style={{ '--i': 5 }}>
            <div className="section-head">
              <div>
                <h2>Rotas sugeridas</h2>
                <p>Organizacao de pedidos por proximidade e prioridade.</p>
              </div>
            </div>
            <div className="data-table">
              {deliveryData.routes.map((route) => (
                <div className="data-row" key={route.id} style={{ gridTemplateColumns: '1fr 0.5fr 0.6fr 0.6fr' }}>
                  <strong>{route.region}</strong>
                  <span>{route.orders} pedidos</span>
                  <span>{route.distance}</span>
                  <span>{route.eta}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="page-stack">
          <article className="card section-card fade-in" style={{ '--i': 6 }}>
            <div className="section-head">
              <div>
                <h2>Ocorrencias</h2>
                <p>Monitoramento e seguranca da operacao externa.</p>
              </div>
            </div>
            <div className="notice-list">
              {deliveryData.incidents.map((incident) => (
                <div className={`notice notice-${incident.level}`} key={incident.id}>
                  <strong>{incident.title}</strong>
                  <p>{incident.detail}</p>
                </div>
              ))}
            </div>
            <button className="btn btn-primary emergency-btn" type="button">Acionar protocolo de apoio</button>
          </article>
        </div>
      </section>

      {entregadorAberto && (
        <EntregadorDetalheModal
          entregadorId={entregadorAberto.id}
          nome={entregadorAberto.name}
          onClose={() => setEntregadorAberto(null)}
          onFetch={onFetchEntregadorEntregas}
        />
      )}
    </>
  )
}
