import React, { useEffect, useState } from 'react'
import MonthlyBarChart from './components/MonthlyBarChart.jsx'

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const emptyItem = () => ({ id_ingrediente: '', qtde: '1', vl_unitario: '' })
const emptyNovoIngrediente = () => ({ nm_ingrediente: '', unidade: 'kg' })
const UNIDADES_COMUNS = ['kg', 'g', 'L', 'ml', 'un', 'cx', 'pct']

function RegistrarCompraModal({ ingredientes, onCreate, onCriarIngrediente, onIngredienteCriado, onClose }) {
  const [nmFornecedor, setNmFornecedor] = useState('')
  const [dsDescricao, setDsDescricao] = useState('')
  const [dtCompra, setDtCompra] = useState(() => new Date().toISOString().slice(0, 10))
  const [itens, setItens] = useState([emptyItem()])
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [novoIngredienteAberto, setNovoIngredienteAberto] = useState(false)
  const [novoIngrediente, setNovoIngrediente] = useState(emptyNovoIngrediente())
  const [criandoIngrediente, setCriandoIngrediente] = useState(false)
  const [erroIngrediente, setErroIngrediente] = useState('')

  const handleCriarIngrediente = async () => {
    setErroIngrediente('')
    if (!novoIngrediente.nm_ingrediente.trim()) {
      setErroIngrediente('Informe o nome do ingrediente.')
      return
    }

    setCriandoIngrediente(true)
    const result = await onCriarIngrediente({
      nm_ingrediente: novoIngrediente.nm_ingrediente.trim(),
      unidade: novoIngrediente.unidade,
    })
    setCriandoIngrediente(false)

    if (!result.ok) {
      setErroIngrediente(result.message)
      return
    }

    onIngredienteCriado(result.ingrediente)
    setItens((prev) => {
      const semSelecao = prev.findIndex((item) => !item.id_ingrediente)
      if (semSelecao === -1) return prev
      return prev.map((item, i) => (i === semSelecao ? { ...item, id_ingrediente: String(result.ingrediente.id) } : item))
    })
    setNovoIngrediente(emptyNovoIngrediente())
    setNovoIngredienteAberto(false)
  }

  const updateItem = (index, field, value) => {
    setItens((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const addItem = () => setItens((prev) => [...prev, emptyItem()])
  const removeItem = (index) => setItens((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))

  const total = itens.reduce((sum, item) => sum + (Number(item.qtde) || 0) * (Number(item.vl_unitario) || 0), 0)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const validItems = itens.filter((item) => item.id_ingrediente && Number(item.qtde) > 0 && item.vl_unitario !== '')
    if (validItems.length === 0) {
      setError('Selecione pelo menos um ingrediente com quantidade e valor.')
      return
    }

    setIsSaving(true)
    const result = await onCreate({
      nm_fornecedor: nmFornecedor.trim() || undefined,
      ds_descricao: dsDescricao.trim() || undefined,
      dt_compra: dtCompra,
      itens: validItems.map((item) => ({
        id_ingrediente: Number(item.id_ingrediente),
        qtde: Number(item.qtde),
        vl_unitario: Number(item.vl_unitario),
      })),
    })
    setIsSaving(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Registrar compra</h2>
            <p>Aumenta o estoque dos ingredientes selecionados automaticamente.</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div className="form-grid-2">
            <div className="filter-group">
              <label>Fornecedor</label>
              <input value={nmFornecedor} onChange={(event) => setNmFornecedor(event.target.value)} />
            </div>
            <div className="filter-group">
              <label>Data da compra</label>
              <input type="date" value={dtCompra} onChange={(event) => setDtCompra(event.target.value)} required />
            </div>
          </div>

          <div className="filter-group">
            <label>Descricao</label>
            <input value={dsDescricao} onChange={(event) => setDsDescricao(event.target.value)} placeholder="Ex: reposicao semanal" />
          </div>

          <div>
            <label style={{ fontSize: 12.5, color: 'var(--muted)' }}>Itens</label>
            <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
              {itens.map((item, index) => (
                <div className="item-row" key={index}>
                  <select
                    value={item.id_ingrediente}
                    onChange={(event) => updateItem(index, 'id_ingrediente', event.target.value)}
                  >
                    <option value="">Ingrediente...</option>
                    {ingredientes.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="Qtd"
                    value={item.qtde}
                    onChange={(event) => updateItem(index, 'qtde', event.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Vl. unit"
                    value={item.vl_unitario}
                    onChange={(event) => updateItem(index, 'vl_unitario', event.target.value)}
                  />
                  <button
                    className="item-remove"
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={itens.length === 1}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-light" type="button" style={{ marginTop: 8 }} onClick={addItem}>
              + Adicionar item
            </button>
          </div>

          <div>
            {!novoIngredienteAberto ? (
              <button
                className="btn btn-light"
                type="button"
                onClick={() => setNovoIngredienteAberto(true)}
              >
                + Novo ingrediente
              </button>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ fontSize: 12.5, color: 'var(--muted)' }}>Novo ingrediente</label>
                <div className="item-row" style={{ gridTemplateColumns: '1fr 100px auto auto' }}>
                  <input
                    value={novoIngrediente.nm_ingrediente}
                    onChange={(event) => setNovoIngrediente((prev) => ({ ...prev, nm_ingrediente: event.target.value }))}
                    placeholder="Ex: Azeite de oliva"
                    autoFocus
                  />
                  <select
                    value={novoIngrediente.unidade}
                    onChange={(event) => setNovoIngrediente((prev) => ({ ...prev, unidade: event.target.value }))}
                  >
                    {UNIDADES_COMUNS.map((unidade) => (
                      <option key={unidade} value={unidade}>
                        {unidade}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-primary" type="button" onClick={handleCriarIngrediente} disabled={criandoIngrediente}>
                    {criandoIngrediente ? 'Criando...' : 'Criar'}
                  </button>
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => {
                      setNovoIngredienteAberto(false)
                      setErroIngrediente('')
                    }}
                  >
                    Cancelar
                  </button>
                </div>
                {erroIngrediente && (
                  <div className="login-error" role="alert">
                    {erroIngrediente}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="items-total">
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Registrando...' : 'Registrar compra'}
          </button>
        </form>
      </div>
    </div>
  )
}

const TIPOS_MOVIMENTO = [
  { value: 'SAIDA', label: 'Saida (quebra/perda)' },
  { value: 'AJUSTE', label: 'Ajuste (correcao para menos)' },
  { value: 'ENTRADA', label: 'Entrada (correcao para mais)' },
]

function MovimentoAvulsoModal({ ingredientes, onRegistrar, onClose }) {
  const [idIngrediente, setIdIngrediente] = useState('')
  const [tipo, setTipo] = useState('SAIDA')
  const [qtde, setQtde] = useState('')
  const [dsMotivo, setDsMotivo] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!idIngrediente || !qtde || Number(qtde) <= 0) {
      setError('Selecione o ingrediente e informe uma quantidade valida.')
      return
    }

    setIsSaving(true)
    const result = await onRegistrar({
      id_ingrediente: Number(idIngrediente),
      tipo,
      qtde: Number(qtde),
      ds_motivo: dsMotivo.trim() || undefined,
    })
    setIsSaving(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Movimento avulso de estoque</h2>
            <p>Quebra, perda ou correcao manual - nao ligado a compra nem a pedido.</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div className="filter-group">
            <label>Ingrediente</label>
            <select value={idIngrediente} onChange={(event) => setIdIngrediente(event.target.value)} required>
              <option value="">Selecione...</option>
              {ingredientes.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.qtdAtual} {ing.unit} em estoque)
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid-2">
            <div className="filter-group">
              <label>Tipo</label>
              <select value={tipo} onChange={(event) => setTipo(event.target.value)}>
                {TIPOS_MOVIMENTO.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Quantidade</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={qtde}
                onChange={(event) => setQtde(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Motivo (opcional)</label>
            <input
              value={dsMotivo}
              onChange={(event) => setDsMotivo(event.target.value)}
              placeholder="Ex: produto vencido, contagem de inventario..."
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Registrando...' : 'Registrar movimento'}
          </button>
        </form>
      </div>
    </div>
  )
}

function EditarIngredienteModal({ ingrediente, onEditar, onClose }) {
  const [nome, setNome] = useState(ingrediente.name)
  const [unidade, setUnidade] = useState(ingrediente.unit)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!nome.trim()) {
      setError('Informe o nome do ingrediente.')
      return
    }

    setIsSaving(true)
    const result = await onEditar(ingrediente.id, { nm_ingrediente: nome.trim(), unidade })
    setIsSaving(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 420 }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Editar ingrediente</h2>
            <p>A quantidade em estoque nao muda aqui - use "Movimento avulso" ou uma compra pra isso.</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div className="filter-group">
            <label>Nome do ingrediente</label>
            <input value={nome} onChange={(event) => setNome(event.target.value)} required />
          </div>

          <div className="filter-group">
            <label>Unidade</label>
            <select value={unidade} onChange={(event) => setUnidade(event.target.value)}>
              {UNIDADES_COMUNS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Compras({
  onFetchIngredientes,
  onFetchCompras,
  onFetchResumoFinanceiro,
  onRegistrarCompra,
  onCriarIngrediente,
  onEditarIngrediente,
  onRegistrarMovimentoAvulso,
}) {
  const [ingredientes, setIngredientes] = useState([])
  const [compras, setCompras] = useState([])
  const [resumo, setResumo] = useState({ kpis: [], meses: [], topIngredientesComprados: [] })
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMovimentoModalOpen, setIsMovimentoModalOpen] = useState(false)
  const [ingredienteEditar, setIngredienteEditar] = useState(null)

  const carregarTudo = async () => {
    const [ingredientesResp, comprasResp, resumoResp] = await Promise.all([
      onFetchIngredientes(),
      onFetchCompras(),
      onFetchResumoFinanceiro(),
    ])
    if (ingredientesResp?.data) setIngredientes(ingredientesResp.data)
    if (comprasResp?.data) setCompras(comprasResp.data)
    if (resumoResp) setResumo(resumoResp)
  }

  useEffect(() => {
    setLoading(true)
    carregarTudo().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async (payload) => {
    const result = await onRegistrarCompra(payload)
    if (result.ok) {
      await carregarTudo()
    }
    return result
  }

  const handleRegistrarMovimento = async (payload) => {
    const result = await onRegistrarMovimentoAvulso(payload)
    if (result.ok) {
      await carregarTudo()
    }
    return result
  }

  const handleEditarIngrediente = async (ingredienteId, payload) => {
    const result = await onEditarIngrediente(ingredienteId, payload)
    if (result.ok) {
      await carregarTudo()
    }
    return result
  }

  if (loading) {
    return <div className="empty">Carregando...</div>
  }

  return (
    <>
      <section className="cards">
        {resumo.kpis.map((item, index) => (
          <div className="card metric fade-in" style={{ '--i': index }} key={item.id}>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            <div className={`metric-icon badge-${item.tone}`}>{item.label.slice(0, 2).toUpperCase()}</div>
          </div>
        ))}
      </section>

      <section className="page-grid page-grid-2-1">
        <div className="page-stack">
          <article className="card section-card fade-in" style={{ '--i': 4 }}>
            <div className="section-head">
              <div>
                <h2>Receita, custo e lucro por mes</h2>
                <p>Receita vem dos pedidos pagos, custo vem das compras registradas.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => setIsModalOpen(true)}>
                Registrar compra
              </button>
            </div>
            <MonthlyBarChart
              data={resumo.meses}
              series={[
                { key: 'receita', label: 'Receita', color: 'var(--success)' },
                { key: 'custoCompras', label: 'Custo de compras', color: 'var(--danger)' },
                { key: 'lucro', label: 'Lucro', color: 'var(--info)' },
              ]}
            />
          </article>

          <article className="card section-card fade-in" style={{ '--i': 5 }}>
            <div className="section-head">
              <div>
                <h2>Historico de compras</h2>
                <p>Registros mais recentes primeiro.</p>
              </div>
            </div>
            <div className="data-table">
              <div className="data-row row-head" style={{ gridTemplateColumns: '1fr 1.4fr 0.8fr 0.6fr' }}>
                <span>Data</span>
                <span>Fornecedor / descricao</span>
                <span>Itens</span>
                <span>Total</span>
              </div>
              {compras.length === 0 && (
                <p style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Nenhuma compra registrada ainda.</p>
              )}
              {compras.map((compra) => (
                <div className="data-row" key={compra.id} style={{ gridTemplateColumns: '1fr 1.4fr 0.8fr 0.6fr' }}>
                  <span>{compra.data ? compra.data.slice(0, 10).split('-').reverse().join('/') : '-'}</span>
                  <span>{compra.fornecedor || compra.descricao || 'Sem descricao'}</span>
                  <span>{compra.itens.length} item(ns)</span>
                  <strong>{formatMoney(compra.total)}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="page-stack">
          <article className="card section-card fade-in" style={{ '--i': 6 }}>
            <div className="section-head">
              <div>
                <h2>Ingredientes em estoque</h2>
                <p>Saldo atual, atualizado automaticamente nas compras e nas vendas.</p>
              </div>
              <button className="btn btn-light" type="button" onClick={() => setIsMovimentoModalOpen(true)}>
                Movimento avulso
              </button>
            </div>
            <div className="data-table">
              {ingredientes.map((ing) => (
                <div className="data-row" key={ing.id} style={{ gridTemplateColumns: '1fr 0.6fr 0.5fr auto' }}>
                  <strong>{ing.name}</strong>
                  <span>{ing.qtdAtual} {ing.unit}</span>
                  <span className={`badge ${ing.isLow ? 'badge-red' : 'badge-green'}`}>
                    {ing.isLow ? 'Baixo' : 'OK'}
                  </span>
                  <button className="btn btn-light" type="button" onClick={() => setIngredienteEditar(ing)}>
                    Editar
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="card section-card fade-in" style={{ '--i': 7 }}>
            <div className="section-head">
              <div>
                <h2>Mais comprados</h2>
                <p>Ultimos meses, por valor gasto.</p>
              </div>
            </div>
            <div className="data-table">
              {resumo.topIngredientesComprados.length === 0 && (
                <p style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Sem compras no periodo.</p>
              )}
              {resumo.topIngredientesComprados.map((item) => (
                <div className="data-row" key={item.nome} style={{ gridTemplateColumns: '1fr 0.5fr 0.6fr' }}>
                  <strong>{item.nome}</strong>
                  <span>{item.qtde} {item.unidade}</span>
                  <span>{item.total}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      {isModalOpen && (
        <RegistrarCompraModal
          ingredientes={ingredientes}
          onCreate={handleCreate}
          onCriarIngrediente={onCriarIngrediente}
          onIngredienteCriado={(ingrediente) => setIngredientes((prev) => [...prev, ingrediente])}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {isMovimentoModalOpen && (
        <MovimentoAvulsoModal
          ingredientes={ingredientes}
          onRegistrar={handleRegistrarMovimento}
          onClose={() => setIsMovimentoModalOpen(false)}
        />
      )}

      {ingredienteEditar && (
        <EditarIngredienteModal
          ingrediente={ingredienteEditar}
          onEditar={handleEditarIngrediente}
          onClose={() => setIngredienteEditar(null)}
        />
      )}
    </>
  )
}
