import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

const statusMap = {
  occupied: { label: 'Ocupada', tone: 'badge-orange' },
  reserved: { label: 'Reservada', tone: 'badge-blue' },
  free: { label: 'Livre', tone: 'badge-green' },
  cleaning: { label: 'Limpeza', tone: 'badge-muted' },
}

const formaLabel = { PIX: 'Pix', CARTAO: 'Cartão', DINHEIRO: 'Dinheiro' }

function ComandasPendentes({ comandas, onConfirmar }) {
  const [confirmando, setConfirmando] = useState(null)

  if (comandas.length === 0) return null

  const handleConfirmar = async (id) => {
    setConfirmando(id)
    await onConfirmar(id)
    setConfirmando(null)
  }

  return (
    <article className="card section-card fade-in" style={{ borderColor: 'rgba(242, 181, 59, 0.4)', '--i': 4 }}>
      <div className="section-head">
        <div>
          <h2>Comandas aguardando pagamento</h2>
          <p>Pix "já paguei" ou cartão/dinheiro conferido na mesa — um toque libera.</p>
        </div>
        <span className="badge badge-sun">{comandas.length}</span>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {comandas.map((comanda) => (
          <div key={comanda.id_comanda} className="card order-card">
            <div className="order-header">
              <div>
                <span className="order-number">Mesa {comanda.mesa}</span>
                <span className="badge badge-sun">{formaLabel[comanda.forma_pagamento] || comanda.forma_pagamento}</span>
              </div>
              <strong>R$ {comanda.total.toFixed(2)}</strong>
            </div>
            <ul style={{ margin: '4px 0 10px', paddingLeft: 16, color: 'var(--muted)', fontSize: 12.5 }}>
              {comanda.pedidos.map((pedido) => (
                <li key={pedido.id_pedido}>
                  {pedido.cliente_nome}: {pedido.itens.join(', ')}
                </li>
              ))}
            </ul>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => handleConfirmar(comanda.id_comanda)}
              disabled={confirmando === comanda.id_comanda}
            >
              {confirmando === comanda.id_comanda ? 'Confirmando...' : 'Confirmar pagamento e liberar mesa'}
            </button>
          </div>
        ))}
      </div>
    </article>
  )
}

function ConfiguracaoPix({ empresa, onSalvar }) {
  const [chavePix, setChavePix] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    setChavePix(empresa?.chave_pix || '')
  }, [empresa?.chave_pix])

  const handleSalvar = async () => {
    setSalvando(true)
    setStatus('')
    const result = await onSalvar({ chave_pix: chavePix.trim() || null })
    setStatus(result.ok ? 'Chave Pix salva.' : result.message)
    setSalvando(false)
  }

  return (
    <article className="card section-card fade-in" style={{ '--i': 5 }}>
      <div className="section-head">
        <div>
          <h2>Chave Pix da empresa</h2>
          <p>Mostrada pro cliente quando ele fecha a mesa escolhendo Pix.</p>
        </div>
      </div>
      <div className="filter-group" style={{ maxWidth: 420 }}>
        <label>Chave Pix</label>
        <input
          type="text"
          placeholder="email, telefone, CPF/CNPJ ou chave aleatoria"
          value={chavePix}
          onChange={(event) => setChavePix(event.target.value)}
        />
      </div>
      <div className="filter-actions" style={{ justifyContent: 'flex-start', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary" type="button" onClick={handleSalvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
        {status && <small style={{ color: 'var(--muted)' }}>{status}</small>}
      </div>
    </article>
  )
}

function MesaQrCard({ mesa }) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const url = `${window.location.origin}/mesa/${mesa.qrToken}`

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { width: 220, margin: 1 }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="card mesa-qr-card">
      <strong>Mesa {mesa.number}</strong>
      {qrDataUrl && <img src={qrDataUrl} alt={`QR da mesa ${mesa.number}`} width={180} height={180} />}
      <small>{url}</small>
    </div>
  )
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ComandaBlock({ comanda }) {
  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <div className="order-header">
        <span className={`badge ${comanda.status === 'PAGA' ? 'badge-green' : comanda.status === 'CANCELADA' ? 'badge-red' : 'badge-sun'}`}>
          {comanda.status.replaceAll('_', ' ')}
        </span>
        <strong>{formatMoney(comanda.total)}</strong>
      </div>
      {comanda.pedidos.map((pedido) => (
        <div key={pedido.id_pedido} className="data-row" style={{ gridTemplateColumns: '1fr 2fr 0.6fr' }}>
          <span>{pedido.cliente_nome}</span>
          <span>{pedido.itens.map((item) => `${item.qty}x ${item.nome}`).join(', ')}</span>
          <span>{formatMoney(pedido.total)}</span>
        </div>
      ))}
    </div>
  )
}

function MesaDetalheModal({ mesaId, numero, onClose, onFetch }) {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [detalhe, setDetalhe] = useState(null)

  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    onFetch(mesaId).then((result) => {
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
  }, [mesaId, onFetch])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Mesa {numero}</h2>
            <p>Comanda atual e histórico recente dessa mesa.</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        {carregando && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
        {erro && <div className="notice notice-danger">{erro}</div>}

        {detalhe && (
          <div style={{ display: 'grid', gap: 20 }}>
            <div>
              <h3 style={{ margin: '0 0 10px' }}>Comanda atual</h3>
              {detalhe.comanda_atual ? (
                <ComandaBlock comanda={detalhe.comanda_atual} />
              ) : (
                <div className="menu-carrinho-vazio-pro">Nenhuma comanda aberta agora.</div>
              )}
            </div>

            {detalhe.historico.length > 0 && (
              <div>
                <h3 style={{ margin: '0 0 10px' }}>Histórico recente</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {detalhe.historico.map((comanda) => (
                    <ComandaBlock key={comanda.id_comanda} comanda={comanda} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function QrCodesMesas({ areas }) {
  const todasMesas = areas.flatMap((area) => area.tables).filter((mesa) => mesa.qrToken)

  if (todasMesas.length === 0) return null

  // O QR guarda o endereco que o navegador esta usando AGORA (window.location.origin).
  // Se for "localhost", o QR so funciona pra quem escanear no proprio PC — o celular
  // de outra pessoa nao consegue chegar em "localhost dele mesmo". Avisa antes de imprimir.
  const usandoLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname)

  return (
    <article className="card section-card" id="qrcodes-mesas">
      <div className="section-head">
        <div>
          <h2>QR Codes das mesas</h2>
          <p>Imprima e cole em cada mesa — o cliente bipa e pede direto por lá.</p>
        </div>
        <button className="btn btn-light" type="button" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>
      {usandoLocalhost && (
        <div className="notice notice-warning no-print">
          <strong>Esses QR Codes só vão abrir neste computador.</strong>
          <p>
            Você está acessando o painel por <code>localhost</code> — o QR guarda esse endereço, e o celular de
            outra pessoa não consegue chegar nele. Acesse o painel pelo IP da rede (ex:{' '}
            <code>http://{'{SEU-IP}'}:5173/mesas</code>, confira o IP com <code>ipconfig</code>) antes de gerar e
            imprimir os QR Codes de verdade.
          </p>
        </div>
      )}
      <div className="mesa-qr-grid">
        {todasMesas.map((mesa) => (
          <MesaQrCard key={mesa.number} mesa={mesa} />
        ))}
      </div>
    </article>
  )
}

export default function Mesas({
  tablesData,
  comandasPendentes = [],
  onConfirmarPagamento,
  empresa,
  onUpdateEmpresa,
  onFetchMesaDetalhe,
}) {
  const [mesaAberta, setMesaAberta] = useState(null)

  return (
    <>
      <section className="cards no-print">
        <div className="card metric fade-in" style={{ '--i': 0 }}><div><span>Total de mesas</span><strong>{tablesData.summary.total}</strong></div><div className="metric-icon badge-blue">TT</div></div>
        <div className="card metric fade-in" style={{ '--i': 1 }}><div><span>Ocupadas</span><strong>{tablesData.summary.occupied}</strong></div><div className="metric-icon badge-orange">OC</div></div>
        <div className="card metric fade-in" style={{ '--i': 2 }}><div><span>Reservadas</span><strong>{tablesData.summary.reserved}</strong></div><div className="metric-icon badge-lime">RS</div></div>
        <div className="card metric fade-in" style={{ '--i': 3 }}><div><span>Fila de espera</span><strong>{tablesData.summary.waiting}</strong></div><div className="metric-icon badge-sun">FL</div></div>
      </section>

      <div className="no-print" style={{ display: 'grid', gap: 20 }}>
        {onConfirmarPagamento && <ComandasPendentes comandas={comandasPendentes} onConfirmar={onConfirmarPagamento} />}
        {onUpdateEmpresa && <ConfiguracaoPix empresa={empresa} onSalvar={onUpdateEmpresa} />}
      </div>

      <QrCodesMesas areas={tablesData.areas} />

      <section className="page-grid page-grid-2-1 no-print">
        <div className="page-stack">
          {tablesData.areas.map((area, index) => (
            <article className="card section-card fade-in" style={{ '--i': index }} key={area.id}>
              <div className="section-head">
                <div>
                  <h2>{area.name}</h2>
                  <p>Controle de ocupacao e status em tempo real.</p>
                </div>
              </div>
              <div className="table-grid">
                {area.tables.map((table) => (
                  <button
                    type="button"
                    className={`table-card table-${table.status}`}
                    key={table.number}
                    onClick={() => onFetchMesaDetalhe && setMesaAberta(table)}
                    style={{ textAlign: 'left', cursor: onFetchMesaDetalhe ? 'pointer' : 'default', font: 'inherit' }}
                  >
                    <div className="table-card-head">
                      <strong>Mesa {table.number}</strong>
                      <span className={`badge ${statusMap[table.status].tone}`}>{statusMap[table.status].label}</span>
                    </div>
                    <p>{table.seats} lugares</p>
                    <p>Garcom: {table.waiter}</p>
                    <strong>{table.ticket ? `R$ ${table.ticket.toFixed(2)}` : 'Sem consumo'}</strong>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>

        <article className="card section-card fade-in" style={{ '--i': tablesData.areas.length }}>
          <div className="section-head">
            <div>
              <h2>Fila de espera</h2>
              <p>Clientes aguardando liberacao de mesa.</p>
            </div>
          </div>
          <div className="data-table">
            {tablesData.waitingList.map((entry) => (
              <div className="data-row" key={entry.id} style={{ gridTemplateColumns: '1fr 0.5fr 0.5fr' }}>
                <strong>{entry.name}</strong>
                <span>{entry.size} pessoas</span>
                <span>{entry.eta}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {mesaAberta && (
        <MesaDetalheModal
          mesaId={mesaAberta.id}
          numero={mesaAberta.number}
          onClose={() => setMesaAberta(null)}
          onFetch={onFetchMesaDetalhe}
        />
      )}
    </>
  )
}
