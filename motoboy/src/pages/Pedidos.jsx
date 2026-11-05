import React, { useEffect, useMemo, useState } from 'react'
import PedidoDetalhe from './PedidoDetalhe.jsx'
import { IconClock } from '../components/icons.jsx'
import { PAYMENT_LABEL, formatHora, formatMoney, normalizeStops, splitEndereco } from '../lib/stops.js'

/** Card da lista - serve pros pendentes (rota) e pros entregues (historico do dia). */
function PedidoCard({ numero, cliente, hora, endereco, forma, valor, pago, canal, estado, onClick }) {
  const { destaque, resto } = splitEndereco(endereco)
  const conteudo = (
    <>
      <div className="ped-top">
        <div className="ped-id">
          <span className="ped-num">#{numero}</span>
          {cliente && <span className="ped-client">{cliente}</span>}
        </div>
        {hora && (
          <span className="ped-time">
            <IconClock />
            {hora}
          </span>
        )}
      </div>

      <p className="ped-address">
        <strong>{destaque}</strong>
        {resto && <span>, {resto}</span>}
      </p>

      <div className="ped-foot">
        <div className="ped-pay">
          <span>{PAYMENT_LABEL[forma] || forma || 'Pagamento'}</span>
          {valor != null && <strong>{formatMoney(valor)}</strong>}
        </div>
        <div className="ped-tags">
          {canal && <span className="ped-chip ped-chip-canal">{canal}</span>}
          <span className={`ped-chip ${pago ? 'ped-chip-pago' : 'ped-chip-cobrar'}`}>
            {pago ? 'Pedido pago' : 'Cobrar na entrega'}
          </span>
        </div>
      </div>
    </>
  )

  if (!onClick) {
    return <div className={`ped-card ped-${estado}`}>{conteudo}</div>
  }

  return (
    <button type="button" className={`ped-card ped-${estado}`} onClick={onClick}>
      {conteudo}
    </button>
  )
}

function estadoDaParada(status) {
  if (status === 'EM_ROTA') return 'rota'
  if (status === 'ENTREGUE') return 'entregue'
  return 'espera'
}

export default function Pedidos({
  rota,
  loading,
  actingEntregaId,
  fetchHistorico,
  onIniciar,
  onConcluir,
  onReordenar,
  onDetalheChange,
}) {
  const stops = useMemo(() => normalizeStops(rota), [rota])
  const [aba, setAba] = useState('pendentes')
  const [selecionadoId, setSelecionadoId] = useState(null)
  const [entregues, setEntregues] = useState({ loading: true, lista: [] })

  // Entregues do dia: busca de novo sempre que a rota muda (concluir uma entrega muda a rota).
  useEffect(() => {
    let cancelado = false
    fetchHistorico('dia').then((resultado) => {
      if (!cancelado) setEntregues({ loading: false, lista: resultado?.entregas || [] })
    })
    return () => {
      cancelado = true
    }
  }, [fetchHistorico, rota])

  const selecionada = stops.find((stop) => stop.idEntrega === selecionadoId) || null

  // Concluir a entrega tira a parada da rota - sem ela selecionada, volta pra lista sozinho.
  useEffect(() => {
    if (selecionadoId != null && !selecionada && !loading) setSelecionadoId(null)
  }, [selecionadoId, selecionada, loading])

  useEffect(() => {
    onDetalheChange?.(Boolean(selecionada))
  }, [selecionada, onDetalheChange])

  const mover = (idEntrega, direcao) => {
    const indice = stops.findIndex((stop) => stop.idEntrega === idEntrega)
    const alvo = indice + direcao
    if (indice < 0 || alvo < 0 || alvo >= stops.length) return

    const novaOrdem = stops.map((stop) => stop.idEntrega)
    ;[novaOrdem[indice], novaOrdem[alvo]] = [novaOrdem[alvo], novaOrdem[indice]]
    onReordenar(rota.id_rota_entrega, novaOrdem)
  }

  if (selecionada) {
    const indice = stops.findIndex((stop) => stop.idEntrega === selecionada.idEntrega)
    return (
      <PedidoDetalhe
        stop={selecionada}
        posicao={indice + 1}
        total={stops.length}
        busy={actingEntregaId === selecionada.idEntrega}
        onBack={() => setSelecionadoId(null)}
        onIniciar={onIniciar}
        onConcluir={onConcluir}
        onMove={mover}
      />
    )
  }

  return (
    <div className="ped-page">
      <div className="ped-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'pendentes'}
          className={aba === 'pendentes' ? 'active' : ''}
          onClick={() => setAba('pendentes')}
        >
          Pendentes ({stops.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'entregues'}
          className={aba === 'entregues' ? 'active' : ''}
          onClick={() => setAba('entregues')}
        >
          Entregues ({entregues.lista.length})
        </button>
      </div>

      {aba === 'pendentes' && (
        <>
          {loading && stops.length === 0 && <div className="empty">Carregando pedidos...</div>}

          {!loading && stops.length === 0 && (
            <div className="empty">
              <p>Nenhum pedido pendente.</p>
              <p style={{ fontSize: 13 }}>Bipe a comanda de um pedido delivery pra começar.</p>
            </div>
          )}

          <div className="ped-list">
            {stops.map((stop) => (
              <PedidoCard
                key={stop.idItem}
                numero={stop.numero}
                cliente={stop.clienteNome}
                hora={formatHora(stop.pedidoEm)}
                endereco={stop.endereco}
                forma={stop.forma}
                valor={stop.vlFinal}
                pago={stop.pago}
                canal={stop.canal}
                estado={estadoDaParada(stop.statusEntrega)}
                onClick={() => setSelecionadoId(stop.idEntrega)}
              />
            ))}
          </div>
        </>
      )}

      {aba === 'entregues' && (
        <>
          {entregues.loading && <div className="empty">Carregando...</div>}

          {!entregues.loading && entregues.lista.length === 0 && (
            <div className="empty">
              <p>Nenhuma entrega concluída hoje.</p>
            </div>
          )}

          <div className="ped-list">
            {entregues.lista.map((entrega) => (
              <PedidoCard
                key={entrega.id_entrega}
                numero={entrega.nr_pedido_delivery ?? entrega.id_pedido}
                cliente={entrega.cliente_nome}
                hora={formatHora(entrega.concluida_em)}
                endereco={entrega.endereco || 'Endereço não informado'}
                forma={entrega.forma_pagamento}
                valor={entrega.valor_total != null ? Number(entrega.valor_total) : null}
                pago={entrega.pago}
                estado="entregue"
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
