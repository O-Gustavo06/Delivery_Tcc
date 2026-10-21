import React, { useEffect, useState } from 'react'
import './Insights.css'

const formatMoney = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(value || 0))

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR')
}

function SegmentoModal({ segmento, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><h2>Clientes {segmento.name}</h2><p>{segmento.note}</p></div>
          <button className="btn btn-light" type="button" onClick={onClose}>Fechar</button>
        </div>
        {segmento.clientes.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Nenhum cliente nesse segmento ainda.</p>
        ) : (
          <div className="data-table">
            <div className="data-row row-head" style={{ gridTemplateColumns: '1fr 0.5fr 0.6fr' }}>
              <span>Cliente</span><span>Pedidos</span><span>Ticket médio</span>
            </div>
            {segmento.clientes.map((cliente) => (
              <div className="data-row" key={cliente.id} style={{ gridTemplateColumns: '1fr 0.5fr 0.6fr' }}>
                <strong>{cliente.nome}</strong><span>{cliente.pedidos}</span><span>{cliente.ticketMedio}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AuditoriaModal({ audit, cliente, carregando, erro, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 920, maxHeight: '90vh', overflowY: 'auto' }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Auditoria de consumo</h2>
            <p>{cliente.nome} · {cliente.telefone || 'Telefone não informado'}</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>Fechar</button>
        </div>

        {carregando && <p style={{ color: 'var(--muted)' }}>Carregando histórico...</p>}
        {erro && <p role="alert" style={{ color: 'var(--danger)' }}>{erro}</p>}
        {audit && (
          <>
            <div className="mini-grid">
              <div className="info-tile"><span>Pedidos concluídos</span><strong>{audit.indicadores.pedidos}</strong></div>
              <div className="info-tile"><span>Intervalo médio</span><strong>{audit.indicadores.frequencia_media_dias == null ? '—' : `${audit.indicadores.frequencia_media_dias} dias`}</strong></div>
              <div className="info-tile"><span>Último pedido</span><strong>{formatDate(audit.indicadores.ultimo_pedido)}</strong></div>
            </div>

            <section className="section-card">
              <div className="section-head"><div><h3>Produtos mais consumidos</h3></div></div>
              {audit.produtos_favoritos.length ? (
                <div className="data-table">
                  {audit.produtos_favoritos.map((produto) => (
                    <div className="data-row" key={produto.id} style={{ gridTemplateColumns: '1fr 0.5fr' }}>
                      <strong>{produto.nome}</strong><span>{produto.quantidade} unidade(s)</span>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: 'var(--muted)' }}>Sem pedidos concluídos registrados.</p>}
            </section>

            <section className="section-card">
              <div className="section-head"><div><h3>Pedidos e avaliações</h3></div></div>
              {audit.pedidos.length ? audit.pedidos.map((pedido) => (
                <div className="check-item" key={pedido.id} style={{ display: 'block' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>Pedido #{pedido.id} · {formatDate(pedido.data)}</strong>
                    <span>{formatMoney(pedido.total)} · {pedido.canal || pedido.tipo} · {pedido.status}</span>
                  </div>
                  <p style={{ margin: '6px 0', color: 'var(--muted)' }}>
                    {pedido.itens.map((item) => `${item.quantidade}x ${item.produto} (${formatMoney(item.subtotal)})`).join(' · ')}
                  </p>
                  {pedido.avaliacao && (
                    <p style={{ margin: 0, color: pedido.avaliacao.nota <= 2 ? 'var(--danger)' : 'inherit' }}>
                      Avaliação: {pedido.avaliacao.nota}/5{pedido.avaliacao.comentario ? ` · ${pedido.avaliacao.comentario}` : ''}
                    </p>
                  )}
                </div>
              )) : <p style={{ color: 'var(--muted)' }}>Nenhum pedido encontrado.</p>}
            </section>

            <section className="section-card">
              <div className="section-head"><div><h3>Pós-venda pelo WhatsApp</h3></div></div>
              {audit.pos_venda.length ? audit.pos_venda.map((pesquisa) => (
                <div className="data-row" key={pesquisa.id} style={{ gridTemplateColumns: '1fr 0.6fr 1fr' }}>
                  <strong>{pesquisa.pedido ? `Pedido #${pesquisa.pedido}` : `Comanda #${pesquisa.comanda}`}</strong>
                  <span style={{ color: pesquisa.nota && pesquisa.nota <= 2 ? 'var(--danger)' : 'inherit' }}>
                    {pesquisa.nota ? `${pesquisa.nota}/5` : pesquisa.status}
                  </span>
                  <span>{pesquisa.comentario || formatDate(pesquisa.respondido_em || pesquisa.enviado_em)}</span>
                </div>
              )) : <p style={{ color: 'var(--muted)' }}>Nenhuma pesquisa de pós-venda registrada.</p>}
            </section>

            <section className="section-card">
              <div className="section-head"><div><h3>Histórico de mensagens</h3></div></div>
              {audit.mensagens.length ? audit.mensagens.map((mensagem) => (
                <div className="data-row" key={mensagem.id} style={{ gridTemplateColumns: '0.45fr 1fr 1.5fr' }}>
                  <strong>{mensagem.direcao === 'ENTRADA' ? 'Cliente' : 'Restaurante'}</strong>
                  <span>{formatDate(mensagem.data)}</span>
                  <span>{mensagem.conteudo || 'Mensagem sem texto'}</span>
                </div>
              )) : <p style={{ color: 'var(--muted)' }}>Nenhuma mensagem vinculada a este cliente.</p>}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default function Clientes({ customersData, onFetchCustomers, onFetchCustomerAudit }) {
  const [segmentoAberto, setSegmentoAberto] = useState(null)
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState(null)
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [erroLista, setErroLista] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  const [auditoria, setAuditoria] = useState(null)
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false)
  const [erroAuditoria, setErroAuditoria] = useState('')

  useEffect(() => {
    let ativo = true
    const timer = setTimeout(() => {
      setCarregandoLista(true)
      setErroLista('')
      onFetchCustomers(busca.trim(), pagina)
        .then((resultado) => {
          if (!ativo) return
          if (!resultado.ok) {
            setErroLista(resultado.message)
            setLista(null)
            return
          }
          setLista(resultado.data)
        })
        .catch((error) => {
          if (ativo) setErroLista(error.message || 'Não foi possível carregar a lista de clientes.')
        })
        .finally(() => {
          if (ativo) setCarregandoLista(false)
        })
    }, 250)

    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [busca, pagina, onFetchCustomers])

  const abrirAuditoria = async (cliente) => {
    setClienteSelecionado(cliente)
    setAuditoria(null)
    setErroAuditoria('')
    setCarregandoAuditoria(true)
    try {
      const resultado = await onFetchCustomerAudit(cliente.id)
      if (!resultado.ok) {
        setErroAuditoria(resultado.message)
        return
      }
      setAuditoria(resultado.data)
    } catch (error) {
      setErroAuditoria(error.message || 'Não foi possível carregar a auditoria.')
    } finally {
      setCarregandoAuditoria(false)
    }
  }

  const fecharAuditoria = () => {
    setClienteSelecionado(null)
    setAuditoria(null)
  }

  return (
    <section className="page-grid page-grid-2-1">
      <div className="page-stack">
        <article className="card section-card fade-in">
          <div className="section-head">
            <div>
              <h2>Base de clientes</h2>
              <p>Clientes de delivery, balcão e mesa são reunidos pelo telefone normalizado.</p>
            </div>
            <input
              className="insight-control client-search"
              type="search"
              placeholder="Buscar por nome ou telefone"
              value={busca}
              onChange={(event) => { setBusca(event.target.value); setPagina(1) }}
              aria-label="Buscar clientes"
            />
          </div>
          {erroLista && <p role="alert" style={{ color: 'var(--danger)' }}>{erroLista}</p>}
          <div className="data-table">
            <div className="data-row row-head" style={{ gridTemplateColumns: '1fr 0.7fr 0.45fr 0.8fr' }}>
              <span>Cliente</span><span>Telefone</span><span>Pedidos</span><span>Último pedido</span>
            </div>
            {lista?.data?.map((cliente) => (
              <button
                type="button"
                key={cliente.id}
                className="data-row"
                onClick={() => abrirAuditoria(cliente)}
                style={{ gridTemplateColumns: '1fr 0.7fr 0.45fr 0.8fr', width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}
              >
                <strong>{cliente.nome}</strong><span>{cliente.telefone || '—'}</span><span>{cliente.pedidos}</span><span>{formatDate(cliente.ultimo_pedido)}</span>
              </button>
            ))}
          </div>
          {carregandoLista && <p style={{ color: 'var(--muted)' }}>Carregando clientes...</p>}
          {!carregandoLista && !erroLista && lista?.data?.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum cliente encontrado.</p>}
          {lista && lista.last_page > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={{ color: 'var(--muted)' }}>{lista.total} cliente(s)</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-light" type="button" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
                <span style={{ alignSelf: 'center' }}>{lista.current_page} / {lista.last_page}</span>
                <button className="btn btn-light" type="button" disabled={pagina >= lista.last_page} onClick={() => setPagina(pagina + 1)}>Próxima</button>
              </div>
            </div>
          )}
        </article>

        <article className="card section-card fade-in">
          <div className="section-head">
            <div><h2>Segmentos</h2><p>Distribuição por recorrência e valor médio — selecione para ver o grupo.</p></div>
          </div>
          <div className="mini-grid">
            {customersData.segments.map((segment) => (
              <button
                type="button"
                className="info-tile"
                key={segment.id}
                onClick={() => setSegmentoAberto(segment)}
                style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%' }}
              >
                <span>{segment.name}</span><strong>{segment.customers} clientes</strong><p>{segment.average}</p><span>{segment.note}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="card section-card fade-in">
          <div className="section-head"><div><h2>Clientes em destaque</h2><p>Relacionamento e comportamento recente de compra.</p></div></div>
          <div className="data-table">
            {customersData.spotlight.map((customer) => (
              <div className="data-row" key={customer.id} style={{ gridTemplateColumns: '1fr 0.6fr 0.8fr 0.8fr' }}>
                <strong>{customer.name}</strong><span>{customer.orders} pedidos</span><span>{customer.favorite}</span><span>{customer.lastOrder}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="card section-card fade-in">
        <div className="section-head"><div><h2>Oportunidades</h2><p>Segmentos acionáveis calculados a partir do histórico.</p></div></div>
        <div className="check-list">
          {customersData.campaigns.map((campaign) => <div className="check-item" key={campaign}><span>{campaign}</span></div>)}
        </div>
      </article>

      {segmentoAberto && <SegmentoModal segmento={segmentoAberto} onClose={() => setSegmentoAberto(null)} />}
      {clienteSelecionado && (
        <AuditoriaModal
          audit={auditoria}
          cliente={clienteSelecionado}
          carregando={carregandoAuditoria}
          erro={erroAuditoria}
          onClose={fecharAuditoria}
        />
      )}
    </section>
  )
}
