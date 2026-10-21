import React, { useState } from 'react'
import './Insights.css'

const reportColumns = [
  { id: 'id', label: 'Número do pedido' },
  { id: 'date', label: 'Data e hora' },
  { id: 'customer', label: 'Cliente' },
  { id: 'type', label: 'Tipo do pedido' },
  { id: 'channel', label: 'Canal de venda' },
  { id: 'status', label: 'Status' },
  { id: 'payment', label: 'Forma de pagamento' },
  { id: 'total', label: 'Valor total' },
  { id: 'delivery_fee', label: 'Taxa de entrega' },
]

const dateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const initialReportFilters = () => {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 29)

  return {
    start_date: dateInputValue(start),
    end_date: dateInputValue(today),
    status: '',
    type: '',
    channel: '',
    payment: '',
    columns: reportColumns.map(({ id }) => id),
  }
}

export default function Relatorios({ onExportar }) {
  const [filters, setFilters] = useState(initialReportFilters)
  const [exportando, setExportando] = useState(false)
  const [erroExportar, setErroExportar] = useState('')
  const [sucessoExportar, setSucessoExportar] = useState('')

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }))
    setErroExportar('')
    setSucessoExportar('')
  }

  const toggleColumn = (column) => {
    setFilters((current) => ({
      ...current,
      columns: current.columns.includes(column)
        ? current.columns.filter((item) => item !== column)
        : [...current.columns, column],
    }))
    setErroExportar('')
    setSucessoExportar('')
  }

  const handleExportar = async (event) => {
    event.preventDefault()
    setErroExportar('')
    setSucessoExportar('')

    if (filters.start_date > filters.end_date) {
      setErroExportar('A data inicial precisa ser anterior ou igual à data final.')
      return
    }
    if (filters.columns.length === 0) {
      setErroExportar('Selecione ao menos uma coluna para incluir no relatório.')
      return
    }

    setExportando(true)
    try {
      const result = await onExportar(filters)
      if (!result.ok) {
        setErroExportar(result.message || 'Não foi possível gerar o relatório.')
        return
      }
      setSucessoExportar('Relatório CSV gerado com sucesso.')
    } catch (error) {
      setErroExportar(error.message || 'Não foi possível gerar o relatório.')
    } finally {
      setExportando(false)
    }
  }

  const limparFiltros = () => {
    setFilters(initialReportFilters())
    setErroExportar('')
    setSucessoExportar('')
  }

  return (
    <section className="page-stack">
      <article className="card section-card fade-in">
        <div className="section-head">
          <div>
            <h2>Relatório personalizado</h2>
            <p>Escolha o período, os pedidos e os campos para exportar em CSV.</p>
          </div>
        </div>

        <form className="report-form" onSubmit={handleExportar}>
          <div>
            <h3>Filtros dos pedidos</h3>
            <div className="report-filter-grid">
              <label className="insight-field">
                De
                <input
                  className="insight-control"
                  type="date"
                  value={filters.start_date}
                  onChange={(event) => updateFilter('start_date', event.target.value)}
                  required
                />
              </label>
              <label className="insight-field">
                Até
                <input
                  className="insight-control"
                  type="date"
                  value={filters.end_date}
                  onChange={(event) => updateFilter('end_date', event.target.value)}
                  required
                />
              </label>
              <label className="insight-field">
                Status
                <select className="insight-control" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                  <option value="">Todos os status</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="CONFIRMADO">Confirmado</option>
                  <option value="PREPARANDO">Em preparo</option>
                  <option value="PRONTO">Pronto</option>
                  <option value="ENTREGANDO">Em entrega</option>
                  <option value="FINALIZADO">Finalizado</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
              </label>
              <label className="insight-field">
                Tipo do pedido
                <select className="insight-control" value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
                  <option value="">Todos os tipos</option>
                  <option value="DELIVERY">Delivery</option>
                  <option value="BALCAO">Balcão</option>
                  <option value="MESA">Mesa</option>
                </select>
              </label>
              <label className="insight-field">
                Canal de venda
                <select className="insight-control" value={filters.channel} onChange={(event) => updateFilter('channel', event.target.value)}>
                  <option value="">Todos os canais</option>
                  <option value="ONLINE">Online</option>
                  <option value="PRESENCIAL">Presencial</option>
                  <option value="IFOOD">iFood</option>
                  <option value="99FOOD">99Food</option>
                </select>
              </label>
              <label className="insight-field">
                Forma de pagamento
                <select className="insight-control" value={filters.payment} onChange={(event) => updateFilter('payment', event.target.value)}>
                  <option value="">Todas as formas</option>
                  <option value="PIX">Pix</option>
                  <option value="CARTAO">Cartão</option>
                  <option value="DINHEIRO">Dinheiro</option>
                </select>
              </label>
            </div>
          </div>

          <div>
            <h3>Colunas do arquivo</h3>
            <div className="report-columns">
              {reportColumns.map((column) => (
                <label className="report-option" key={column.id}>
                  <input
                    type="checkbox"
                    checked={filters.columns.includes(column.id)}
                    onChange={() => toggleColumn(column.id)}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </div>

          {erroExportar && <p role="alert" style={{ color: 'var(--danger)', margin: 0 }}>{erroExportar}</p>}
          {sucessoExportar && <p role="status" style={{ color: 'var(--success)', margin: 0 }}>{sucessoExportar}</p>}
          <div className="report-actions">
            <button className="btn btn-primary" type="submit" disabled={exportando}>
              {exportando ? 'Gerando...' : 'Gerar e baixar CSV'}
            </button>
            <button className="btn btn-light" type="button" onClick={limparFiltros} disabled={exportando}>
              Limpar filtros
            </button>
          </div>
        </form>
      </article>
    </section>
  )
}
