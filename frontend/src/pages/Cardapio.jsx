import React, { useEffect, useMemo, useState } from 'react'
import { resolveAssetUrl } from '../utils/apiBase'

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const emptyProduto = () => ({
  nome: '',
  descricao: '',
  preco: '',
  id_categoria: '',
  tempo_preparo_min: '15',
})

function NovoProdutoModal({ categorias, onCreate, onCreateCategoria, onClose }) {
  const [produto, setProduto] = useState(emptyProduto())
  const [novaCategoria, setNovaCategoria] = useState('')
  const [criandoCategoria, setCriandoCategoria] = useState(false)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [imagem, setImagem] = useState(null)
  const [imagemPreview, setImagemPreview] = useState('')

  const handleImagemChange = (event) => {
    const arquivo = event.target.files?.[0] || null
    setImagem(arquivo)
    setImagemPreview(arquivo ? URL.createObjectURL(arquivo) : '')
  }

  const handleCriarCategoria = async () => {
    if (!novaCategoria.trim()) return
    setError('')
    const result = await onCreateCategoria(novaCategoria.trim())
    if (!result.ok) {
      setError(result.message)
      return
    }
    setProduto((prev) => ({ ...prev, id_categoria: String(result.categoria.id) }))
    setNovaCategoria('')
    setCriandoCategoria(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!produto.nome.trim() || !produto.preco || !produto.id_categoria) {
      setError('Nome, preco e categoria sao obrigatorios.')
      return
    }

    setIsSaving(true)
    const result = await onCreate({
      nome: produto.nome.trim(),
      descricao: produto.descricao.trim() || undefined,
      preco: Number(produto.preco),
      id_categoria: Number(produto.id_categoria),
      tempo_preparo_min: produto.tempo_preparo_min ? Number(produto.tempo_preparo_min) : undefined,
      imagem: imagem || undefined,
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
            <h2>Novo item do cardapio</h2>
            <p>Aparece no cardapio publico assim que for criado.</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div className="filter-group">
            <label>Nome do produto</label>
            <input
              value={produto.nome}
              onChange={(event) => setProduto((prev) => ({ ...prev, nome: event.target.value }))}
              placeholder="Ex: X-Salada"
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="filter-group">
              <label>Preco</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={produto.preco}
                onChange={(event) => setProduto((prev) => ({ ...prev, preco: event.target.value }))}
                required
              />
            </div>
            <div className="filter-group">
              <label>Tempo de preparo (min)</label>
              <input
                type="number"
                min="0"
                value={produto.tempo_preparo_min}
                onChange={(event) => setProduto((prev) => ({ ...prev, tempo_preparo_min: event.target.value }))}
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Categoria</label>
            {!criandoCategoria ? (
              <select
                value={produto.id_categoria}
                onChange={(event) => setProduto((prev) => ({ ...prev, id_categoria: event.target.value }))}
                required
              >
                <option value="">Selecione...</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            ) : (
              <div className="item-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <input
                  value={novaCategoria}
                  onChange={(event) => setNovaCategoria(event.target.value)}
                  placeholder="Nome da categoria"
                  autoFocus
                />
                <button className="btn btn-primary" type="button" onClick={handleCriarCategoria}>
                  Criar
                </button>
                <button className="btn btn-light" type="button" onClick={() => setCriandoCategoria(false)}>
                  Cancelar
                </button>
              </div>
            )}
            {!criandoCategoria && (
              <button
                className="btn btn-light"
                type="button"
                style={{ marginTop: 8, justifySelf: 'start' }}
                onClick={() => setCriandoCategoria(true)}
              >
                + Nova categoria
              </button>
            )}
          </div>

          <div className="filter-group">
            <label>Descricao (opcional)</label>
            <textarea
              value={produto.descricao}
              onChange={(event) => setProduto((prev) => ({ ...prev, descricao: event.target.value }))}
              placeholder="Ingredientes, observacoes..."
              rows={3}
              style={{ resize: 'vertical', minHeight: 60 }}
            />
          </div>

          <div className="filter-group">
            <label>Foto do produto (opcional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {imagemPreview && (
                <img
                  src={imagemPreview}
                  alt="Previa do produto"
                  style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--line)' }}
                />
              )}
              <input type="file" accept="image/*" onChange={handleImagemChange} />
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Criando...' : 'Adicionar ao cardapio'}
          </button>
        </form>
      </div>
    </div>
  )
}

function EditarProdutoModal({ produto, categorias, onEditar, onClose }) {
  const [dados, setDados] = useState({
    nome: produto.nome,
    descricao: produto.descricao || '',
    preco: String(produto.preco),
    id_categoria: String(produto.categoria.id),
    tempo_preparo_min: produto.tempoPreparoMin != null ? String(produto.tempoPreparoMin) : '',
  })
  const [imagem, setImagem] = useState(null)
  const [imagemPreview, setImagemPreview] = useState(resolveAssetUrl(produto.urlImagem) || '')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleImagemChange = (event) => {
    const arquivo = event.target.files?.[0] || null
    setImagem(arquivo)
    setImagemPreview(arquivo ? URL.createObjectURL(arquivo) : resolveAssetUrl(produto.urlImagem) || '')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!dados.nome.trim() || !dados.preco || !dados.id_categoria) {
      setError('Nome, preco e categoria sao obrigatorios.')
      return
    }

    setIsSaving(true)
    const result = await onEditar(produto.id, {
      nome: dados.nome.trim(),
      descricao: dados.descricao.trim() || '',
      preco: Number(dados.preco),
      id_categoria: Number(dados.id_categoria),
      tempo_preparo_min: dados.tempo_preparo_min ? Number(dados.tempo_preparo_min) : undefined,
      imagem: imagem || undefined,
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
            <h2>Editar item</h2>
            <p>Altere os dados do produto no cardapio.</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div className="filter-group">
            <label>Nome do produto</label>
            <input
              value={dados.nome}
              onChange={(event) => setDados((prev) => ({ ...prev, nome: event.target.value }))}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="filter-group">
              <label>Preco</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={dados.preco}
                onChange={(event) => setDados((prev) => ({ ...prev, preco: event.target.value }))}
                required
              />
            </div>
            <div className="filter-group">
              <label>Tempo de preparo (min)</label>
              <input
                type="number"
                min="0"
                value={dados.tempo_preparo_min}
                onChange={(event) => setDados((prev) => ({ ...prev, tempo_preparo_min: event.target.value }))}
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Categoria</label>
            <select
              value={dados.id_categoria}
              onChange={(event) => setDados((prev) => ({ ...prev, id_categoria: event.target.value }))}
              required
            >
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Descricao (opcional)</label>
            <textarea
              value={dados.descricao}
              onChange={(event) => setDados((prev) => ({ ...prev, descricao: event.target.value }))}
              placeholder="Ingredientes, observacoes..."
              rows={3}
              style={{ resize: 'vertical', minHeight: 60 }}
            />
          </div>

          <div className="filter-group">
            <label>Foto do produto</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {imagemPreview && (
                <img
                  src={imagemPreview}
                  alt="Previa do produto"
                  style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--line)' }}
                />
              )}
              <input type="file" accept="image/*" onChange={handleImagemChange} />
            </div>
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

function ReceitaModal({ produto, ingredientes, onFetchReceita, onSalvarReceita, onClose }) {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [novoIngrediente, setNovoIngrediente] = useState('')
  const [novaQtde, setNovaQtde] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let ativo = true
    onFetchReceita(produto.id).then((result) => {
      if (ativo && result?.data) {
        setItens(result.data)
      }
      if (ativo) setLoading(false)
    })
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto.id])

  const disponiveis = useMemo(
    () => ingredientes.filter((ing) => !itens.some((item) => item.id_ingrediente === ing.id)),
    [ingredientes, itens],
  )

  const handleAdicionar = () => {
    if (!novoIngrediente || !novaQtde || Number(novaQtde) <= 0) return
    const ingrediente = ingredientes.find((ing) => ing.id === Number(novoIngrediente))
    if (!ingrediente) return

    setItens((prev) => [
      ...prev,
      {
        id_ingrediente: ingrediente.id,
        nome: ingrediente.name,
        unidade: ingrediente.unit,
        qtde: Number(novaQtde),
      },
    ])
    setNovoIngrediente('')
    setNovaQtde('')
  }

  const handleRemover = (idIngrediente) => {
    setItens((prev) => prev.filter((item) => item.id_ingrediente !== idIngrediente))
  }

  const handleSalvar = async () => {
    setError('')
    setIsSaving(true)
    const result = await onSalvarReceita(
      produto.id,
      itens.map((item) => ({ id_ingrediente: item.id_ingrediente, qtde: item.qtde })),
    )
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
            <h2>Receita de {produto.nome}</h2>
            <p>Ingredientes consumidos do estoque quando o pedido e confirmado.</p>
          </div>
          <button className="btn btn-light" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        {loading ? (
          <div className="empty">Carregando...</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {itens.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                Nenhum ingrediente vinculado ainda. Esse produto nao desconta estoque ao ser vendido.
              </p>
            )}

            {itens.length > 0 && (
              <div className="table-grid" style={{ gap: 8 }}>
                {itens.map((item) => (
                  <div
                    className="item-row"
                    key={item.id_ingrediente}
                    style={{ gridTemplateColumns: '1fr auto auto', alignItems: 'center' }}
                  >
                    <span>{item.nome}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                      {item.qtde} {item.unidade}
                    </span>
                    <button
                      className="btn btn-light"
                      type="button"
                      onClick={() => handleRemover(item.id_ingrediente)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="filter-group">
              <label>Adicionar ingrediente</label>
              <div className="item-row" style={{ gridTemplateColumns: '1fr 120px auto' }}>
                <select value={novoIngrediente} onChange={(event) => setNovoIngrediente(event.target.value)}>
                  <option value="">Selecione...</option>
                  {disponiveis.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Qtde"
                  value={novaQtde}
                  onChange={(event) => setNovaQtde(event.target.value)}
                />
                <button className="btn btn-primary" type="button" onClick={handleAdicionar}>
                  Adicionar
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button className="btn btn-primary" type="button" onClick={handleSalvar} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar receita'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ExcluirProdutoModal({ produto, onConfirmar, onClose }) {
  const [excluindo, setExcluindo] = useState(false)
  const [error, setError] = useState('')

  const handleExcluir = async () => {
    setError('')
    setExcluindo(true)
    const result = await onConfirmar(produto.id)
    setExcluindo(false)

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
            <h2>Excluir item</h2>
          </div>
        </div>

        <p>
          Esse item ({produto.nome}) será excluído do cardápio, tem certeza?
        </p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <div className="item-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button className="btn btn-light" type="button" onClick={onClose} disabled={excluindo}>
            Não
          </button>
          <button
            className="btn btn-primary"
            type="button"
            style={{ background: 'var(--danger)' }}
            onClick={handleExcluir}
            disabled={excluindo}
          >
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Cardapio({
  onFetchProdutos,
  onFetchCategorias,
  onCriarProduto,
  onCriarCategoria,
  onAtualizarProduto,
  onEditarProduto,
  onExcluirProduto,
  onFetchIngredientes,
  onFetchReceita,
  onSalvarReceita,
}) {
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [ingredientes, setIngredientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [produtoReceita, setProdutoReceita] = useState(null)
  const [produtoExcluir, setProdutoExcluir] = useState(null)
  const [produtoEditar, setProdutoEditar] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('all')

  const carregarTudo = async () => {
    const [produtosResp, categoriasResp, ingredientesResp] = await Promise.all([
      onFetchProdutos(),
      onFetchCategorias(),
      onFetchIngredientes(),
    ])
    if (produtosResp?.data) setProdutos(produtosResp.data)
    if (categoriasResp?.data) setCategorias(categoriasResp.data)
    if (ingredientesResp?.data) setIngredientes(ingredientesResp.data)
  }

  useEffect(() => {
    setLoading(true)
    carregarTudo().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateProduto = async (payload) => {
    const result = await onCriarProduto(payload)
    if (result.ok) {
      await carregarTudo()
    }
    return result
  }

  const handleCreateCategoria = async (nome) => {
    const result = await onCriarCategoria(nome)
    if (result.ok) {
      await carregarTudo()
    }
    return result
  }

  const handleToggleAtivo = async (produto) => {
    await onAtualizarProduto(produto.id, { ativo: !produto.ativo })
    await carregarTudo()
  }

  const handleExcluirProduto = async (produtoId) => {
    const result = await onExcluirProduto(produtoId)
    if (result.ok) {
      await carregarTudo()
    }
    return result
  }

  const handleEditarProduto = async (produtoId, payload) => {
    const result = await onEditarProduto(produtoId, payload)
    if (result.ok) {
      await carregarTudo()
    }
    return result
  }

  const filtrados = useMemo(
    () => (filtroCategoria === 'all' ? produtos : produtos.filter((p) => String(p.categoria.id) === filtroCategoria)),
    [produtos, filtroCategoria],
  )

  if (loading) {
    return <div className="empty">Carregando...</div>
  }

  return (
    <>
      <article className="card section-card fade-in" style={{ '--i': 0 }}>
        <div className="section-head">
          <div>
            <h2>Itens do cardapio</h2>
            <p>Produtos cadastrados aparecem automaticamente no cardapio publico e na mesa.</p>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => setIsModalOpen(true)}>
            Novo item
          </button>
        </div>

        <div className="status-tabs">
          <button
            className={`tab ${filtroCategoria === 'all' ? 'active' : ''}`}
            type="button"
            onClick={() => setFiltroCategoria('all')}
          >
            Todas ({produtos.length})
          </button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              className={`tab ${filtroCategoria === String(cat.id) ? 'active' : ''}`}
              type="button"
              onClick={() => setFiltroCategoria(String(cat.id))}
            >
              {cat.nome}
            </button>
          ))}
        </div>

        {filtrados.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Nenhum produto cadastrado ainda.</p>
        )}

        <div className="table-grid">
          {filtrados.map((produto) => (
            <div className="table-card" key={produto.id}>
              <button
                type="button"
                className="table-card-delete"
                onClick={() => setProdutoExcluir(produto)}
                aria-label={`Excluir ${produto.nome}`}
                title="Excluir item"
              >
                ×
              </button>
              {produto.urlImagem && (
                <img
                  src={resolveAssetUrl(produto.urlImagem)}
                  alt={produto.nome}
                  style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 12, marginBottom: 8 }}
                />
              )}
              <div className="table-card-head">
                <strong>{produto.nome}</strong>
                <span className={`badge ${produto.ativo ? 'badge-green' : 'badge-muted'}`}>
                  {produto.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p>{produto.categoria.nome}</p>
              {produto.descricao && <p>{produto.descricao}</p>}
              <div className="order-total" style={{ alignItems: 'flex-start', textAlign: 'left', borderTop: 'none', paddingTop: 0 }}>
                <strong>{formatMoney(produto.preco)}</strong>
              </div>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                <button
                  className="btn btn-light card-action-btn"
                  type="button"
                  style={{ width: '100%' }}
                  onClick={() => setProdutoEditar(produto)}
                >
                  Editar
                </button>
                <div className="item-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
                  <button
                    className="btn btn-light card-action-btn"
                    type="button"
                    style={{ width: '100%' }}
                    onClick={() => handleToggleAtivo(produto)}
                  >
                    {produto.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                  <button
                    className="btn btn-light card-action-btn"
                    type="button"
                    style={{ width: '100%' }}
                    onClick={() => setProdutoReceita(produto)}
                  >
                    Receita
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </article>

      {isModalOpen && (
        <NovoProdutoModal
          categorias={categorias}
          onCreate={handleCreateProduto}
          onCreateCategoria={handleCreateCategoria}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {produtoReceita && (
        <ReceitaModal
          produto={produtoReceita}
          ingredientes={ingredientes}
          onFetchReceita={onFetchReceita}
          onSalvarReceita={onSalvarReceita}
          onClose={() => setProdutoReceita(null)}
        />
      )}

      {produtoExcluir && (
        <ExcluirProdutoModal
          produto={produtoExcluir}
          onConfirmar={handleExcluirProduto}
          onClose={() => setProdutoExcluir(null)}
        />
      )}

      {produtoEditar && (
        <EditarProdutoModal
          produto={produtoEditar}
          categorias={categorias}
          onEditar={handleEditarProduto}
          onClose={() => setProdutoEditar(null)}
        />
      )}
    </>
  )
}
