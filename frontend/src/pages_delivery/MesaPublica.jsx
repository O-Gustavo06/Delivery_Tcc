import React, { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { gerarPixCopiaECola } from '../utils/pix'
import { resolveApiBase, resolveAssetUrl } from '../utils/apiBase'

const API_BASE = resolveApiBase()

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// navigator.clipboard exige contexto seguro (https ou localhost) - o celular do cliente
// acessa a mesa pelo IP da rede local em http, entao cai direto no catch sem copiar nada.
// O fallback com textarea + execCommand cobre justamente esse caso.
async function copiarTexto(texto) {
  if (window.navigator.clipboard && window.isSecureContext) {
    try {
      await window.navigator.clipboard.writeText(texto)
      return true
    } catch {
      // segue pro fallback abaixo
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = texto
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const copiou = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copiou
  } catch {
    return false
  }
}

// Sem fotos reais cadastradas, cada produto ganha um icone + gradiente proprios (baseados
// no nome) pra nao ficar so texto na lista - like um "prato ilustrado" em vez de foto.
const VISUAIS_PRODUTO = [
  { termos: ['pizza'], emoji: '🍕', gradiente: 'linear-gradient(135deg, #ff6b57, #ffb347)' },
  { termos: ['hamburguer', 'hambúrguer', 'burger', 'lanche', 'x-tudo', 'x-salada', 'x-burguer', 'xis', 'x-bacon'], emoji: '🍔', gradiente: 'linear-gradient(135deg, #f7a84b, #e8622c)' },
  { termos: ['batata'], emoji: '🍟', gradiente: 'linear-gradient(135deg, #ffcf5c, #ffb020)' },
  { termos: ['suco'], emoji: '🧃', gradiente: 'linear-gradient(135deg, #ff9f43, #ffe08a)' },
  { termos: ['refrigerante', 'lata', 'refri'], emoji: '🥤', gradiente: 'linear-gradient(135deg, #4fb3e8, #8fd3f4)' },
  { termos: ['frango'], emoji: '🍗', gradiente: 'linear-gradient(135deg, #e0a13c, #b9752e)' },
  { termos: ['arroz'], emoji: '🍚', gradiente: 'linear-gradient(135deg, #f4e9d8, #e8d9bd)' },
  { termos: ['salada', 'verde'], emoji: '🥗', gradiente: 'linear-gradient(135deg, #7bc86c, #4f9d4f)' },
  { termos: ['sobremesa', 'doce', 'sorvete', 'bolo'], emoji: '🍰', gradiente: 'linear-gradient(135deg, #ff8fa3, #ffc2d1)' },
  { termos: ['agua', 'água'], emoji: '💧', gradiente: 'linear-gradient(135deg, #6ec3ff, #a8dcff)' },
]

function getVisualProduto(nome) {
  const alvo = (nome || '').toLowerCase()
  const encontrado = VISUAIS_PRODUTO.find((v) => v.termos.some((termo) => alvo.includes(termo)))
  return encontrado || { emoji: '🍽️', gradiente: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }
}

function ThemeToggleButton({ theme, onToggleTheme }) {
  return (
    <button
      className="mp-theme-toggle"
      type="button"
      onClick={onToggleTheme}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

export default function MesaPublica({ theme, onToggleTheme }) {
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
  const [qrPixDataUrl, setQrPixDataUrl] = useState('')
  const [statusCopiaPix, setStatusCopiaPix] = useState(null)
  const [modoDivisao, setModoDivisao] = useState('junto')
  const [dividirEntre, setDividirEntre] = useState('2')

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

  // Fica de olho no cardapio (produto ativado/desativado, preco etc) o tempo todo, mesma logica
  // do cardapio online - sem isso, o cliente sentado na mesa so via a mudanca dando F5. Enquanto
  // a comanda esta aguardando confirmacao do caixa, verifica mais rapido pra saber quando libera.
  useEffect(() => {
    const aguardandoPagamento = mesaData?.comanda?.status === 'AGUARDANDO_PAGAMENTO'
    const timer = setInterval(carregarMesa, aguardandoPagamento ? 5000 : 15000)
    return () => clearInterval(timer)
  }, [mesaData?.comanda?.status, carregarMesa])

  const chavePix = mesaData?.empresa?.chave_pix || null
  const nomeEmpresa = mesaData?.empresa?.nome || null
  const totalComanda = mesaData?.comanda?.total

  // QR do Pix Copia e Cola, sempre em cima da chave e do total atuais da comanda - se o admin
  // trocar a chave Pix em Mesas, o proximo polling (a cada 5-15s) ja atualiza aqui sozinho.
  useEffect(() => {
    if (!chavePix || !totalComanda) {
      setQrPixDataUrl('')
      return undefined
    }

    let cancelado = false
    const payload = gerarPixCopiaECola({ chave: chavePix, nome: nomeEmpresa, valor: totalComanda })
    QRCode.toDataURL(payload, { width: 200, margin: 1 }).then((url) => {
      if (!cancelado) setQrPixDataUrl(url)
    })
    return () => {
      cancelado = true
    }
  }, [chavePix, nomeEmpresa, totalComanda])

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
    await response.json().catch(() => ({}))
    setFechando(false)
    await carregarMesa()
  }

  const copiarChavePix = async () => {
    const sucesso = await copiarTexto(chavePix)
    setStatusCopiaPix(sucesso ? 'sucesso' : 'erro')
    setTimeout(() => setStatusCopiaPix(null), 2500)
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
            <ThemeToggleButton theme={theme} onToggleTheme={onToggleTheme} />
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
            <ThemeToggleButton theme={theme} onToggleTheme={onToggleTheme} />
          </header>
          <div className="mp-center">
            <div className="mp-card">
              <h3>Aguardando confirmação do caixa</h3>
              <p>Total da mesa: <strong>{formatarPreco(comanda.total)}</strong></p>
              {comanda.forma_pagamento === 'PIX' ? (
                <>
                  <p>Pague via Pix e mostre o comprovante pro atendente:</p>
                  {chavePix ? (
                    <div className="mp-pix-preview">
                      {qrPixDataUrl && <img src={qrPixDataUrl} alt="QR Code Pix" width={200} height={200} />}
                      <div className="mp-pix-box">{chavePix}</div>
                      <button className="btn-link-pix" type="button" onClick={copiarChavePix}>
                        Copiar chave Pix
                      </button>
                      {statusCopiaPix === 'sucesso' && (
                        <small className="mp-pix-copia-status ok">Código copiado com sucesso!</small>
                      )}
                      {statusCopiaPix === 'erro' && (
                        <small className="mp-pix-copia-status erro">
                          Não foi possível copiar automaticamente. Copie a chave acima manualmente.
                        </small>
                      )}
                    </div>
                  ) : (
                    <div className="mp-pix-box">Peça a chave Pix ao atendente</div>
                  )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`mp-topbar-status ${comanda ? 'online' : ''}`}>
              {comanda ? 'Comanda aberta' : 'Nova comanda'}
            </span>
            <ThemeToggleButton theme={theme} onToggleTheme={onToggleTheme} />
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
              {mesaData.produtos.map((produto) => {
                const qty = carrinho[produto.id] || 0
                const visual = getVisualProduto(produto.nome)
                return (
                  <article className="mp-product-card" key={produto.id}>
                    {produto.imagem ? (
                      <img className="mp-product-thumb" src={resolveAssetUrl(produto.imagem)} alt={produto.nome} />
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

                  <div className="mp-split-tabs">
                    <button
                      type="button"
                      className={modoDivisao === 'junto' ? 'active' : ''}
                      onClick={() => setModoDivisao('junto')}
                    >
                      Pagar junto
                    </button>
                    <button
                      type="button"
                      className={modoDivisao === 'igual' ? 'active' : ''}
                      onClick={() => setModoDivisao('igual')}
                    >
                      Dividir igual
                    </button>
                    <button
                      type="button"
                      className={modoDivisao === 'pessoa' ? 'active' : ''}
                      onClick={() => setModoDivisao('pessoa')}
                    >
                      Cada um o seu
                    </button>
                  </div>

                  {modoDivisao === 'igual' && (
                    <div className="mp-split-box">
                      <label htmlFor="dividir-entre">Dividir entre quantas pessoas?</label>
                      <input
                        id="dividir-entre"
                        type="number"
                        min="1"
                        value={dividirEntre}
                        onChange={(event) => setDividirEntre(event.target.value)}
                      />
                      <p className="mp-split-resultado">
                        {formatarPreco(comanda.total / (Number(dividirEntre) || 1))}{' '}
                        <span>por pessoa ({dividirEntre || 1}x)</span>
                      </p>
                    </div>
                  )}

                  {modoDivisao === 'pessoa' && (
                    <div className="mp-split-box">
                      {comanda.pedidos.map((pedido) => (
                        <div key={pedido.id_pedido} className="mp-split-row">
                          <span>{pedido.cliente_nome}</span>
                          <strong>{formatarPreco(pedido.total)}</strong>
                        </div>
                      ))}
                      <p className="mp-split-hint">Combinem entre vocês quem paga o quê — a mesa fecha com um pagamento só.</p>
                    </div>
                  )}

                  <select value={formaPagamento} onChange={(event) => setFormaPagamento(event.target.value)}>
                    <option value="pix">Pix</option>
                    <option value="cartao">Cartão</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>

                  {formaPagamento === 'pix' && chavePix && (
                    <div className="mp-pix-preview">
                      {qrPixDataUrl && <img src={qrPixDataUrl} alt="QR Code Pix" width={160} height={160} />}
                      <div className="mp-pix-box">{chavePix}</div>
                      <button className="btn-link-pix" type="button" onClick={copiarChavePix}>
                        Copiar chave Pix
                      </button>
                      {statusCopiaPix === 'sucesso' && (
                        <small className="mp-pix-copia-status ok">Código copiado com sucesso!</small>
                      )}
                      {statusCopiaPix === 'erro' && (
                        <small className="mp-pix-copia-status erro">
                          Não foi possível copiar automaticamente. Copie a chave acima manualmente.
                        </small>
                      )}
                    </div>
                  )}

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
