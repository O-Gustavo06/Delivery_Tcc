import React, { useCallback, useEffect, useMemo, useState } from 'react'
import './Promocoes.css'

const dataHoraLocalEm = (data) => {
  const local = new Date(data)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 16)
}

const prazoPadrao = () => {
  const data = new Date()
  data.setDate(data.getDate() + 30)
  return dataHoraLocalEm(data)
}

const formatarData = (valor) => valor
  ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : 'Sem prazo'

const novoFormulario = () => ({
  tipo: 'produto',
  nome: '',
  codigo: '',
  tipo_desconto: 'percentual',
  valor_desconto: '',
  dt_fim: prazoPadrao(),
  produtos: [],
  categorias: [],
  ativa: true,
})

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Promocoes({ onFetchPromocoes, onFetchProdutos, onFetchCategorias, onSalvarPromocao }) {
  const [promocoes, setPromocoes] = useState([])
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [formulario, setFormulario] = useState(novoFormulario)
  const [promocaoEditando, setPromocaoEditando] = useState(null)
  const [buscaProdutos, setBuscaProdutos] = useState('')
  const [buscaCategorias, setBuscaCategorias] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    const results = await Promise.allSettled([
      onFetchPromocoes(),
      onFetchProdutos(),
      onFetchCategorias(),
    ])
    const errors = []
    const [promocoesResult, produtosResult, categoriasResult] = results.map((result) =>
      result.status === 'fulfilled' ? result.value : null)

    if (promocoesResult?.ok && Array.isArray(promocoesResult.data)) {
      setPromocoes(promocoesResult.data)
    } else {
      errors.push(promocoesResult?.message || 'Não foi possível carregar as promoções.')
    }
    if (Array.isArray(produtosResult?.data)) {
      setProdutos(produtosResult.data)
    } else {
      errors.push('Não foi possível carregar os produtos. Verifique a conexão e tente novamente.')
    }
    if (Array.isArray(categoriasResult?.data)) {
      setCategorias(categoriasResult.data)
    } else {
      errors.push('Não foi possível carregar as categorias. Verifique a conexão e tente novamente.')
    }
    results.forEach((result) => {
      if (result.status === 'rejected' && result.reason?.message) errors.push(result.reason.message)
    })
    setErro(errors.join(' '))
    setCarregando(false)
  }, [onFetchPromocoes, onFetchProdutos, onFetchCategorias])

  useEffect(() => {
    carregar()
  }, [carregar])

  const produtosFiltrados = useMemo(() => produtos.filter((produto) =>
    produto.nome.toLowerCase().includes(buscaProdutos.toLowerCase())), [produtos, buscaProdutos])
  const categoriasFiltradas = useMemo(() => categorias.filter((categoria) =>
    categoria.nome.toLowerCase().includes(buscaCategorias.toLowerCase())), [categorias, buscaCategorias])
  const listaVisivel = filtroTipo === 'todos'
    ? promocoes
    : promocoes.filter((promocao) => promocao.tipo === filtroTipo)

  const atualizarCampo = (campo, valor) => {
    setFormulario((atual) => ({ ...atual, [campo]: valor }))
  }

  const alternarSelecao = (campo, id) => {
    setFormulario((atual) => {
      const selecionados = new Set(atual[campo])
      if (selecionados.has(id)) selecionados.delete(id)
      else selecionados.add(id)
      return { ...atual, [campo]: [...selecionados] }
    })
  }

  const selecionarVisiveis = (campo, ids) => {
    setFormulario((atual) => {
      const selecionados = new Set(atual[campo])
      const todosSelecionados = ids.length > 0 && ids.every((id) => selecionados.has(id))
      ids.forEach((id) => todosSelecionados ? selecionados.delete(id) : selecionados.add(id))
      return { ...atual, [campo]: [...selecionados] }
    })
  }

  const iniciarNova = () => {
    setFormulario(novoFormulario())
    setPromocaoEditando(null)
    setBuscaProdutos('')
    setBuscaCategorias('')
    setErro('')
    setSucesso('')
  }

  const editar = (promocao) => {
    setFormulario({
      tipo: promocao.tipo,
      nome: promocao.nome,
      codigo: promocao.codigo || '',
      tipo_desconto: promocao.tipo_desconto,
      valor_desconto: String(promocao.valor_desconto),
      dt_fim: promocao.dt_fim && new Date(promocao.dt_fim) > new Date()
        ? dataHoraLocalEm(promocao.dt_fim)
        : prazoPadrao(),
      produtos: promocao.produtos.map((produto) => produto.id),
      categorias: promocao.categorias.map((categoria) => categoria.id),
      ativa: promocao.ativa,
    })
    setPromocaoEditando(promocao)
    setBuscaProdutos('')
    setBuscaCategorias('')
    setErro('')
    setSucesso('')
    document.querySelector('.promo-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const salvar = async (event) => {
    event.preventDefault()
    setErro('')
    setSucesso('')
    if (!formulario.produtos.length && !formulario.categorias.length) {
      setErro('Selecione pelo menos um produto ou uma categoria.')
      return
    }
    setSalvando(true)
    const payload = {
      ...formulario,
      codigo: formulario.tipo === 'cupom' ? formulario.codigo.trim().toUpperCase() : null,
      valor_desconto: Number(formulario.valor_desconto),
      dt_fim: new Date(formulario.dt_fim).toISOString(),
    }
    try {
      const result = await onSalvarPromocao(promocaoEditando?.id, payload)
      if (!result?.ok) {
        setErro(result?.message || 'Não foi possível salvar a promoção.')
        return
      }
      if (!result.data) {
        setErro('A API confirmou a operação, mas não retornou os dados da promoção para atualizar a lista.')
        return
      }
      setPromocoes((atuais) => promocaoEditando
        ? atuais.map((item) => item.id === result.data.id ? result.data : item)
        : [result.data, ...atuais])
      iniciarNova()
      setSucesso(promocaoEditando ? 'Alterações salvas.' : 'Promoção criada.')
    } catch (error) {
      setErro(error.message || 'Não foi possível salvar a promoção.')
    } finally {
      setSalvando(false)
    }
  }

  const alternarAtiva = async (promocao) => {
    setErro('')
    setSucesso('')
    try {
      const result = await onSalvarPromocao(promocao.id, { ativa: !promocao.ativa })
      if (!result?.ok) {
        setErro(result?.message || 'Não foi possível alterar o status.')
        return
      }
      setSucesso(promocao.ativa ? 'Promoção desativada.' : 'Promoção ativada.')
      await carregar()
    } catch (error) {
      setErro(error.message || 'Não foi possível alterar o status.')
    }
  }

  const todosProdutosVisiveisSelecionados = produtosFiltrados.length > 0
    && produtosFiltrados.every((produto) => formulario.produtos.includes(produto.id))
  const todasCategoriasVisiveisSelecionadas = categoriasFiltradas.length > 0
    && categoriasFiltradas.every((categoria) => formulario.categorias.includes(categoria.id))

  return (
    <div className="promo-page">
      <header className="promo-page-header">
        <div>
          <span className="promo-eyebrow">Marketing e vendas</span>
          <h1>Promoções e cupons</h1>
          <p>Crie descontos para os produtos que você escolher e defina por quanto tempo ficam ativos.</p>
        </div>
      </header>

      {(erro || sucesso) && (
        <div className={`promo-alert ${erro ? 'promo-alert-error' : 'promo-alert-success'}`} role="status">
          {erro || sucesso}
          {erro && <button type="button" onClick={carregar}>Tentar novamente</button>}
        </div>
      )}

      <section className="promo-form-card">
        <div className="promo-section-heading">
          <div>
            <h2>{promocaoEditando ? 'Editar campanha' : 'Criar promoção ou cupom'}</h2>
            <p>Escolha o desconto, o prazo e os itens participantes.</p>
          </div>
          {promocaoEditando && <button type="button" className="btn btn-light" onClick={iniciarNova}>Cancelar edição</button>}
        </div>

        <form onSubmit={salvar}>
          <div className="promo-form-grid">
            <label className="promo-field">
              <span>Tipo</span>
              <select value={formulario.tipo} onChange={(event) => atualizarCampo('tipo', event.target.value)}>
                <option value="produto">Desconto direto nos produtos</option>
                <option value="cupom">Cupom para o cliente aplicar</option>
              </select>
            </label>
            <label className="promo-field">
              <span>Nome</span>
              <input value={formulario.nome} onChange={(event) => atualizarCampo('nome', event.target.value)} maxLength={120} required placeholder="Ex.: Oferta de fim de semana" />
            </label>
            {formulario.tipo === 'cupom' && (
              <label className="promo-field">
                <span>Código do cupom</span>
                <input value={formulario.codigo} onChange={(event) => atualizarCampo('codigo', event.target.value.toUpperCase().replace(/\s/g, ''))} maxLength={50} required placeholder="EX: BEMVINDO10" />
              </label>
            )}
            <label className="promo-field">
              <span>Tipo de desconto</span>
              <select value={formulario.tipo_desconto} onChange={(event) => atualizarCampo('tipo_desconto', event.target.value)}>
                <option value="percentual">Porcentagem (%)</option>
                <option value="fixo">Valor fixo (R$)</option>
              </select>
            </label>
            <label className="promo-field">
              <span>Valor do desconto{formulario.tipo_desconto === 'percentual' ? ' (%)' : ' (R$)'}</span>
              <input type="number" min="0.01" max={formulario.tipo_desconto === 'percentual' ? 100 : 1000000} step="0.01" value={formulario.valor_desconto} onChange={(event) => atualizarCampo('valor_desconto', event.target.value)} required />
            </label>
            <label className="promo-field">
              <span>Desconto válido até</span>
              <input
                type="datetime-local"
                value={formulario.dt_fim}
                min={dataHoraLocalEm(new Date())}
                onChange={(event) => atualizarCampo('dt_fim', event.target.value)}
                required
              />
            </label>
          </div>

          <div className="promo-targets">
            <div className="promo-section-heading">
              <div>
                <h2>Produtos e categorias contemplados</h2>
              </div>
              <span className="promo-selection-count">{formulario.produtos.length} produtos · {formulario.categorias.length} categorias</span>
            </div>
            <div className="promo-selection-grid">
              <section className="promo-picker">
                <div className="promo-picker-heading">
                  <div><strong>Produtos <small className="promo-item-count">({produtos.length} disponíveis)</small></strong><small>Selecione um ou vários itens</small></div>
                  <button type="button" className="promo-text-button" onClick={() => selecionarVisiveis('produtos', produtosFiltrados.map((item) => item.id))}>
                    {todosProdutosVisiveisSelecionados ? 'Desmarcar visíveis' : 'Selecionar visíveis'}
                  </button>
                </div>
                <input aria-label="Buscar produtos" placeholder="Buscar produto..." value={buscaProdutos} onChange={(event) => setBuscaProdutos(event.target.value)} />
                <div className="promo-check-list">
                  {produtosFiltrados.map((produto) => (
                    <label key={produto.id} className="promo-check-row">
                      <input type="checkbox" checked={formulario.produtos.includes(produto.id)} onChange={() => alternarSelecao('produtos', produto.id)} />
                      <span><strong>{produto.nome}</strong><small>{formatarMoeda(produto.preco)}</small></span>
                    </label>
                  ))}
                  {produtosFiltrados.length === 0 && (
                    <p className="promo-empty">
                      {buscaProdutos
                        ? `Nenhum produto corresponde a “${buscaProdutos}”.`
                        : 'Nenhum produto cadastrado.'}
                    </p>
                  )}
                </div>
              </section>

              <section className="promo-picker">
                <div className="promo-picker-heading">
                  <div><strong>Categorias <small className="promo-item-count">({categorias.length} disponíveis)</small></strong><small>Todos os produtos da categoria</small></div>
                  <button type="button" className="promo-text-button" onClick={() => selecionarVisiveis('categorias', categoriasFiltradas.map((item) => item.id))}>
                    {todasCategoriasVisiveisSelecionadas ? 'Desmarcar visíveis' : 'Selecionar visíveis'}
                  </button>
                </div>
                <input aria-label="Buscar categorias" placeholder="Buscar categoria..." value={buscaCategorias} onChange={(event) => setBuscaCategorias(event.target.value)} />
                <div className="promo-check-list">
                  {categoriasFiltradas.map((categoria) => (
                    <label key={categoria.id} className="promo-check-row">
                      <input type="checkbox" checked={formulario.categorias.includes(categoria.id)} onChange={() => alternarSelecao('categorias', categoria.id)} />
                      <span><strong>{categoria.nome}</strong><small>Categoria inteira</small></span>
                    </label>
                  ))}
                  {categoriasFiltradas.length === 0 && (
                    <p className="promo-empty">
                      {buscaCategorias
                        ? `Nenhuma categoria corresponde a “${buscaCategorias}”.`
                        : 'Nenhuma categoria cadastrada.'}
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>

          <div className="promo-form-actions">
            <p>O desconto será encerrado automaticamente no prazo escolhido.</p>
            <button className="btn btn-primary" type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : promocaoEditando ? 'Salvar alterações' : 'Criar campanha'}
            </button>
          </div>
        </form>
      </section>

      <section className="promo-list-section">
        <div className="promo-section-heading">
          <div>
            <h2>Campanhas cadastradas</h2>
          </div>
          <select aria-label="Filtrar campanhas" value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value)}>
            <option value="todos">Todos os tipos</option>
            <option value="produto">Descontos diretos</option>
            <option value="cupom">Cupons</option>
          </select>
        </div>

        {carregando ? (
          <div className="promo-empty-state">Carregando campanhas...</div>
        ) : listaVisivel.length === 0 ? (
          <div className="promo-empty-state">
            <span className="promo-empty-icon">%</span>
            <strong>Nenhuma campanha por aqui ainda</strong>
            <p>Crie uma promoção para destacar seus produtos ou um cupom para seus clientes.</p>
          </div>
        ) : (
          <div className="promo-list">
            {listaVisivel.map((promocao) => (
              <article className="promo-list-card" key={promocao.id}>
                <div className="promo-card-main">
                  <div className="promo-card-title">
                    <span className={`promo-kind ${promocao.tipo === 'cupom' ? 'promo-kind-coupon' : ''}`}>
                      {promocao.tipo === 'cupom' ? 'Cupom' : 'Desconto'}
                    </span>
                    <span className={`promo-status promo-status-${promocao.status}`}>{promocao.status}</span>
                  </div>
                  <h3>{promocao.nome}</h3>
                  {promocao.codigo && <code className="promo-code">{promocao.codigo}</code>}
                  <p className="promo-card-discount">
                    {promocao.tipo_desconto === 'percentual'
                      ? `${promocao.valor_desconto}% de desconto`
                      : `${formatarMoeda(promocao.valor_desconto)} de desconto`}
                  </p>
                  <p className="promo-card-expiry">
                    <span>Válido até</span>
                    <strong>{formatarData(promocao.dt_fim)}</strong>
                  </p>
                  <div className="promo-tags">
                    {promocao.produtos.map((produto) => <span key={`p-${produto.id}`}>{produto.nome}</span>)}
                    {promocao.categorias.map((categoria) => <span key={`c-${categoria.id}`}>{categoria.nome} · categoria</span>)}
                  </div>
                </div>
                <div className="promo-card-actions">
                  <button type="button" className="btn btn-light" onClick={() => editar(promocao)}>Editar</button>
                  <button
                    type="button"
                    className={`promo-toggle ${promocao.ativa ? 'is-on' : ''}`}
                    onClick={() => promocao.status === 'expirada' ? editar(promocao) : alternarAtiva(promocao)}
                    aria-label={promocao.status === 'expirada' ? 'Atualizar prazo da campanha' : promocao.ativa ? 'Desativar campanha' : 'Ativar campanha'}
                  >
                    {promocao.status === 'expirada' ? 'Atualizar prazo' : promocao.ativa ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
