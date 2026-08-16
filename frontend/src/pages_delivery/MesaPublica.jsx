import React, { useCallback, useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api`

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Sem fotos reais cadastradas, cada produto ganha um icone + gradiente proprios (baseados
// no nome) pra nao ficar so texto na lista - like um "prato ilustrado" em vez de foto.
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

export default function MesaPublica() {
  const token = window.location.pathname.replace('/mesa/', '')
  const sessionKey = `mesa_sessao_${token}`

  const [mesaData, setMesaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erroCarregar, setErroCarregar] = useState('')
  const [mesaLiberada, setMesaLiberada] = useState(false)

  const [sessao, setSessao] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(sessionKey)) || null
    } catch {
      return null
    }
  })

  const [telefone, setTelefone] = useState('')
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [precisaNome, setPrecisaNome] = useState(false)
  const [erroIdentificacao, setErroIdentificacao] = useState('')
  const [identificando, setIdentificando] = useState(false)

  const [aba, setAba] = useState('cardapio')
  const [carrinho, setCarrinho] = useState({})
  const [enviandoPedido, setEnviandoPedido] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [fechando, setFechando] = useState(false)
  const [chavePix, setChavePix] = useState(null)

  const carregarMesa = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/mesa/${token}`, { headers: { Accept: 'application/json' } })
      if (!response.ok) {
        setErroCarregar('Mesa nao encontrada. Confira o QR Code.')
        return
      }
      const data = await response.json()
      setMesaData((anterior) => {
        // A comanda so existe enquanto ta ABERTA/AGUARDANDO_PAGAMENTO: se estava aguardando e
        // sumiu, foi porque o caixa acabou de confirmar. Marca liberada em vez de voltar pro
        // cardapio do nada.
        if (anterior?.comanda?.status === 'AGUARDANDO_PAGAMENTO' && !data.comanda) {
          setMesaLiberada(true)
          setSessao(null)
          window.localStorage.removeItem(sessionKey)
        }
        return data
      })
      setErroCarregar('')
    } catch {
      setErroCarregar('Nao foi possivel conectar ao restaurante.')
    } finally {
      setLoading(false)
    }
  }, [token, sessionKey])

  useEffect(() => {
    carregarMesa()
  }, [carregarMesa])

  // Enquanto a comanda esta aguardando confirmacao do caixa, fica de olho pra saber quando libera.
  useEffect(() => {
    if (mesaData?.comanda?.status !== 'AGUARDANDO_PAGAMENTO') return undefined
    const timer = setInterval(carregarMesa, 5000)
    return () => clearInterval(timer)
  }, [mesaData?.comanda?.status, carregarMesa])

  const handleIdentificar = async (event) => {
    event.preventDefault()
    setErroIdentificacao('')
    setIdentificando(true)

    const response = await fetch(`${API_BASE}/mesa/${token}/identificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ telefone, nome: nome || undefined, cpf: cpf || undefined }),
    })
    const payload = await response.json().catch(() => ({}))
    setIdentificando(false)

    if (!response.ok) {
      if (payload.novo_cliente) {
        setPrecisaNome(true)
        setErroIdentificacao('Primeira vez aqui? Preenche seu nome tambem.')
      } else {
        setErroIdentificacao(payload.message || 'Nao foi possivel identificar.')
      }
      return
    }

    const novaSessao = { idCliente: payload.cliente.id, nome: payload.cliente.nome }
    window.localStorage.setItem(sessionKey, JSON.stringify(novaSessao))
    setSessao(novaSessao)
    await carregarMesa()
  }

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

  const itensCarrinho = useMemo(() => {
    if (!mesaData) return []
    return Object.entries(carrinho)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const produto = mesaData.produtos.find((p) => String(p.id) === id)
        return produto ? { ...produto, qty } : null
      })
      .filter(Boolean)
  }, [carrinho, mesaData])

  const totalItensCarrinho = itensCarrinho.reduce((soma, item) => soma + item.qty, 0)
  const totalCarrinho = itensCarrinho.reduce((soma, item) => soma + item.preco * item.qty, 0)

  const enviarPedido = async () => {
    if (itensCarrinho.length === 0) return
    setEnviandoPedido(true)

    await fetch(`${API_BASE}/mesa/${token}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        id_cliente: sessao.idCliente,
        items: itensCarrinho.map((item) => ({ id_produto: item.id, qty: item.qty })),
      }),
    })

    setCarrinho({})
    setEnviandoPedido(false)
    setAba('cardapio')
    await carregarMesa()
  }

  const fecharComanda = async () => {
    setFechando(true)
    const response = await fetch(`${API_BASE}/mesa/${token}/fechar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ forma_pagamento: formaPagamento }),
    })
    const payload = await response.json().catch(() => ({}))
    setChavePix(payload.chave_pix || null)
    setFechando(false)
    await carregarMesa()
  }

  if (loading) {
    return (
      <div className="mp-shell">
        <div className="mp-container">
          <div className="mp-center">
            <p className="mp-hint">
              <span className="mp-spinner-dot" />
              Carregando mesa...
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

  if (mesaLiberada) {
    return (
      <div className="mp-shell">
        <div className="mp-container">
          <div className="mp-center">
            <div className="mp-card">
              <h1>Pagamento confirmado 🎉</h1>
              <p>A mesa foi liberada. Se quiser pedir de novo, bipe o QR outra vez.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const comanda = mesaData.comanda

  if (!sessao) {
    return (
      <div className="mp-shell">
        <div className="mp-container">
          <header className="mp-topbar">
            <div className="mp-topbar-mesa">
              <span>Mesa {mesaData.mesa.numero}</span>
              <strong>Peça direto daqui</strong>
            </div>
          </header>
          <div className="mp-center">
            <div className="mp-card">
              <h3>Antes de pedir, seu telefone</h3>
              <p>Usamos pra identificar seu pedido e o do resto da mesa.</p>
              <form onSubmit={handleIdentificar}>
                <input
                  type="text"
                  inputMode="tel"
                  placeholder="Seu telefone"
                  value={telefone}
                  onChange={(event) => setTelefone(event.target.value)}
                  required
                />
                {precisaNome && (
                  <>
                    <input
                      type="text"
                      placeholder="Seu nome"
                      value={nome}
                      onChange={(event) => setNome(event.target.value)}
                      required
                    />
                    <input
                      type="text"
                      placeholder="CPF (opcional)"
                      value={cpf}
                      onChange={(event) => setCpf(event.target.value)}
                    />
                  </>
                )}
                {erroIdentificacao && <small className="mp-error">{erroIdentificacao}</small>}
                <button className="mp-primary-btn" type="submit" disabled={identificando}>
                  {identificando ? 'Entrando...' : 'Continuar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (comanda?.status === 'AGUARDANDO_PAGAMENTO') {
    return (
      <div className="mp-shell">
        <div className="mp-container">
          <header className="mp-topbar">
            <div className="mp-topbar-mesa">
              <span>Mesa {mesaData.mesa.numero}</span>
              <strong>Fechando a conta</strong>
            </div>
          </header>
          <div className="mp-center">
            <div className="mp-card">
              <h3>Aguardando confirmação do caixa</h3>
              <p>Total da mesa: <strong>{formatarPreco(comanda.total)}</strong></p>
              {comanda.forma_pagamento === 'PIX' ? (
                <>
                  <p>Pague via Pix e mostre o comprovante pro atendente:</p>
                  <div className="mp-pix-box">{chavePix || 'Peça a chave Pix ao atendente'}</div>
                </>
              ) : (
                <p>Chame o garçom pra passar o cartão ou receber em dinheiro.</p>
              )}
              <p className="mp-hint">
                <span className="mp-spinner-dot" />
                A mesa libera automaticamente assim que o caixa confirmar.
              </p>
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
            <span>Mesa {mesaData.mesa.numero}</span>
            <strong>Olá, {sessao.nome?.split(' ')[0]}</strong>
          </div>
          <span className={`mp-topbar-status ${comanda ? 'online' : ''}`}>
            {comanda ? 'Comanda aberta' : 'Nova comanda'}
          </span>
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
              {mesaData.produtos.map((produto) => {
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
                  <span>Total deste pedido</span>
                  <strong>{formatarPreco(totalCarrinho)}</strong>
                </div>

                <button
                  className="mp-primary-btn"
                  type="button"
                  onClick={enviarPedido}
                  disabled={enviandoPedido}
                >
                  {enviandoPedido ? 'Enviando...' : 'Enviar pedido pra cozinha'}
                </button>
              </>
            )}

            {comanda && comanda.pedidos.length > 0 && (
              <>
                <div className="mp-section-title">
                  <h2>Já pedido na mesa</h2>
                  <p>{formatarPreco(comanda.total)} no total</p>
                </div>
                <div className="mp-existing-list">
                  {comanda.pedidos.map((pedido) => (
                    <div key={pedido.id_pedido} className="mp-existing-item">
                      <strong>{pedido.cliente_nome}</strong>
                      <span>{pedido.itens.map((i) => `${i.qty}x ${i.nome}`).join(', ')}</span>
                      <span>{formatarPreco(pedido.total)}</span>
                    </div>
                  ))}
                </div>

                <div className="mp-checkout">
                  <h3>Fechar a mesa</h3>
                  <select value={formaPagamento} onChange={(event) => setFormaPagamento(event.target.value)}>
                    <option value="pix">Pix</option>
                    <option value="cartao">Cartão</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                  <button className="mp-primary-btn" type="button" onClick={fecharComanda} disabled={fechando}>
                    {fechando ? 'Fechando...' : 'Fechar comanda'}
                  </button>
                </div>
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
              <strong>{formatarPreco(totalCarrinho)}</strong>
            </div>
            <span className="mp-cartbar-cta">Ver pedido</span>
          </button>
        </div>
      )}
    </div>
  )
}
