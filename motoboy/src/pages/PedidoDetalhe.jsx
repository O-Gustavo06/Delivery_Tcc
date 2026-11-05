import React, { useState } from 'react'
import {
  IconBack,
  IconBag,
  IconCheck,
  IconChat,
  IconChevron,
  IconClock,
  IconDinheiro,
  IconPhone,
  IconRota,
} from '../components/icons.jsx'
import {
  PAYMENT_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  formatDataHora,
  formatMoney,
  mapsUrl,
  telUrl,
  whatsappUrl,
} from '../lib/stops.js'

export default function PedidoDetalhe({ stop, posicao, total, busy, onBack, onIniciar, onConcluir, onMove }) {
  const [verProdutos, setVerProdutos] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [codigo, setCodigo] = useState('')

  const formaLabel = PAYMENT_LABEL[stop.forma] || stop.forma || 'Pagamento'
  const valor = formatMoney(stop.vlFinal)
  const zap = whatsappUrl(stop.telefone)
  const ligar = telUrl(stop.telefone)
  const naoIniciada = stop.statusEntrega === 'AGUARDANDO' || stop.statusEntrega === 'COLETADO'
  const emRota = stop.statusEntrega === 'EM_ROTA'

  return (
    <div className="det-page">
      <div className="det-head">
        <button type="button" className="det-back" onClick={onBack} aria-label="Voltar para a lista">
          <IconBack />
        </button>
        <h2>Pedido #{stop.numero}</h2>
        <span className={`badge ${STATUS_BADGE[stop.statusEntrega] || 'badge-muted'}`}>
          {STATUS_LABEL[stop.statusEntrega] || stop.statusEntrega}
        </span>
      </div>

      <section className="det-card">
        <h3>Dados do cliente</h3>
        <p className="det-name">{stop.clienteNome || 'Cliente'}</p>
        {(zap || ligar) && (
          <div className="det-contact">
            {zap && (
              <a href={zap} target="_blank" rel="noreferrer" className="det-link det-link-zap">
                <IconChat />
                Chamar no WhatsApp
              </a>
            )}
            {ligar && (
              <a href={ligar} className="det-link">
                <IconPhone />
                Telefone
              </a>
            )}
          </div>
        )}
      </section>

      <section className="det-card">
        <div className="det-card-head">
          <h3>Dados da entrega</h3>
          <a href={mapsUrl(stop)} target="_blank" rel="noreferrer" className="det-link det-link-rota">
            <IconRota />
            Ver rota
          </a>
        </div>

        {stop.pedidoEm && (
          <p className="det-line">
            <IconClock />
            <span>Pedido em {formatDataHora(stop.pedidoEm)}</span>
          </p>
        )}
        <p className="det-line">
          <IconRota />
          <span>{stop.endereco}</span>
        </p>

        {total > 1 && (
          <div className="det-order">
            <span>
              Parada {posicao} de {total}
            </span>
            <div>
              <button type="button" disabled={posicao === 1 || busy} onClick={() => onMove(stop.idEntrega, -1)}>
                ▲ Subir
              </button>
              <button type="button" disabled={posicao === total || busy} onClick={() => onMove(stop.idEntrega, 1)}>
                ▼ Descer
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="det-card det-products">
        <button type="button" className="det-products-toggle" onClick={() => setVerProdutos((aberto) => !aberto)}>
          <span>
            <IconBag />
            Ver produtos ({stop.itens.length})
          </span>
          <IconChevron className={verProdutos ? 'open' : ''} />
        </button>

        {verProdutos && (
          <ul className="det-items">
            {stop.itens.map((item, index) => (
              <li key={index}>
                <strong>{item.qtd}x</strong>
                <div>
                  <span>{item.nome}</span>
                  {item.nota && <em className="det-note">{item.nota}</em>}
                </div>
              </li>
            ))}
            {stop.notaPedido && <li className="det-order-note">Obs: {stop.notaPedido}</li>}
          </ul>
        )}
      </section>

      <div className="det-bar">
        <div className="det-bar-pay">
          <span className="det-bar-method">
            <IconDinheiro />
            {formaLabel}
          </span>
          {valor && <strong>{valor}</strong>}
        </div>

        <div className="det-bar-status">
          <span className={`ped-chip ${stop.pago ? 'ped-chip-pago' : 'ped-chip-cobrar'}`}>
            {stop.pago ? 'Pedido pago' : 'Cobrar na entrega'}
          </span>
          {stop.forma === 'DINHEIRO' && stop.trocoCalculado != null && stop.trocoCalculado > 0 && (
            <span className="det-troco">Troco: {formatMoney(stop.trocoCalculado)}</span>
          )}
        </div>

        {!confirmando && naoIniciada && (
          <button className="btn btn-primary det-action" type="button" disabled={busy} onClick={() => onIniciar(stop.idEntrega)}>
            {busy ? 'Aguarde...' : 'Iniciar entrega'}
          </button>
        )}

        {!confirmando && emRota && (
          <button className="btn btn-primary det-action" type="button" disabled={busy} onClick={() => setConfirmando(true)}>
            <IconCheck />
            Entregue
          </button>
        )}

        {confirmando && (
          <div className="det-confirm">
            <p>
              {stop.pago
                ? 'Confirma que o pedido foi entregue ao cliente?'
                : valor
                  ? `O valor de ${valor} (${formaLabel}) foi pago?`
                  : 'Confirma que o pagamento desse pedido foi recebido?'}
            </p>
            {stop.precisaCodigo && (
              <input
                type="text"
                placeholder="Código de confirmação"
                value={codigo}
                onChange={(event) => setCodigo(event.target.value)}
                autoFocus
              />
            )}
            <div className="det-confirm-actions">
              <button className="btn btn-light" type="button" disabled={busy} onClick={() => setConfirmando(false)}>
                Voltar
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy || (stop.precisaCodigo && !codigo.trim())}
                onClick={() => onConcluir(stop.idEntrega, codigo.trim())}
              >
                {busy ? 'Aguarde...' : stop.pago ? 'Sim, entregue' : 'Sim, foi pago'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
