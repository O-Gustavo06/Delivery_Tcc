import React, { useCallback, useEffect, useMemo, useState } from 'react'
import EnderecoPorCep from './EnderecoPorCep.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api`
const SESSION_KEY = 'pedido_online_sessao'
const DRAFT_KEY = 'pedido_online_dados'

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Mesmo tratamento visual da mesa (sem fotos reais cadastradas): icone + gradiente por produto.
const VISUAIS_PRODUTO = [
  { termos: ['pizza'], emoji: '🍕', gradiente: 'linear-gradient(135deg, #f2596a, #f2b53b)' },
  { termos: ['hamburguer', 'hambúrguer', 'burger', 'lanche', 'x-tudo', 'x-salada', 'x-burguer', 'xis', 'x-bacon'], emoji: '🍔', gradiente: 'linear-gradient(135deg, #d98a4f, #f2b53b)' },
  { termos: ['batata'], emoji: '🍟', gradiente: 'linear-gradient(135deg, #f2b53b, #e3d24a)' },
  { termos: ['suco'], emoji: '🧃', gradiente: 'linear-gradient(135deg, #2dd4a7, #b8dcff)' },
  { termos: ['refrigerante', 'lata', 'refri'], emoji: '🥤', gradiente: 'linear-gradient(135deg, #74b9ff, #b8dcff)' },
  { termos: ['frango'], emoji: '🍗', gradiente: 'linear-gradient(135deg, #e8b04b, #d98a4f)' },
  { termos: ['arroz'], emoji: '🍚', gradiente: 'linear-gradient(135deg, #b8dcff, #e3f2ff)' },
  { termos: ['salada', 'verde'], emoji: '🥗', gradiente: 'linear-gradient(135deg, #2dd4a7, #74b9ff)' },
  { termos: ['sobremesa', 'doce', 'sorvete', 'bolo'], emoji: '🍰', gradiente: 'linear-gradient(135deg, #f2596a, #b8dcff)' },
  { termos: ['agua', 'água'], emoji: '💧', gradiente: 'linear-gradient(135deg, #74b9ff, #e3f2ff)' },
]

function getVisualProduto(nome) {
  const alvo = (nome || '').toLowerCase()
  const encontrado = VISUAIS_PRODUTO.find((v) => v.termos.some((termo) => alvo.includes(termo)))
  return encontrado || { emoji: '🍽️', gradiente: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }
}

const STATUS_INFO = {
  aguardando_confirmacao: { titulo: 'Aguardando confirmação', texto: 'O restaurante ainda não aceitou seu pedido.' },
  em_preparo: { titulo: 'Pedido aceito, em preparo!', texto: 'Sua comida já está sendo preparada.' },
  pronto: { titulo: 'Pedido pronto', texto: 'Já vai sair para entrega em instantes.' },
  saiu_entrega: { titulo: 'Saiu para entrega', texto: 'O motoboy está a caminho do seu endereço.' },
  entregue: { titulo: 'Entregue. Bom apetite! 🎉', texto: 'Obrigado por pedir com a gente.' },
  recusado: { titulo: 'Pedido não pôde ser aceito', texto: '' },
}

export default function CardapioPublico() {
  const [cardapio, setCardapio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erroCarregar, setErroCarregar] = useState('')

  const [aba, setAba] = useState('cardapio')
  const [carrinho, setCarrinho] = useState({})

  const [dados, setDados] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(DRAFT_KEY)) || { nome: '', telefone: '', endereco: '', cep: '' }
    } catch {
      return { nome: '', telefone: '', endereco: '', cep: '' }
    }
  })
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [trocoPara, setTrocoPara] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')

  const [pedidoAtivo, setPedidoAtivo] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(SESSION_KEY)) || null
    } catch {
      return null
    }
  })
  const [statusPedido, setStatusPedido] = useState(null)

  const carregarCardapio = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/pedir`, { headers: { Accept: 'application/json' } })
      if (!response.ok) {
        setErroCarregar('Nao foi possivel carregar o cardapio agora.')
        return
      }
      setCardapio(await response.json())
      setErroCarregar('')
    } catch {
      setErroCarregar('Nao foi possivel conectar ao restaurante.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarCardapio()
  }, [carregarCardapio])

  const buscarNomePeloTelefone = useCallback(async (telefone) => {
    const digits = telefone.replace(/\D/g, '')
    if (digits.length < 10) return

    try {
      const response = await fetch(`${API_BASE}/pedir/cliente/${digits}`, { headers: { Accept: 'application/json' } })
      if (!response.ok) return
      const payload = await response.json()
      if (payload.nome) {
        setDados((prev) => ({ ...prev, nome: payload.nome }))
      }
    } catch {
      // sem sorte, sem problema: cliente so digita o nome normalmente
    }
  }, [])

  const consultarStatus = useCallback(async (codigoQr) => {
    try {
      const response = await fetch(`${API_BASE}/pedir/status/${codigoQr}`, { headers: { Accept: 'application/json' } })
      if (!response.ok) return
      setStatusPedido(await response.json())
    } catch {
      // sem conexao momentanea: mantem o ultimo status conhecido na tela
    }
  }, [])

  useEffect(() => {
    if (!pedidoAtivo) return undefined

    const finalizado =
      statusPedido?.status === 'entregue' || statusPedido?.status === 'recusado'
    if (finalizado) return undefined

    consultarStatus(pedidoAtivo.codigoQr)
    const timer = setInterval(() => consultarStatus(pedidoAtivo.codigoQr), 5000)
    return () => clearInterval(timer)
  }, [pedidoAtivo, statusPedido?.status, consultarStatus])

  const itensCarrinho = useMemo(() => {
    if (!cardapio) return []
    return Object.entries(carrinho)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const produto = cardapio.produtos.find((p) => String(p.id) === id)
        return produto ? { ...produto, qty } : null
      })
      .filter(Boolean)
  }, [carrinho, cardapio])

  const totalItensCarrinho = itensCarrinho.reduce((soma, item) => soma + item.qty, 0)
  const subtotalCarrinho = itensCarrinho.reduce((soma, item) => soma + item.preco * item.qty, 0)
  const taxaEntrega = itensCarrinho.length > 0 ? 8 : 0

  const adicionarAoCarrinho = (produtoId) => {
    setCarrinho((prev) => ({ ...prev, [produtoId]: (prev[produtoId] || 0) + 1 }))
  }

  const removerDoCarrinho = (produtoId) => {
    setCarrinho((prev) => {
      const next = { ...prev }
      if (!next[produtoId]) return next
      next[produtoId] -= 1
      if (next[produtoId] <= 0) delete next[produtoId]
      return next
    })
  }

  const fazerPedido = async (event) => {
    event.preventDefault()
    setErroEnvio('')

    if (itensCarrinho.length === 0) {
      setErroEnvio('Adicione pelo menos um item ao pedido.')
      return
    }

    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(dados))
    setEnviando(true)

    const response = await fetch(`${API_BASE}/pedir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        nome: dados.nome,
        telefone: dados.telefone,
        cep: dados.cep,
        rua: dados.rua,
        cidade: dados.cidade,
        uf: dados.uf,
        endereco: dados.endereco,
        payment_method: formaPagamento,
        change_for: formaPagamento === 'dinheiro' && trocoPara ? Number(trocoPara) : undefined,
        items: itensCarrinho.map((item) => ({ id_produto: item.id, qty: item.qty })),
      }),
    })

    const payload = await response.json().catch(() => ({}))
    setEnviando(false)

    if (!response.ok) {
      setErroEnvio(payload.message || 'Nao foi possivel enviar o pedido. Confira os dados.')
      return
    }

    const novoPedidoAtivo = { codigoQr: payload.codigo_qr, deliveryNumber: payload.delivery_number }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(novoPedidoAtivo))
    setPedidoAtivo(novoPedidoAtivo)
    setStatusPedido({ status: payload.status, delivery_number: payload.delivery_number, total: payload.total })
    setCarrinho({})
  }

  const fazerNovoPedido = () => {
    window.localStorage.removeItem(SESSION_KEY)
    setPedidoAtivo(null)
    setStatusPedido(null)
    setAba('cardapio')
  }

  if (loading) {
    return (
      <div className="mp-shell">
        <div className="mp-container">
          <div className="mp-center">
            <p className="mp-hint">
              <span className="mp-spinner-dot" />
              Carregando cardápio...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (erroCarregar) {
    return (
      <div className="mp-shell">
        <div className="mp-container">
          <div className="mp-center">
            <div className="mp-card">
              <h3>{erroCarregar}</h3>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (pedidoAtivo && statusPedido) {
    const info = STATUS_INFO[statusPedido.status] || STATUS_INFO.aguardando_confirmacao
    const finalizado = statusPedido.status === 'entregue' || statusPedido.status === 'recusado'

    return (
      <div className="mp-shell">
        <div className="mp-container">
          <header className="mp-topbar">
            <div className="mp-topbar-mesa">
              <span>{cardapio?.empresa?.nome}</span>
              <strong>Pedido Delivery #{statusPedido.delivery_number}</strong>
            </div>
          </header>
          <div className="mp-center">
            <div className="mp-card">
              <h1>{info.titulo}</h1>
              {statusPedido.status === 'recusado' ? (
                <p>{statusPedido.motivo_cancelamento || 'Fale com o restaurante pra mais detalhes.'}</p>
              ) : (
                <p>{info.texto}</p>
              )}
              {statusPedido.entregador_nome && statusPedido.status === 'saiu_entrega' && (
                <p className="mp-hint">Entregador: {statusPedido.entregador_nome}</p>
              )}
              <p style={{ color: 'var(--muted)' }}>Total: <strong>{formatarPreco(statusPedido.total)}</strong></p>
              {!finalizado && (
                <p className="mp-hint">
                  <span className="mp-spinner-dot" />
                  Essa tela atualiza sozinha conforme o pedido avança.
                </p>
              )}
              {finalizado && (
                <button className="mp-primary-btn" type="button" onClick={fazerNovoPedido}>
                  Fazer novo pedido
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mp-shell">
      <div className="mp-container">
        <header className="mp-topbar">
          <div className="mp-topbar-mesa">
            <span>Peça delivery</span>
            <strong>{cardapio?.empresa?.nome}</strong>
          </div>
        </header>

        <nav className="mp-tabs">
          <button
            type="button"
            className={`mp-tab ${aba === 'cardapio' ? 'active' : ''}`}
            onClick={() => setAba('cardapio')}
          >
            Cardápio
          </button>
          <button
            type="button"
            className={`mp-tab ${aba === 'pedido' ? 'active' : ''}`}
            onClick={() => setAba('pedido')}
          >
            Meu pedido
            {totalItensCarrinho > 0 && <span className="mp-tab-badge">{totalItensCarrinho}</span>}
          </button>
        </nav>

        {aba === 'cardapio' ? (
          <section className="mp-content">
            <div className="mp-section-title">
              <h2>Cardápio</h2>
              <p>Toque em + pra adicionar</p>
            </div>

            <div className="mp-product-list">
              {cardapio.produtos.map((produto) => {
                const qty = carrinho[produto.id] || 0
                const visual = getVisualProduto(produto.nome)
                return (
                  <article className="mp-product-card" key={produto.id}>
                    {produto.imagem ? (
                      <img className="mp-product-thumb" src={produto.imagem} alt={produto.nome} />
                    ) : (
                      <div className="mp-product-thumb mp-product-thumb-icon" style={{ background: visual.gradiente }}>
                        <span>{visual.emoji}</span>
                      </div>
                    )}
                    <div className="mp-product-main">
                      <span>{produto.categoria}</span>
                      <h3>{produto.nome}</h3>
                      {produto.descricao && <p>{produto.descricao}</p>}
                      <span className="mp-product-price">{formatarPreco(produto.preco)}</span>
                    </div>
                    <div className="mp-product-action">
                      {qty === 0 ? (
                        <button
                          className="mp-add-btn"
                          type="button"
                          onClick={() => adicionarAoCarrinho(produto.id)}
                          aria-label={`Adicionar ${produto.nome}`}
                        >
                          +
                        </button>
                      ) : (
                        <div className="mp-stepper">
                          <button type="button" onClick={() => removerDoCarrinho(produto.id)} aria-label="Remover um">
                            −
                          </button>
                          <span>{qty}</span>
                          <button type="button" onClick={() => adicionarAoCarrinho(produto.id)} aria-label="Adicionar mais um">
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : (
          <section className="mp-content">
            <div className="mp-section-title">
              <h2>Meu pedido</h2>
              <p>{totalItensCarrinho} item(ns) selecionado(s)</p>
            </div>

            {itensCarrinho.length === 0 ? (
              <div className="mp-empty">Ainda não tem nada aqui. Volta no cardápio e toca em +.</div>
            ) : (
              <>
                <div className="mp-order-list">
                  {itensCarrinho.map((item) => (
                    <div className="mp-order-item" key={item.id}>
                      <div>
                        <strong>{item.nome}</strong>
                        <small>{formatarPreco(item.preco)} cada</small>
                      </div>
                      <div className="mp-stepper">
                        <button type="button" onClick={() => removerDoCarrinho(item.id)} aria-label="Remover um">
                          −
                        </button>
                        <span>{item.qty}</span>
                        <button type="button" onClick={() => adicionarAoCarrinho(item.id)} aria-label="Adicionar mais um">
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mp-total-row">
                  <span>Subtotal</span>
                  <strong>{formatarPreco(subtotalCarrinho)}</strong>
                </div>
                <div className="mp-total-row">
                  <span>Taxa de entrega</span>
                  <strong>{formatarPreco(taxaEntrega)}</strong>
                </div>
                <div className="mp-total-row">
                  <span>Total do pedido</span>
                  <strong>{formatarPreco(subtotalCarrinho + taxaEntrega)}</strong>
                </div>

                <form className="mp-checkout" onSubmit={fazerPedido}>
                  <h3>Seus dados</h3>
                  <input
                    type="text"
                    placeholder="Seu nome"
                    value={dados.nome}
                    onChange={(event) => setDados({ ...dados, nome: event.target.value })}
                    required
                  />
                  <input
                    type="text"
                    inputMode="tel"
                    placeholder="Telefone"
                    value={dados.telefone}
                    onChange={(event) => setDados({ ...dados, telefone: event.target.value })}
                    onBlur={(event) => buscarNomePeloTelefone(event.target.value)}
                    required
                  />
                  <EnderecoPorCep
                    className="mp-field"
                    onResolved={(resolved) =>
                      setDados({
                        ...dados,
                        cep: resolved?.cep || '',
                        endereco: resolved?.endereco || '',
                        rua: resolved?.rua || '',
                        cidade: resolved?.cidade || '',
                        uf: resolved?.uf || '',
                      })
                    }
                  />
                  <select value={formaPagamento} onChange={(event) => setFormaPagamento(event.target.value)}>
                    <option value="pix">Pix</option>
                    <option value="cartao">Cartão (na entrega)</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                  {formaPagamento === 'dinheiro' && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Troco para quanto? (opcional)"
                      value={trocoPara}
                      onChange={(event) => setTrocoPara(event.target.value)}
                    />
                  )}
                  {erroEnvio && <small className="mp-error">{erroEnvio}</small>}
                  <button className="mp-primary-btn" type="submit" disabled={enviando}>
                    {enviando ? 'Enviando...' : 'Fazer pedido'}
                  </button>
                </form>
              </>
            )}
          </section>
        )}
      </div>

      {aba === 'cardapio' && totalItensCarrinho > 0 && (
        <div className="mp-cartbar">
          <button className="mp-cartbar-inner" type="button" onClick={() => setAba('pedido')}>
            <div className="mp-cartbar-info">
              <small>{totalItensCarrinho} item(ns)</small>
              <strong>{formatarPreco(subtotalCarrinho)}</strong>
            </div>
            <span className="mp-cartbar-cta">Ver pedido</span>
          </button>
        </div>
      )}
    </div>
  )
}
