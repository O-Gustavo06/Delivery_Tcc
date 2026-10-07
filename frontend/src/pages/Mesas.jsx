import React, { useEffect, useMemo, useState } from 'react'
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
    <article className="card section-card fade-in" style={{ borderColor: 'rgba(180, 83, 9, 0.4)', '--i': 4 }}>
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

const emptyFaixa = () => ({ ate_km: '', valor: '' })

function ConfiguracaoPix({ empresa, onSalvar }) {
  const [chavePix, setChavePix] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [status, setStatus] = useState('')
  const [alternandoAberto, setAlternandoAberto] = useState(false)

  const [taxaPadrao, setTaxaPadrao] = useState('8')
  const [faixas, setFaixas] = useState([])
  const [salvandoTaxas, setSalvandoTaxas] = useState(false)
  const [statusTaxas, setStatusTaxas] = useState('')

  useEffect(() => {
    setChavePix(empresa?.chave_pix || '')
  }, [empresa?.chave_pix])

  useEffect(() => {
    setTaxaPadrao(String(empresa?.config_taxas_km?.taxa_padrao ?? '8'))
    setFaixas(
      (empresa?.config_taxas_km?.faixas || []).map((faixa) => ({
        ate_km: String(faixa.ate_km),
        valor: String(faixa.valor),
      })),
    )
  }, [empresa?.config_taxas_km])

  const handleSalvar = async () => {
    setSalvando(true)
    setStatus('')
    const result = await onSalvar({ chave_pix: chavePix.trim() || null })
    setStatus(result.ok ? 'Chave Pix salva.' : result.message)
    setSalvando(false)
  }

  const updateFaixa = (index, field, value) => {
    setFaixas((prev) => prev.map((faixa, i) => (i === index ? { ...faixa, [field]: value } : faixa)))
  }

  const addFaixa = () => setFaixas((prev) => [...prev, emptyFaixa()])
  const removeFaixa = (index) => setFaixas((prev) => prev.filter((_, i) => i !== index))

  const handleSalvarTaxas = async () => {
    setStatusTaxas('')

    const faixasValidas = faixas.filter((faixa) => faixa.ate_km !== '' && faixa.valor !== '')
    if (faixasValidas.length !== faixas.length) {
      setStatusTaxas('Preencha "até km" e "valor" em todas as faixas, ou remova as incompletas.')
      return
    }

    setSalvandoTaxas(true)
    const result = await onSalvar({
      config_taxas_km: {
        taxa_padrao: Number(taxaPadrao) || 0,
        faixas: faixasValidas
          .map((faixa) => ({ ate_km: Number(faixa.ate_km), valor: Number(faixa.valor) }))
          .sort((a, b) => a.ate_km - b.ate_km),
      },
    })
    setStatusTaxas(result.ok ? 'Taxas de entrega salvas.' : result.message)
    setSalvandoTaxas(false)
  }

  const handleAlternarAberto = async () => {
    setAlternandoAberto(true)
    await onSalvar({ fl_aberto: !empresa?.aberto })
    setAlternandoAberto(false)
  }

  const aberto = empresa?.aberto !== false

  return (
    <article className="card section-card fade-in" style={{ '--i': 5 }}>
      <div className="section-head">
        <div>
          <h2>Cardápio online</h2>
          <p>Controla se a loja está recebendo pedidos pelo cardápio público agora.</p>
        </div>
        <button
          type="button"
          className={`badge ${aberto ? 'badge-green' : 'badge-red'}`}
          style={{ cursor: 'pointer', border: 'none' }}
          onClick={handleAlternarAberto}
          disabled={alternandoAberto}
        >
          {alternandoAberto ? 'Salvando...' : aberto ? 'Aberto — clique pra fechar' : 'Fechado — clique pra abrir'}
        </button>
      </div>

      <div className="section-head" style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginTop: 4 }}>
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

      <div className="section-head" style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginTop: 4 }}>
        <div>
          <h2>Taxa de entrega por distância</h2>
          <p>
            Defina faixas de km e o valor de cada uma. Exige <code>EMPRESA_LAT</code>/<code>EMPRESA_LNG</code>{' '}
            configurados no servidor — sem isso (ou sem faixa cadastrada), todo pedido usa a taxa padrão.
          </p>
        </div>
      </div>

      <div className="filter-group" style={{ maxWidth: 220 }}>
        <label>Taxa padrão (sem faixa / distância indisponível)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={taxaPadrao}
          onChange={(event) => setTaxaPadrao(event.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {faixas.map((faixa, index) => (
          <div className="item-row" key={index} style={{ gridTemplateColumns: '1fr 1fr auto' }}>
            <input
              type="number"
              min="0.1"
              step="0.1"
              placeholder="Até quantos km"
              value={faixa.ate_km}
              onChange={(event) => updateFaixa(index, 'ate_km', event.target.value)}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Valor (R$)"
              value={faixa.valor}
              onChange={(event) => updateFaixa(index, 'valor', event.target.value)}
            />
            <button className="item-remove" type="button" onClick={() => removeFaixa(index)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="btn btn-light" type="button" style={{ marginTop: 8, justifySelf: 'start' }} onClick={addFaixa}>
        + Adicionar faixa
      </button>

      <div className="filter-actions" style={{ justifyContent: 'flex-start', gap: 10, alignItems: 'center', marginTop: 8 }}>
        <button className="btn btn-primary" type="button" onClick={handleSalvarTaxas} disabled={salvandoTaxas}>
          {salvandoTaxas ? 'Salvando...' : 'Salvar taxas'}
        </button>
        {statusTaxas && <small style={{ color: 'var(--muted)' }}>{statusTaxas}</small>}
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

function MesaDetalheModal({ mesaId, numero, onClose, onFetch, onLiberar }) {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [detalhe, setDetalhe] = useState(null)
  const [liberando, setLiberando] = useState(false)

  const carregar = () => {
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
  }

  useEffect(carregar, [mesaId, onFetch])

  const handleLiberar = async () => {
    setLiberando(true)
    const result = await onLiberar(mesaId)
    setLiberando(false)
    if (result.ok) {
      carregar()
    } else {
      setErro(result.message)
    }
  }

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

        {detalhe && onLiberar && detalhe.mesa.status !== 'LIVRE' && (
          <button className="btn btn-light" type="button" onClick={handleLiberar} disabled={liberando}>
            {liberando ? 'Liberando...' : 'Liberar mesa'}
          </button>
        )}

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

function FilaEspera({ waitingList, onAdicionar, onRemover }) {
  const [nome, setNome] = useState('')
  const [pessoas, setPessoas] = useState('2')
  const [adicionando, setAdicionando] = useState(false)
  const [removendoId, setRemovendoId] = useState(null)
  const [erro, setErro] = useState('')

  const handleAdicionar = async (event) => {
    event.preventDefault()
    setErro('')

    if (!nome.trim() || !pessoas || Number(pessoas) < 1) {
      setErro('Informe o nome e o numero de pessoas.')
      return
    }

    setAdicionando(true)
    const result = await onAdicionar({ nm_cliente: nome.trim(), nr_pessoas: Number(pessoas) })
    setAdicionando(false)

    if (!result.ok) {
      setErro(result.message)
      return
    }

    setNome('')
    setPessoas('2')
  }

  const handleRemover = async (id) => {
    setRemovendoId(id)
    await onRemover(id)
    setRemovendoId(null)
  }

  return (
    <article className="card section-card fade-in" style={{ '--i': 8 }}>
      <div className="section-head">
        <div>
          <h2>Fila de espera</h2>
          <p>Clientes aguardando liberacao de mesa.</p>
        </div>
      </div>

      {onAdicionar && (
        <form onSubmit={handleAdicionar} className="item-row" style={{ gridTemplateColumns: '1fr 100px auto', marginBottom: 12 }}>
          <input placeholder="Nome do cliente" value={nome} onChange={(event) => setNome(event.target.value)} />
          <input
            type="number"
            min="1"
            placeholder="Pessoas"
            value={pessoas}
            onChange={(event) => setPessoas(event.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={adicionando}>
            {adicionando ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>
      )}
      {erro && <small style={{ color: 'var(--danger)' }}>{erro}</small>}

      <div className="data-table">
        {waitingList.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Ninguem na fila agora.</p>
        )}
        {waitingList.map((entry) => (
          <div className="data-row" key={entry.id} style={{ gridTemplateColumns: '1fr 0.5fr 0.5fr auto' }}>
            <strong>{entry.name}</strong>
            <span>{entry.size} pessoas</span>
            <span>{entry.eta}</span>
            {onRemover && (
              <button
                className="btn btn-light"
                type="button"
                onClick={() => handleRemover(entry.id)}
                disabled={removendoId === entry.id}
              >
                {removendoId === entry.id ? '...' : 'Chamar / remover'}
              </button>
            )}
          </div>
        ))}
      </div>
    </article>
  )
}

function ListaModal({ titulo, subtitulo, colunas, linhas, textoVazio, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{titulo}</h2>
            <p>{subtitulo}</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        {linhas.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>{textoVazio}</p>
        ) : (
          <div className="data-table">
            <div className="data-row row-head" style={{ gridTemplateColumns: colunas.map((c) => c.largura || '1fr').join(' ') }}>
              {colunas.map((coluna) => (
                <span key={coluna.label}>{coluna.label}</span>
              ))}
            </div>
            {linhas.map((linha, index) => (
              <div
                className="data-row"
                key={linha.id ?? index}
                style={{ gridTemplateColumns: colunas.map((c) => c.largura || '1fr').join(' ') }}
              >
                {colunas.map((coluna) => (
                  <span key={coluna.label}>{coluna.render(linha)}</span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Mesas({
  tablesData,
  comandasPendentes = [],
  onConfirmarPagamento,
  empresa,
  onUpdateEmpresa,
  onFetchMesaDetalhe,
  onLiberarMesa,
  onAdicionarFilaEspera,
  onRemoverFilaEspera,
}) {
  const [mesaAberta, setMesaAberta] = useState(null)
  const [listaAberta, setListaAberta] = useState(null)

  const todasAsMesas = useMemo(() => tablesData.areas.flatMap((area) => area.tables), [tablesData.areas])
  const mesasOcupadas = useMemo(() => todasAsMesas.filter((mesa) => mesa.status === 'occupied'), [todasAsMesas])
  const mesasReservadas = useMemo(() => todasAsMesas.filter((mesa) => mesa.status === 'reserved'), [todasAsMesas])

  return (
    <>
      <section className="cards no-print">
        <div className="card metric fade-in" style={{ '--i': 0 }}><div><span>Total de mesas</span><strong>{tablesData.summary.total}</strong></div><div className="metric-icon badge-blue">TT</div></div>
        <button
          type="button"
          className="card metric fade-in"
          style={{ '--i': 1, textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%' }}
          onClick={() => setListaAberta('ocupadas')}
        >
          <div><span>Ocupadas</span><strong>{tablesData.summary.occupied}</strong></div><div className="metric-icon badge-orange">OC</div>
        </button>
        <button
          type="button"
          className="card metric fade-in"
          style={{ '--i': 2, textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%' }}
          onClick={() => setListaAberta('reservadas')}
        >
          <div><span>Reservadas</span><strong>{tablesData.summary.reserved}</strong></div><div className="metric-icon badge-lime">RS</div>
        </button>
        <button
          type="button"
          className="card metric fade-in"
          style={{ '--i': 3, textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%' }}
          onClick={() => setListaAberta('fila')}
        >
          <div><span>Fila de espera</span><strong>{tablesData.summary.waiting}</strong></div><div className="metric-icon badge-sun">FL</div>
        </button>
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

        <FilaEspera
          waitingList={tablesData.waitingList}
          onAdicionar={onAdicionarFilaEspera}
          onRemover={onRemoverFilaEspera}
        />
      </section>

      {mesaAberta && (
        <MesaDetalheModal
          mesaId={mesaAberta.id}
          numero={mesaAberta.number}
          onClose={() => setMesaAberta(null)}
          onFetch={onFetchMesaDetalhe}
          onLiberar={onLiberarMesa}
        />
      )}

      {listaAberta === 'ocupadas' && (
        <ListaModal
          titulo="Mesas ocupadas"
          subtitulo={`${mesasOcupadas.length} mesa(s) com consumo em aberto agora.`}
          textoVazio="Nenhuma mesa ocupada no momento."
          colunas={[
            { label: 'Mesa', largura: '0.6fr', render: (mesa) => `Mesa ${mesa.number}` },
            { label: 'Cliente', largura: '1.2fr', render: (mesa) => (mesa.waiter && mesa.waiter !== '-' ? mesa.waiter : 'Nao identificado') },
            { label: 'Consumo', largura: '0.8fr', render: (mesa) => (mesa.ticket ? `R$ ${mesa.ticket.toFixed(2)}` : 'Sem consumo') },
          ]}
          linhas={mesasOcupadas}
          onClose={() => setListaAberta(null)}
        />
      )}

      {listaAberta === 'reservadas' && (
        <ListaModal
          titulo="Mesas reservadas"
          subtitulo={`${mesasReservadas.length} mesa(s) reservada(s) agora.`}
          textoVazio="Nenhuma mesa reservada no momento."
          colunas={[
            { label: 'Mesa', largura: '0.6fr', render: (mesa) => `Mesa ${mesa.number}` },
            { label: 'Cliente', largura: '1.2fr', render: (mesa) => (mesa.waiter && mesa.waiter !== '-' ? mesa.waiter : 'Nao identificado') },
            { label: 'Lugares', largura: '0.6fr', render: (mesa) => `${mesa.seats} lugares` },
          ]}
          linhas={mesasReservadas}
          onClose={() => setListaAberta(null)}
        />
      )}

      {listaAberta === 'fila' && (
        <ListaModal
          titulo="Fila de espera"
          subtitulo={`${tablesData.waitingList.length} grupo(s) aguardando mesa.`}
          textoVazio="Ninguem na fila agora."
          colunas={[
            { label: 'Nome', largura: '1.2fr', render: (item) => item.name },
            { label: 'Pessoas', largura: '0.6fr', render: (item) => `${item.size} pessoas` },
            { label: 'Esperando', largura: '0.7fr', render: (item) => item.eta },
          ]}
          linhas={tablesData.waitingList}
          onClose={() => setListaAberta(null)}
        />
      )}
    </>
  )
}
