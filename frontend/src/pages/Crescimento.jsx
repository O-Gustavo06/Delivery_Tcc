import React, { useEffect, useState } from 'react'
import Financeiro from './Financeiro.jsx'
import './Insights.css'

const formatDateInput = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatMoney = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(value || 0))

const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
const formatMonth = (date) => date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

export default function Crescimento({ onFetchGrowth, onNavigate, financeData, onVerPedido, onAtualizarChecklist }) {
  const hoje = new Date()
  const inicioPadrao = new Date(hoje)
  inicioPadrao.setDate(hoje.getDate() - 29)

  const [inicio, setInicio] = useState(formatDateInput(inicioPadrao))
  const [fim, setFim] = useState(formatDateInput(hoje))
  const [atalhoPeriodo, setAtalhoPeriodo] = useState('30')
  const [periodo, setPeriodo] = useState({ inicio: formatDateInput(inicioPadrao), fim: formatDateInput(hoje) })
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mesCalendario, setMesCalendario] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [dadosCalendario, setDadosCalendario] = useState(null)
  const [carregandoCalendario, setCarregandoCalendario] = useState(true)
  const [erroCalendario, setErroCalendario] = useState('')
  const [diaSelecionado, setDiaSelecionado] = useState(formatDateInput(hoje))
  const [visao, setVisao] = useState(() => (
    window.location.pathname === '/financeiro' ? 'financeiro' : 'crescimento'
  ))

  useEffect(() => {
    if (visao !== 'crescimento') {
      setCarregando(false)
      return undefined
    }

    let ativo = true
    setCarregando(true)
    setErro('')

    onFetchGrowth(periodo.inicio, periodo.fim)
      .then((resultado) => {
        if (!ativo) return
        if (!resultado.ok) {
          setErro(resultado.message)
          setDados(null)
          return
        }
        setDados(resultado.data)
      })
      .catch((error) => {
        if (ativo) setErro(error.message || 'Não foi possível carregar os indicadores.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })

    return () => {
      ativo = false
    }
  }, [onFetchGrowth, periodo, visao])

  useEffect(() => {
    if (visao !== 'crescimento') return undefined

    let ativo = true
    const inicioMes = formatDateInput(mesCalendario)
    const fimMes = formatDateInput(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 0))
    setCarregandoCalendario(true)
    setErroCalendario('')

    onFetchGrowth(inicioMes, fimMes)
      .then((resultado) => {
        if (!ativo) return
        if (!resultado.ok) {
          setErroCalendario(resultado.message)
          setDadosCalendario(null)
          return
        }
        setDadosCalendario(resultado.data)
      })
      .catch((error) => {
        if (ativo) setErroCalendario(error.message || 'Não foi possível carregar os dados do calendário.')
      })
      .finally(() => {
        if (ativo) setCarregandoCalendario(false)
      })

    return () => {
      ativo = false
    }
  }, [mesCalendario, onFetchGrowth, visao])

  const aplicarPeriodo = (event) => {
    event.preventDefault()
    if (inicio > fim) {
      setErro('A data inicial precisa ser anterior ou igual à data final.')
      return
    }
    setPeriodo({ inicio, fim })
  }

  const alterarAtalhoPeriodo = (value) => {
    setAtalhoPeriodo(value)
    if (value === 'custom') return

    const dataFim = new Date()
    const dataInicio = new Date(dataFim)
    dataInicio.setDate(dataFim.getDate() - Number(value) + 1)
    setInicio(formatDateInput(dataInicio))
    setFim(formatDateInput(dataFim))
  }

  const diasDoMes = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 0).getDate()
  const deslocamentoInicio = (new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), 1).getDay() + 6) % 7
  const diasCalendario = [
    ...Array.from({ length: deslocamentoInicio }, (_, index) => ({ chave: `vazio-${index}` })),
    ...Array.from({ length: diasDoMes }, (_, index) => {
      const data = formatDateInput(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), index + 1))
      return { chave: data, data, dia: index + 1 }
    }),
  ]
  const vendasCalendario = new Map((dadosCalendario?.vendas_por_dia ?? []).map((dia) => [dia.data, dia]))
  const resumoDiaSelecionado = vendasCalendario.get(diaSelecionado)

  const indicadores = dados?.indicadores

  if (visao === 'financeiro') {
    return (
      <section className="page-stack">
        <article className="card section-card fade-in">
          <div className="section-head">
            <div>
              <h2>Financeiro</h2>
              <p>Fluxo de caixa, pagamentos e fechamento diário.</p>
            </div>
            <div className="growth-shortcuts">
              <button className="btn btn-light" type="button" onClick={() => setVisao('crescimento')}>Crescimento</button>
            </div>
          </div>
        </article>
        <Financeiro
          financeData={financeData}
          onVerPedido={onVerPedido}
          onAtualizarChecklist={onAtualizarChecklist}
        />
      </section>
    )
  }

  return (
    <section className="page-stack">
      <article className="card section-card fade-in">
        <div className="section-head">
          <div>
            <h2>Crescimento</h2>
            <p>Desempenho de vendas, recorrência e satisfação com base nos pedidos concluídos.</p>
          </div>
          <div className="growth-toolbar">
            <div className="growth-shortcuts">
              <button className="btn btn-light" type="button" onClick={() => setVisao('financeiro')}>Financeiro</button>
              <button className="btn btn-light" type="button" onClick={() => onNavigate('/relatorios')}>Relatórios</button>
            </div>
            <form className="growth-filters" onSubmit={aplicarPeriodo}>
              <label className="insight-field">
                Período
                <select className="insight-control" value={atalhoPeriodo} onChange={(event) => alterarAtalhoPeriodo(event.target.value)}>
                  <option value="7">Últimos 7 dias</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                  <option value="custom">Personalizado</option>
                </select>
              </label>
              <label className="insight-field">
                De
                <input className="insight-control" type="date" value={inicio} onChange={(event) => { setInicio(event.target.value); setAtalhoPeriodo('custom') }} />
              </label>
              <label className="insight-field">
                Até
                <input className="insight-control" type="date" value={fim} onChange={(event) => { setFim(event.target.value); setAtalhoPeriodo('custom') }} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={carregando}>Aplicar</button>
            </form>
          </div>
        </div>

        {erro && <p role="alert" style={{ color: 'var(--danger)' }}>{erro}</p>}
        {carregando && <p style={{ color: 'var(--muted)' }}>Carregando indicadores...</p>}
        {!carregando && dados && (
          <>
            <p style={{ color: 'var(--muted)', margin: '4px 0 18px' }}>
              Período: {formatDate(dados.periodo.inicio)} a {formatDate(dados.periodo.fim)}
            </p>
            <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <div className="metric card"><strong>{indicadores.pedidos}</strong><span>Pedidos concluídos</span></div>
              <div className="metric card"><strong>{formatMoney(indicadores.faturamento)}</strong><span>Vendas</span></div>
              <div className="metric card"><strong>{formatMoney(indicadores.ticket_medio)}</strong><span>Ticket médio</span></div>
              <div className="metric card"><strong>{indicadores.recorrentes} ({indicadores.taxa_recorrencia}%)</strong><span>Clientes recorrentes</span></div>
              <div className="metric card"><strong>{indicadores.nota_media == null ? '—' : `${indicadores.nota_media} / 5`}</strong><span>Satisfação · {indicadores.avaliacoes} avaliações</span></div>
            </div>
          </>
        )}
      </article>

      {dados && (
        <div className="page-grid page-grid-2-1">
          <div className="page-stack">
            <article className="card section-card">
              <div className="section-head">
                <div>
                  <h2>Calendário de lucros</h2>
                  <p>Lucro diário = pagamentos aprovados menos compras registradas.</p>
                </div>
                <div className="calendar-navigation">
                  <button
                    className="btn btn-light"
                    type="button"
                    aria-label="Mês anterior"
                    onClick={() => {
                      const novoMes = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1, 1)
                      setMesCalendario(novoMes)
                      setDiaSelecionado(formatDateInput(novoMes))
                    }}
                  >
                    ‹
                  </button>
                  <strong>{formatMonth(mesCalendario)}</strong>
                  <button
                    className="btn btn-light"
                    type="button"
                    aria-label="Próximo mês"
                    onClick={() => {
                      const novoMes = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1)
                      setMesCalendario(novoMes)
                      setDiaSelecionado(formatDateInput(novoMes))
                    }}
                  >
                    ›
                  </button>
                </div>
              </div>
              {erroCalendario && <p role="alert" style={{ color: 'var(--danger)' }}>{erroCalendario}</p>}
              {carregandoCalendario && <p style={{ color: 'var(--muted)' }}>Carregando calendário...</p>}
              {!carregandoCalendario && !erroCalendario && (
                <>
                  <div className="growth-calendar" aria-label={`Calendário de ${formatMonth(mesCalendario)}`}>
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((dia) => (
                      <strong className="calendar-weekday" key={dia}>{dia}</strong>
                    ))}
                    {diasCalendario.map(({ chave, data, dia }) => {
                      if (!data) return <span className="calendar-day calendar-day-empty" key={chave} aria-hidden="true" />
                      const resumo = vendasCalendario.get(data)
                      const selecionado = diaSelecionado === data
                      return (
                        <button
                          className={`calendar-day${selecionado ? ' calendar-day-selected' : ''}${resumo ? ' calendar-day-has-data' : ''}`}
                          type="button"
                          key={chave}
                          aria-pressed={selecionado}
                          onClick={() => setDiaSelecionado(data)}
                        >
                          <span>{dia}</span>
                          {resumo && <strong>{formatMoney(resumo.lucro)}</strong>}
                        </button>
                      )
                    })}
                  </div>
                  <div className="calendar-day-details">
                    <h3>Vendas de {formatDate(diaSelecionado)}</h3>
                    {resumoDiaSelecionado ? (
                      <>
                        <div className="calendar-day-summary">
                          <span>{resumoDiaSelecionado.pedidos} pedido(s)</span>
                          <span>Vendas: {formatMoney(resumoDiaSelecionado.faturamento)}</span>
                          <span>Receita: {formatMoney(resumoDiaSelecionado.receita)}</span>
                          <span>Compras: {formatMoney(resumoDiaSelecionado.custo_compras)}</span>
                          <strong>Lucro: {formatMoney(resumoDiaSelecionado.lucro)}</strong>
                        </div>
                        {resumoDiaSelecionado.produtos.length ? (
                          <div className="data-table">
                            <div className="data-row row-head" style={{ gridTemplateColumns: '1fr 0.5fr 0.7fr' }}>
                              <span>Produto</span><span>Unidades</span><span>Faturamento</span>
                            </div>
                            {resumoDiaSelecionado.produtos.map((produto) => (
                              <div className="data-row" key={produto.id} style={{ gridTemplateColumns: '1fr 0.5fr 0.7fr' }}>
                                <strong>{produto.nome}</strong><span>{produto.quantidade}</span><span>{formatMoney(produto.faturamento)}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p style={{ color: 'var(--muted)' }}>Nenhum produto vendido neste dia.</p>}
                      </>
                    ) : <p style={{ color: 'var(--muted)' }}>Sem vendas ou compras registradas neste dia.</p>}
                  </div>
                </>
              )}
            </article>

            <article className="card section-card">
              <div className="section-head">
                <div>
                  <h2>Produtos mais vendidos</h2>
                  <p>Quantidade e faturamento de cada produto no período.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="data-row row-head" style={{ gridTemplateColumns: '1fr 0.5fr 0.7fr' }}>
                  <span>Produto</span><span>Unidades</span><span>Faturamento</span>
                </div>
                {dados.mais_vendidos.length ? dados.mais_vendidos.map((produto) => (
                  <div className="data-row" key={produto.id} style={{ gridTemplateColumns: '1fr 0.5fr 0.7fr' }}>
                    <strong>{produto.nome}</strong><span>{produto.quantidade}</span><span>{formatMoney(produto.faturamento)}</span>
                  </div>
                )) : <p style={{ color: 'var(--muted)' }}>Sem vendas concluídas neste período.</p>}
              </div>
            </article>

            <article className="card section-card">
              <div className="section-head">
                <div>
                  <h2>Evolução das vendas</h2>
                  <p>Pedidos concluídos e faturamento por dia.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="data-row row-head" style={{ gridTemplateColumns: '1fr 0.5fr 0.7fr' }}>
                  <span>Data</span><span>Pedidos</span><span>Faturamento</span>
                </div>
                {dados.vendas_por_dia.length ? dados.vendas_por_dia.map((dia) => (
                  <div className="data-row" key={dia.data} style={{ gridTemplateColumns: '1fr 0.5fr 0.7fr' }}>
                    <strong>{formatDate(dia.data)}</strong><span>{dia.pedidos}</span><span>{formatMoney(dia.faturamento)}</span>
                  </div>
                )) : <p style={{ color: 'var(--muted)' }}>Ainda não há vendas concluídas neste período.</p>}
              </div>
            </article>
          </div>

        </div>
      )}
      {dados?.feedback_negativo?.length > 0 && (
        <article className="card section-card" style={{ borderLeft: '3px solid var(--danger)', paddingLeft: 14 }}>
          <div className="section-head">
            <div>
              <h2>Feedback que pede atenção</h2>
              <p>Avaliações com nota 1 ou 2, incluindo respostas recebidas pelo WhatsApp.</p>
            </div>
          </div>
          <div className="data-table">
            {dados.feedback_negativo.map((feedback, index) => (
              <div className="data-row" key={`${feedback.referencia}-${feedback.data}-${index}`} style={{ gridTemplateColumns: '1fr 0.7fr 0.3fr 1.5fr' }}>
                <strong>{feedback.cliente}</strong>
                <span>{feedback.referencia}</span>
                <strong style={{ color: 'var(--danger)' }}>{feedback.nota}/5</strong>
                <span>{feedback.comentario || 'Sem comentário'}</span>
              </div>
            ))}
          </div>
        </article>
      )}
      {dados && (
        <article className="card section-card">
          <div className="section-head">
            <div>
              <h2>Mais bem avaliados</h2>
              <p>Nota média dos pedidos que incluíram cada produto.</p>
            </div>
          </div>
          <div className="data-table">
            {dados.mais_bem_avaliados.length ? dados.mais_bem_avaliados.map((produto) => (
              <div className="data-row" key={produto.id} style={{ gridTemplateColumns: '1fr 0.5fr' }}>
                <strong>{produto.nome}<small style={{ display: 'block', color: 'var(--muted)' }}>{produto.avaliacoes} avaliação(ões)</small></strong>
                <span>{produto.media} / 5</span>
              </div>
            )) : <p style={{ color: 'var(--muted)' }}>Sem avaliações de pedidos neste período.</p>}
          </div>
        </article>
      )}
      {dados && (
        <article className="card section-card">
          <div className="section-head">
            <div>
              <h2>Satisfação dos clientes</h2>
              <p>Avaliações existentes e respostas recebidas pelo WhatsApp.</p>
            </div>
          </div>
          <div className="data-table">
            {dados.satisfacao_por_dia.length ? dados.satisfacao_por_dia.map((dia) => (
              <div className="data-row" key={dia.data} style={{ gridTemplateColumns: '1fr 0.5fr 0.5fr' }}>
                <strong>{formatDate(dia.data)}</strong><span>{dia.media} / 5</span><span>{dia.quantidade} resposta(s)</span>
              </div>
            )) : <p style={{ color: 'var(--muted)' }}>Sem respostas de avaliação neste período.</p>}
          </div>
        </article>
      )}
    </section>
  )
}
