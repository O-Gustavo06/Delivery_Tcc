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
  { value: 'SAIDA', label: 'Saída (consumo/perda)' },
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
            <p>Consumo manual, quebra, perda ou correção não ligada a um pedido.</p>
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

const STATUS_PREVISAO = {
  ESGOTADO: { label: 'Esgotado', className: 'badge-red' },
  RISCO_RUPTURA: { label: 'Risco de ruptura', className: 'badge-red' },
  ESTOQUE_BAIXO: { label: 'Estoque baixo', className: 'badge-sun' },
  DADOS_INSUFICIENTES: { label: 'Dados insuficientes', className: 'badge-sun' },
  ESTAVEL: { label: 'Estável', className: 'badge-green' },
}

const formatQuantidade = (value, fractionDigits = 3) =>
  Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: fractionDigits })

const formatarData = (value) => (value ? value.split('-').reverse().join('/') : '—')

function PrevisaoEstoqueTab({ onFetchPrevisaoEstoque }) {
  const [periodoDias, setPeriodoDias] = useState(30)
  const [prazoCompraDias, setPrazoCompraDias] = useState(7)
  const [versaoAtualizacao, setVersaoAtualizacao] = useState(0)
  const [previsao, setPrevisao] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativa = true
    setCarregando(true)
    setErro('')

    onFetchPrevisaoEstoque(periodoDias, prazoCompraDias)
      .then((resultado) => {
        if (!ativa) return
        if (!resultado?.ok) {
          setPrevisao(null)
          setErro(resultado?.message || 'Não foi possível carregar a previsão de estoque.')
          return
        }
        setPrevisao(resultado.data)
      })
      .catch((error) => {
        if (ativa) setErro(error instanceof Error ? error.message : 'Falha ao carregar a previsão de estoque.')
      })
      .finally(() => {
        if (ativa) setCarregando(false)
      })

    return () => {
      ativa = false
    }
  }, [onFetchPrevisaoEstoque, periodoDias, prazoCompraDias, versaoAtualizacao])

  const itens = previsao?.data ?? []
  const emRisco = itens.filter((item) => ['ESGOTADO', 'RISCO_RUPTURA'].includes(item.status)).length
  const estoqueBaixo = itens.filter((item) => item.isLow && item.status !== 'ESGOTADO').length
  const semDados = itens.filter((item) => !item.dadosSuficientes).length

  return (
    <div className="page-stack">
      <section className="cards">
        <div className="card metric">
          <div><span>Itens em risco de ruptura</span><strong>{emRisco}</strong></div>
          <div className="metric-icon badge-red">RI</div>
        </div>
        <div className="card metric">
          <div><span>Estoque baixo</span><strong>{estoqueBaixo}</strong></div>
          <div className="metric-icon badge-sun">BX</div>
        </div>
        <div className="card metric">
          <div><span>Sem histórico suficiente</span><strong>{semDados}</strong></div>
          <div className="metric-icon badge-blue">DA</div>
        </div>
      </section>

      <article className="card section-card">
        <div className="section-head">
          <div>
            <h2>Previsão de Estoque</h2>
            <p>
              Projeção baseada nas saídas reais; pedidos cancelados e ajustes não são tratados como consumo.
              São necessários 3 dias de consumo distintos em um intervalo de 7 dias, com consumo nos últimos 30 dias.
              A média mensal considera 30 dias.
            </p>
          </div>
          <div className="forecast-controls">
            <label>
              Histórico
              <select value={periodoDias} onChange={(event) => setPeriodoDias(Number(event.target.value))}>
                {[30, 60, 90].map((dias) => <option key={dias} value={dias}>{dias} dias</option>)}
              </select>
            </label>
            <label>
              Antecedência de compra
              <select value={prazoCompraDias} onChange={(event) => setPrazoCompraDias(Number(event.target.value))}>
                {[0, 3, 7, 14, 30].map((dias) => <option key={dias} value={dias}>{dias} dias</option>)}
              </select>
            </label>
            <button
              className="btn btn-light"
              type="button"
              onClick={() => setVersaoAtualizacao((versao) => versao + 1)}
              disabled={carregando}
            >
              Atualizar
            </button>
          </div>
        </div>

        {erro && <div className="login-error" role="alert">{erro}</div>}
        {carregando ? (
          <div className="empty" role="status">Calculando previsão...</div>
        ) : (
          <div className="data-table">
            <div
              className="data-row row-head forecast-grid"
              style={{ gridTemplateColumns: '1.2fr 0.7fr 0.7fr 0.7fr 0.7fr 0.9fr 1fr 1fr' }}
            >
              <span>Ingrediente</span>
              <span>Estoque atual</span>
              <span>Média / dia</span>
              <span>Média / mês</span>
              <span>Acaba em</span>
              <span>Ruptura estimada</span>
              <span>Comprar até</span>
              <span>Situação</span>
            </div>
            {itens.length === 0 && !erro && (
              <p className="empty">Nenhum ingrediente cadastrado para prever.</p>
            )}
            {itens.map((item) => {
              const status = STATUS_PREVISAO[item.status] ?? STATUS_PREVISAO.DADOS_INSUFICIENTES
              return (
                <div
                  className="data-row forecast-grid"
                  key={item.id}
                  style={{
                    gridTemplateColumns: '1.2fr 0.7fr 0.7fr 0.7fr 0.7fr 0.9fr 1fr 1fr',
                    borderLeft: item.status === 'RISCO_RUPTURA' || item.status === 'ESGOTADO'
                      ? '4px solid var(--danger)'
                      : item.isLow
                        ? '4px solid var(--warning)'
                        : undefined,
                  }}
                >
                  <strong data-label="Ingrediente">{item.name}</strong>
                  <span data-label="Estoque atual">{formatQuantidade(item.qtdAtual)} {item.unit}</span>
                  <span data-label="Média / dia">{item.mediaDiaria === null ? '—' : `${formatQuantidade(item.mediaDiaria, 4)} ${item.unit}`}</span>
                  <span data-label="Média / mês">{item.mediaMensal === null ? '—' : `${formatQuantidade(item.mediaMensal)} ${item.unit}`}</span>
                  <span data-label="Acaba em">{item.diasAteEsgotar === null ? '—' : `${item.diasAteEsgotar} dia(s)`}</span>
                  <span data-label="Ruptura estimada">{formatarData(item.dataPrevistaRuptura)}</span>
                  <span data-label="Comprar até">{item.dataCompraRecomendada ? formatarData(item.dataCompraRecomendada) : '—'}</span>
                  <span data-label="Situação" className={`badge ${status.className}`}>
                    {item.isLow && !item.dadosSuficientes && item.status !== 'ESGOTADO'
                      ? 'Baixo · sem previsão'
                      : status.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        {previsao && (
          <p className="forecast-footnote">
            Média calculada sobre os últimos {previsao.periodoDias} dias. A recomendação de compra considera
            {` ${previsao.prazoCompraDias} dia(s) `}de antecedência; sem histórico suficiente, a previsão é omitida.
          </p>
        )}
      </article>
    </div>
  )
}

function CategoriasProdutosTab({ onFetchCategorias, onCriarCategoria, onAtualizarCategoria }) {
  const [categorias, setCategorias] = useState([])
  const [nome, setNome] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [erroLista, setErroLista] = useState('')
  const [listaCarregada, setListaCarregada] = useState(false)
  const [aviso, setAviso] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [categoriaEditando, setCategoriaEditando] = useState(null)
  const [nomeEditado, setNomeEditado] = useState('')

  useEffect(() => {
    let ativa = true
    setCarregando(true)
    setErroLista('')
    onFetchCategorias()
      .then((resultado) => {
        if (!ativa) return
        if (!Array.isArray(resultado?.data)) {
          setListaCarregada(false)
          setErroLista('Não foi possível carregar as categorias. Verifique a conexão e tente novamente.')
          return
        }
        setCategorias(resultado.data)
        setListaCarregada(true)
      })
      .catch(() => {
        if (ativa) {
          setListaCarregada(false)
          setErroLista('Não foi possível carregar as categorias. Verifique a conexão e tente novamente.')
        }
      })
      .finally(() => { if (ativa) setCarregando(false) })
    return () => { ativa = false }
  }, [onFetchCategorias, tentativa])

  const cadastrar = async (event) => {
    event.preventDefault()
    const nomeLimpo = nome.trim()
    setErro('')
    setAviso('')
    if (!nomeLimpo) {
      setErro('Informe o nome da categoria.')
      return
    }
    setSalvando(true)
    try {
      const resultado = await onCriarCategoria(nomeLimpo)
      if (!resultado.ok) {
        setErro(resultado.message)
        return
      }
      if (listaCarregada && resultado.categoria?.id && resultado.categoria?.nome) {
        setCategorias((anteriores) => [...anteriores, resultado.categoria])
      } else {
        setTentativa((valor) => valor + 1)
      }
      setNome('')
      setAviso('Categoria cadastrada. Ela já pode ser usada no cardápio.')
    } catch (error) {
      setErro(`Não foi possível cadastrar a categoria: ${error.message}`)
    } finally {
      setSalvando(false)
    }
  }

  const editar = async (event) => {
    event.preventDefault()
    const nomeLimpo = nomeEditado.trim()
    setErro('')
    setAviso('')
    if (!nomeLimpo) {
      setErro('Informe o nome da categoria.')
      return
    }
    setSalvando(true)
    try {
      const resultado = await onAtualizarCategoria(categoriaEditando, nomeLimpo)
      if (!resultado.ok) {
        setErro(resultado.message)
        return
      }
      if (resultado.categoria?.id === categoriaEditando && resultado.categoria?.nome) {
        setCategorias((anteriores) => anteriores.map((categoria) => categoria.id === categoriaEditando ? resultado.categoria : categoria))
      } else {
        setTentativa((valor) => valor + 1)
      }
      setCategoriaEditando(null)
      setNomeEditado('')
      setAviso('Categoria alterada. O novo nome também será exibido no cardápio.')
    } catch (error) {
      setErro(`Não foi possível alterar a categoria: ${error.message}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <article className="card section-card">
      <div className="section-head">
        <div>
          <h2>Categorias de produtos</h2>
          <p>Organize os produtos vendidos no cardápio, como lanches, bolos, salgados, doces e bebidas. Estas categorias não alteram o estoque de ingredientes.</p>
        </div>
      </div>
      {erro && <div className="login-error" role="alert">{erro}</div>}
      {erroLista && <div className="login-error" role="alert">{erroLista} <button className="btn btn-light" type="button" onClick={() => setTentativa((valor) => valor + 1)}>Tentar carregar novamente</button></div>}
      {aviso && <p role="status">{aviso}</p>}
      {carregando ? <p role="status">Carregando categorias...</p> : (
        <>
          <form onSubmit={cadastrar} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
            <label className="filter-group" style={{ flex: '1 1 220px' }}>Nome da categoria
              <input value={nome} onChange={(event) => setNome(event.target.value)} maxLength={100} placeholder="Ex.: Lanches" required />
            </label>
            <button type="submit" className="btn btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Cadastrar categoria'}</button>
          </form>
          <h3>Categorias cadastradas</h3>
          {listaCarregada && categorias.length === 0 && <p>Nenhuma categoria cadastrada.</p>}
          {listaCarregada && categorias.map((categoria) => (
            <div className="item-row" key={categoria.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              {categoriaEditando === categoria.id ? (
                <form onSubmit={editar} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', flex: '1 1 220px' }}>
                  <label className="filter-group" style={{ flex: '1 1 220px' }}>Editar nome da categoria
                    <input value={nomeEditado} onChange={(event) => setNomeEditado(event.target.value)} maxLength={100} required />
                  </label>
                  <button type="submit" className="btn btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
                  <button type="button" className="btn btn-light" disabled={salvando} onClick={() => { setCategoriaEditando(null); setErro('') }}>Cancelar</button>
                </form>
              ) : (
                <>
                  <strong style={{ flex: '1 1 150px' }}>{categoria.nome}</strong>
                  <span className={`badge ${categoria.ativa ? 'badge-green' : 'badge-muted'}`}>{categoria.ativa ? 'Ativa' : 'Inativa'}</span>
                  <button type="button" className="btn btn-light" disabled={salvando} aria-label={`Editar categoria ${categoria.nome}`} onClick={() => { setCategoriaEditando(categoria.id); setNomeEditado(categoria.nome); setErro(''); setAviso('') }}>Editar</button>
                </>
              )}
            </div>
          ))}
        </>
      )}
    </article>
  )
}

export default function Compras({
  initialTab = 'compras',
  onFetchIngredientes,
  onFetchPrevisaoEstoque,
  onFetchCompras,
  onFetchResumoFinanceiro,
  onRegistrarCompra,
  onCriarIngrediente,
  onEditarIngrediente,
  onRegistrarMovimentoAvulso,
  onFetchCategorias,
  onCriarCategoria,
  onAtualizarCategoria,
}) {
  const [aba, setAba] = useState(initialTab)
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
      <div className="inventory-tabs" role="tablist" aria-label="Seções do armazém">
        {[
          { id: 'armazem', label: 'Armazém' },
          { id: 'previsao', label: 'Previsão de Estoque' },
          { id: 'compras', label: 'Compras e Lucros' },
          { id: 'categorias', label: 'Categorias de produtos' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`btn ${aba === tab.id ? 'btn-primary' : 'btn-light'}`}
            type="button"
            role="tab"
            aria-selected={aba === tab.id}
            onClick={() => setAba(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {aba === 'armazem' && (
        <div className="page-stack">
          <section className="cards">
            <div className="card metric">
              <div><span>Itens cadastrados</span><strong>{ingredientes.length}</strong></div>
              <div className="metric-icon badge-blue">IT</div>
            </div>
            <div className="card metric">
              <div><span>Estoque baixo</span><strong>{ingredientes.filter((item) => item.isLow).length}</strong></div>
              <div className="metric-icon badge-sun">BX</div>
            </div>
          </section>

          <article className="card section-card">
            <div className="section-head">
              <div>
                <h2>Estoque atual</h2>
                <p>Entradas por compras, baixas por pedidos e ajustes ficam registrados no histórico.</p>
              </div>
              <div className="inventory-actions">
                <button className="btn btn-primary" type="button" onClick={() => setIsModalOpen(true)}>
                  Entrada por compra
                </button>
                <button className="btn btn-light" type="button" onClick={() => setIsMovimentoModalOpen(true)}>
                  Saída / ajuste
                </button>
              </div>
            </div>
            <div className="data-table warehouse-table">
              <div className="data-row warehouse-row row-head" style={{ gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.7fr auto' }}>
                <span>Ingrediente</span>
                <span>Unidade</span>
                <span>Quantidade atual</span>
                <span>Situação</span>
                <span>Ação</span>
              </div>
              {ingredientes.length === 0 && (
                <p className="empty">Nenhum ingrediente cadastrado. Registre uma compra e cadastre o primeiro item.</p>
              )}
              {ingredientes.map((ing) => (
                <div className="data-row warehouse-row" key={ing.id} style={{ gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.7fr auto' }}>
                  <strong>{ing.name}</strong>
                  <span>{ing.unit}</span>
                  <span>{formatQuantidade(ing.qtdAtual)} {ing.unit}</span>
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
        </div>
      )}

      {aba === 'previsao' && <PrevisaoEstoqueTab onFetchPrevisaoEstoque={onFetchPrevisaoEstoque} />}

      {aba === 'categorias' && <CategoriasProdutosTab onFetchCategorias={onFetchCategorias} onCriarCategoria={onCriarCategoria} onAtualizarCategoria={onAtualizarCategoria} />}

      {aba === 'compras' && (
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
                    <h2>Receita, custo e lucro por mês</h2>
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
                    <h2>Histórico de compras</h2>
                    <p>Registros mais recentes primeiro.</p>
                  </div>
                </div>
                <div className="data-table">
                  <div className="data-row row-head" style={{ gridTemplateColumns: '1fr 1.4fr 0.8fr 0.6fr' }}>
                    <span>Data</span>
                    <span>Fornecedor / descrição</span>
                    <span>Itens</span>
                    <span>Total</span>
                  </div>
                  {compras.length === 0 && (
                    <p className="empty">Nenhuma compra registrada ainda.</p>
                  )}
                  {compras.map((compra) => (
                    <div className="data-row" key={compra.id} style={{ gridTemplateColumns: '1fr 1.4fr 0.8fr 0.6fr' }}>
                      <span>{compra.data ? compra.data.slice(0, 10).split('-').reverse().join('/') : '-'}</span>
                      <span>{compra.fornecedor || compra.descricao || 'Sem descrição'}</span>
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
                    <h2>Mais comprados</h2>
                    <p>Últimos meses, por valor gasto.</p>
                  </div>
                </div>
                <div className="data-table">
                  {resumo.topIngredientesComprados.length === 0 && (
                    <p className="empty">Sem compras no período.</p>
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
        </>
      )}

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
