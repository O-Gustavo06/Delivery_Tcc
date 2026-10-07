import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EnderecoPorCep from './EnderecoPorCep.jsx'
import { resolveApiBase, resolveAssetUrl } from '../utils/apiBase'

const API_BASE = resolveApiBase()
const SESSION_KEY = 'pedido_online_sessao'
const DRAFT_KEY = 'pedido_online_dados'
const TAXA_ENTREGA_FALLBACK = 8
const PEDIDO_MINIMO = 20


/*
 * Checkout mais simples:
 * - sem cartões visuais entre cada etapa;
 * - separação feita por espaçamento e divisores;
 * - foco no fluxo do pedido.
 */
const CHECKOUT_STYLE = `
.menu-checkout-simples {
  background: var(--surface, #fff);
  border: 0;
  box-shadow: none;
  border-radius: 0;
}

.menu-checkout-simples .checkout-secao {
  background: transparent;
  border: 0;
  box-shadow: none;
  border-radius: 0;
}

.menu-checkout-simples .checkout-secao + .checkout-secao {
  border-top: 1px solid var(--border, #e5e7eb);
  margin-top: 18px;
  padding-top: 18px;
}

.menu-checkout-simples .menu-carrinho-item-pro {
  border-bottom: 1px solid var(--border, #e5e7eb);
  border-radius: 0;
  padding: 10px 0;
}

.menu-checkout-simples .menu-resumo-pro {
  padding: 14px 0;
}

.menu-checkout-simples .menu-total-pro {
  border-top: 1px solid var(--border, #e5e7eb);
  border-bottom: 1px solid var(--border, #e5e7eb);
  border-radius: 0;
  padding: 14px 0;
  margin-top: 4px;
}

.menu-checkout-simples .menu-dados-pro {
  padding-left: 0;
  padding-right: 0;
}

.menu-checkout-simples .menu-dados-pro h3 {
  margin-bottom: 12px;
}

.menu-checkout-simples input,
.menu-checkout-simples select,
.menu-checkout-simples textarea {
  border-radius: 6px;
}

.menu-checkout-simples .menu-finalizar-pro {
  border-radius: 6px;
  box-shadow: none;
}

.menu-checkout-simples .menu-produto-img-pro {
  border-radius: 6px;
  background: var(--surface-muted, #f3f4f6);
}

@media (max-width: 800px) {
  .menu-checkout-simples {
    border-radius: 0;
  }

  .menu-checkout-simples .checkout-secao + .checkout-secao {
    margin-top: 14px;
    padding-top: 14px;
  }
}
`


function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// applicationServerKey precisa ser Uint8Array, mas a chave VAPID vem do backend como
// base64url (texto) - conversao padrao recomendada pela spec do Push API.
function chaveVapidParaUint8Array(chaveBase64) {
  const padding = '='.repeat((4 - (chaveBase64.length % 4)) % 4)
  const base64 = (chaveBase64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

function getStatusInfo(status, tipoEntrega) {
  const retirada = tipoEntrega === 'retirada'

  const info = {
    aguardando_confirmacao: { titulo: 'Aguardando confirmação', texto: 'O restaurante ainda não aceitou seu pedido.' },
    em_preparo: { titulo: 'Pedido aceito, em preparo!', texto: 'Sua comida já está sendo preparada.' },
    pronto: retirada
      ? { titulo: 'Pedido pronto pra retirar!', texto: 'Pode vir buscar no balcão quando quiser.' }
      : { titulo: 'Pedido pronto', texto: 'Já vai sair para entrega em instantes.' },
    saiu_entrega: { titulo: 'Saiu para entrega', texto: 'O motoboy está a caminho do seu endereço.' },
    entregue: retirada
      ? { titulo: 'Retirado. Bom apetite! 🎉', texto: 'Obrigado por pedir com a gente.' }
      : { titulo: 'Entregue. Bom apetite! 🎉', texto: 'Obrigado por pedir com a gente.' },
    recusado: { titulo: 'Pedido não pôde ser aceito', texto: '' },
  }

  return info[status] || info.aguardando_confirmacao
}

export default function CardapioPublico({ theme, onToggleTheme }) {
  const [cardapio, setCardapio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erroCarregar, setErroCarregar] = useState('')

  const [busca, setBusca] = useState('')
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Todos')
  const [carrinho, setCarrinho] = useState({})

  const [dados, setDados] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(DRAFT_KEY)) || { nome: '', telefone: '', endereco: '', cep: '' }
    } catch {
      return { nome: '', telefone: '', endereco: '', cep: '' }
    }
  })
  const [tipoEntrega, setTipoEntrega] = useState('delivery')
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [numero, setNumero] = useState('')
  const [trocoPara, setTrocoPara] = useState('')
  const [observacao, setObservacao] = useState('')
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
  const [notaAvaliacao, setNotaAvaliacao] = useState(0)
  const [comentarioAvaliacao, setComentarioAvaliacao] = useState('')
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false)
  const [erroAvaliacao, setErroAvaliacao] = useState('')
  const [statusNotificacao, setStatusNotificacao] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  )
  const [ativandoNotificacao, setAtivandoNotificacao] = useState(false)

  const carregarCardapio = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/pedir`, { headers: { Accept: 'application/json' } })
      if (!response.ok) {
        // So mostra a tela de erro se ainda nao tinha nada carregado - uma falha passageira
        // no refresh silencioso em segundo plano nao deve derrubar o cardapio ja exibido.
        setCardapio((atual) => {
          if (!atual) setErroCarregar('Nao foi possivel carregar o cardapio agora.')
          return atual
        })
        return
      }
      setCardapio(await response.json())
      setErroCarregar('')
    } catch {
      setCardapio((atual) => {
        if (!atual) setErroCarregar('Nao foi possivel conectar ao restaurante.')
        return atual
      })
    } finally {
      setLoading(false)
    }
  }, [])

  // Fica de olho no cardapio (produtos, aberto/fechado) sem precisar recarregar a pagina -
  // se o admin fechar a loja ou mudar algo enquanto o cliente esta navegando, reflete sozinho.
  useEffect(() => {
    carregarCardapio()
    const timer = setInterval(carregarCardapio, 15000)
    return () => clearInterval(timer)
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

  const categorias = useMemo(() => {
    if (!cardapio) return ['Todos']
    const lista = cardapio.produtos.map((p) => p.categoria).filter(Boolean)
    return ['Todos', ...new Set(lista)]
  }, [cardapio])

  const produtosFiltrados = useMemo(() => {
    if (!cardapio) return []
    return cardapio.produtos.filter((produto) => {
      const texto = `${produto.nome} ${produto.descricao || ''} ${produto.categoria || ''}`.toLowerCase()
      const buscaCombina = texto.includes(busca.toLowerCase())
      const categoriaCombina = categoriaSelecionada === 'Todos' || produto.categoria === categoriaSelecionada
      return buscaCombina && categoriaCombina
    })
  }, [cardapio, busca, categoriaSelecionada])

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
  const carrinhoRef = useRef(null)
  const taxaEntregaPadrao = cardapio?.empresa?.taxa_entrega_padrao ?? TAXA_ENTREGA_FALLBACK
  const taxaEntrega = itensCarrinho.length > 0 && tipoEntrega === 'delivery' ? taxaEntregaPadrao : 0

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
        tipo_entrega: tipoEntrega,
        cep: tipoEntrega === 'delivery' ? dados.cep : undefined,
        rua: tipoEntrega === 'delivery' ? dados.rua : undefined,
        cidade: tipoEntrega === 'delivery' ? dados.cidade : undefined,
        uf: tipoEntrega === 'delivery' ? dados.uf : undefined,
        endereco: tipoEntrega === 'delivery' ? dados.endereco : undefined,
        payment_method: formaPagamento,
        cpf_cnpj: ['pix', 'cartao_online'].includes(formaPagamento) ? cpfCnpj : undefined,
        email: formaPagamento === 'cartao_online' ? email : undefined,
        numero: formaPagamento === 'cartao_online' ? numero : undefined,
        change_for: formaPagamento === 'dinheiro' && trocoPara ? Number(trocoPara) : undefined,
        note: observacao.trim() || undefined,
        items: itensCarrinho.map((item) => ({ id_produto: item.id, qty: item.qty })),
      }),
    })

    const payload = await response.json().catch(() => ({}))
    setEnviando(false)

    if (!response.ok) {
      setErroEnvio(payload.message || 'Nao foi possivel enviar o pedido. Confira os dados.')
      return
    }

    const novoPedidoAtivo = { codigoQr: payload.codigo_qr, numero: payload.number, deliveryNumber: payload.delivery_number, tipoEntrega: payload.tipo_entrega }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(novoPedidoAtivo))
    setPedidoAtivo(novoPedidoAtivo)
    setStatusPedido({ status: payload.status, number: payload.number, delivery_number: payload.delivery_number, tipo_entrega: payload.tipo_entrega, total: payload.total })
    setCarrinho({})
    setObservacao('')
  }

  const fazerNovoPedido = () => {
    window.localStorage.removeItem(SESSION_KEY)
    setPedidoAtivo(null)
    setStatusPedido(null)
    setNotaAvaliacao(0)
    setComentarioAvaliacao('')
    setErroAvaliacao('')
  }

  const enviarAvaliacao = async () => {
    setErroAvaliacao('')

    if (!notaAvaliacao) {
      setErroAvaliacao('Escolha uma nota de 1 a 5 estrelas.')
      return
    }

    setEnviandoAvaliacao(true)
    const response = await fetch(`${API_BASE}/pedir/status/${pedidoAtivo.codigoQr}/avaliacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ nota: notaAvaliacao, comentario: comentarioAvaliacao.trim() || undefined }),
    })
    const payload = await response.json().catch(() => ({}))
    setEnviandoAvaliacao(false)

    if (!response.ok) {
      setErroAvaliacao(payload.message || 'Nao foi possivel enviar sua avaliacao.')
      return
    }

    setStatusPedido((prev) => ({ ...prev, avaliacao: payload }))
  }

  const ativarNotificacoes = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
      setStatusNotificacao('unsupported')
      return
    }

    setAtivandoNotificacao(true)
    try {
      const permissao = await Notification.requestPermission()
      setStatusNotificacao(permissao)

      if (permissao !== 'granted') {
        setAtivandoNotificacao(false)
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveVapidParaUint8Array(cardapio.empresa.vapid_public_key),
      })

      await fetch(`${API_BASE}/pedir/status/${pedidoAtivo.codigoQr}/push/inscrever`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
    } catch {
      // Sem sorte (usuario fechou o prompt, navegador bloqueou etc.) - so nao ativa, sem
      // travar a tela de acompanhamento por causa disso.
    } finally {
      setAtivandoNotificacao(false)
    }
  }

  if (loading) {
    return (
      <div className="menu-publico-pro">
        <div className="menu-vazio-pro" style={{ textAlign: 'center' }}>
          <h3>Carregando cardápio...</h3>
        </div>
      </div>
    )
  }

  if (erroCarregar) {
    return (
      <div className="menu-publico-pro">
        <div className="menu-vazio-pro" style={{ textAlign: 'center' }}>
          <h3>{erroCarregar}</h3>
        </div>
      </div>
    )
  }

  if (pedidoAtivo && statusPedido) {
    const info = getStatusInfo(statusPedido.status, statusPedido.tipo_entrega)
    const finalizado = statusPedido.status === 'entregue' || statusPedido.status === 'recusado'
    const rotulo =
      statusPedido.tipo_entrega === 'retirada'
        ? `Retirada no balcão #${statusPedido.number ?? ''}`
        : `Pedido Delivery #${statusPedido.delivery_number ?? statusPedido.number ?? ''}`

    return (
      <div className="menu-publico-pro">
        <header className="menu-hero-pro">
          <div className="menu-hero-info">
            <span className="menu-tag-pro">{rotulo}</span>
            <h1>{cardapio?.empresa?.nome}</h1>
          </div>
          <button
            className="theme-toggle-pro"
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </header>
        <div className="menu-vazio-pro" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', display: 'grid', gap: 10 }}>
          <h3>{info.titulo}</h3>
          {statusPedido.status === 'recusado' ? (
            <p>{statusPedido.motivo_cancelamento || 'Fale com o restaurante pra mais detalhes.'}</p>
          ) : (
            <p>{info.texto}</p>
          )}
          {statusPedido.entregador_nome && statusPedido.status === 'saiu_entrega' && (
            <p>Entregador: {statusPedido.entregador_nome}</p>
          )}
          <p style={{ color: 'var(--text)' }}>
            Total: <strong>{formatarPreco(statusPedido.total)}</strong>
          </p>
          {statusPedido.payment?.method === 'pix' && statusPedido.payment.pix?.payload && (
            <div className="menu-pagamento-online">
              <h3>Pagamento Pix</h3>
              {statusPedido.payment.pix.encoded_image && (
                <img
                  src={`data:image/png;base64,${statusPedido.payment.pix.encoded_image}`}
                  alt="QR Code para pagamento Pix"
                  width={220}
                  height={220}
                />
              )}
              <textarea readOnly value={statusPedido.payment.pix.payload} rows={3} aria-label="Pix copia e cola" />
              <button
                className="menu-finalizar-pro"
                type="button"
                onClick={() => navigator.clipboard?.writeText(statusPedido.payment.pix.payload)}
              >
                Copiar Pix copia e cola
              </button>
            </div>
          )}
          {statusPedido.payment?.method === 'cartao' && statusPedido.payment.checkout_url && (
            <a className="menu-finalizar-pro" href={statusPedido.payment.checkout_url} target="_blank" rel="noreferrer">
              Pagar com cartão
            </a>
          )}
          {!finalizado && <p>Essa tela atualiza sozinha conforme o pedido avança.</p>}
          {!finalizado && cardapio?.empresa?.vapid_public_key && statusNotificacao === 'default' && (
            <button className="menu-finalizar-pro" type="button" onClick={ativarNotificacoes} disabled={ativandoNotificacao}>
              {ativandoNotificacao ? 'Ativando...' : '🔔 Avisar quando o status mudar'}
            </button>
          )}
          {!finalizado && statusNotificacao === 'granted' && (
            <p style={{ color: 'var(--success)', fontSize: 13.5 }}>🔔 Notificações ativadas — pode fechar essa aba.</p>
          )}
          {!finalizado && statusNotificacao === 'denied' && (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              Notificações bloqueadas no navegador — ative nas configurações do site se quiser ser avisado.
            </p>
          )}
          {statusPedido.status === 'entregue' && (
            <div className="menu-dados-pro" style={{ textAlign: 'left', gap: 10 }}>
              {statusPedido.avaliacao ? (
                <p style={{ textAlign: 'center' }}>
                  Você avaliou com {'⭐'.repeat(statusPedido.avaliacao.nota)} — obrigado pelo feedback!
                </p>
              ) : (
                <>
                  <p style={{ textAlign: 'center', margin: 0 }}>O que achou do seu pedido?</p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, fontSize: 28 }}>
                    {[1, 2, 3, 4, 5].map((valor) => (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => setNotaAvaliacao(valor)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                        aria-label={`${valor} estrela(s)`}
                      >
                        {valor <= notaAvaliacao ? '⭐' : '☆'}
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Comentário (opcional)"
                    value={comentarioAvaliacao}
                    onChange={(event) => setComentarioAvaliacao(event.target.value)}
                    rows={2}
                  />
                  {erroAvaliacao && <small style={{ color: 'var(--danger)' }}>{erroAvaliacao}</small>}
                  <button
                    className="menu-finalizar-pro"
                    type="button"
                    onClick={enviarAvaliacao}
                    disabled={enviandoAvaliacao}
                  >
                    {enviandoAvaliacao ? 'Enviando...' : 'Enviar avaliação'}
                  </button>
                </>
              )}
            </div>
          )}
          {finalizado && (
            <button className="menu-finalizar-pro" type="button" onClick={fazerNovoPedido}>
              Fazer novo pedido
            </button>
          )}
        </div>
      </div>
    )
  }

  const lojaAberta = cardapio?.empresa?.aberto !== false

  return (
    <>
      <style>{CHECKOUT_STYLE}</style>
      <div className="menu-publico-pro">
      <header className="menu-hero-pro">
        <div className="menu-hero-info">
          <span className="menu-tag-pro">Cardápio Online</span>
          <h1>{cardapio?.empresa?.nome}</h1>
          <p>Hambúrgueres, porções, bebidas e combos preparados para você.</p>
          <div className="menu-meta">
            {cardapio?.empresa?.nota_media != null && (
              <span>
                ⭐ {String(cardapio.empresa.nota_media).replace('.', ',')} ({cardapio.empresa.qtd_avaliacoes})
              </span>
            )}
            <span>30-45 min</span>
            <span>Pedido mínimo {formatarPreco(PEDIDO_MINIMO)}</span>
            <span>Entrega a partir de {formatarPreco(taxaEntregaPadrao)}</span>
          </div>
        </div>
        <div className="menu-status-pro">
          <button
            className="theme-toggle-pro"
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <strong className="menu-status-titulo">
            <span className={`menu-status-dot ${lojaAberta ? 'aberto' : 'fechado'}`} />
            {lojaAberta ? 'Aberto' : 'Fechado'}
          </strong>
          <span>{lojaAberta ? 'Recebendo pedidos' : 'Não está recebendo pedidos agora'}</span>
        </div>
      </header>

      <section className="menu-layout-pro">
        <div className="menu-conteudo-pro">
          <div className="menu-filtros-pro">
            <input
              type="text"
              placeholder="Buscar lanche, bebida, porção..."
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
            <div className="menu-categorias-pro">
              {categorias.map((categoria) => (
                <button
                  key={categoria}
                  type="button"
                  className={categoriaSelecionada === categoria ? 'ativo' : ''}
                  onClick={() => setCategoriaSelecionada(categoria)}
                >
                  {categoria}
                </button>
              ))}
            </div>
          </div>

          <div className="menu-titulo-secao">
            <div>
              <h2>Produtos disponíveis</h2>
              <p>Escolha os itens e adicione ao seu pedido.</p>
            </div>
            <span>{produtosFiltrados.length} produto(s)</span>
          </div>

          <div className="menu-lista-pro">
            {produtosFiltrados.length === 0 ? (
              <div className="menu-vazio-pro">
                <h3>Nenhum produto encontrado</h3>
                <p>Tente buscar por outro nome ou categoria.</p>
              </div>
            ) : (
              produtosFiltrados.map((produto) => {
                return (
                  <article className="menu-produto-pro" key={produto.id}>
                    {produto.imagem ? (
                      <div className="menu-produto-img-pro">
                        <img src={resolveAssetUrl(produto.imagem)} alt={produto.nome} />
                      </div>
                    ) : null}
                    <div className="menu-produto-info-pro">
                      <div className="menu-produto-topo">
                        <span>{produto.categoria}</span>
                      </div>
                      <h3>{produto.nome}</h3>
                      {produto.descricao && <p>{produto.descricao}</p>}
                      <div className="menu-produto-rodape-pro">
                        <strong>{formatarPreco(produto.preco)}</strong>
                        <button type="button" onClick={() => adicionarAoCarrinho(produto.id)}>
                          Adicionar ao pedido
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>

        <aside className="menu-carrinho-pro menu-checkout-simples" ref={carrinhoRef}>
          <div className="menu-carrinho-header checkout-secao">
            <h2>Seu pedido</h2>
            <span>{totalItensCarrinho} item(ns)</span>
          </div>

          {itensCarrinho.length === 0 ? (
            <p className="menu-carrinho-vazio-pro">Seu pedido está vazio.</p>
          ) : (
            <div className="menu-carrinho-itens-pro">
              {itensCarrinho.map((item) => (
                <div className="menu-carrinho-item-pro" key={item.id}>
                  <div>
                    <strong>{item.nome}</strong>
                    <br />
                    <small>{formatarPreco(item.preco)} cada</small>
                  </div>
                  <div className="menu-quantidade-pro">
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
          )}

          <div className="menu-resumo-pro checkout-secao">
            <div>
              <span>Subtotal</span>
              <strong>{formatarPreco(subtotalCarrinho)}</strong>
            </div>
            <div>
              <span>{tipoEntrega === 'retirada' ? 'Retirada no balcão' : 'Entrega'}</span>
              <strong>{formatarPreco(taxaEntrega)}</strong>
            </div>
          </div>
          {tipoEntrega === 'delivery' && itensCarrinho.length > 0 && (
            <small style={{ color: 'var(--muted)' }}>
              Valor estimado — a taxa final pode variar conforme a distância até o endereço.
            </small>
          )}

          <div className="menu-total-pro" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Total</span>
            <strong>{formatarPreco(subtotalCarrinho + taxaEntrega)}</strong>
          </div>

          <form className="menu-dados-pro checkout-secao" onSubmit={fazerPedido}>
            <h3>Dados do cliente</h3>
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
            <select value={tipoEntrega} onChange={(event) => setTipoEntrega(event.target.value)}>
              <option value="delivery">Delivery</option>
              <option value="retirada">Retirar no balcão</option>
            </select>
            {tipoEntrega === 'delivery' && (
              <EnderecoPorCep
                className="menu-dados-pro"
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
            )}
            <select value={formaPagamento} onChange={(event) => setFormaPagamento(event.target.value)}>
              <option value="pix">Pix</option>
              <option value="cartao">Cartão (na entrega)</option>
              <option value="cartao_online">Cartão online</option>
              <option value="dinheiro">Dinheiro</option>
            </select>
            {['pix', 'cartao_online'].includes(formaPagamento) && (
              <input
                type="text"
                inputMode="numeric"
                placeholder="CPF ou CNPJ"
                value={cpfCnpj}
                onChange={(event) => setCpfCnpj(event.target.value)}
                required
              />
            )}
            {formaPagamento === 'cartao_online' && (
              <>
                <input
                  type="email"
                  placeholder="E-mail para pagamento"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Número do endereço (opcional)"
                  value={numero}
                  onChange={(event) => setNumero(event.target.value)}
                />
              </>
            )}
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
            <textarea
              placeholder="Observação do pedido. Ex: sem cebola, pouco molho..."
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              rows={2}
            />
            {!lojaAberta && (
              <small style={{ color: 'var(--danger)' }}>
                O restaurante está fechado no momento — não é possível finalizar o pedido agora.
              </small>
            )}
            {erroEnvio && <small style={{ color: 'var(--danger)' }}>{erroEnvio}</small>}
            <button className="menu-finalizar-pro" type="submit" disabled={enviando || !lojaAberta}>
              {enviando ? 'Enviando...' : 'Finalizar pedido'}
            </button>
          </form>
        </aside>
      </section>

      {totalItensCarrinho > 0 && (
        <div className="mp-cartbar menu-cartbar-mobile">
          <button
            className="mp-cartbar-inner"
            type="button"
            onClick={() => carrinhoRef.current?.scrollIntoView({ block: 'start' })}
          >
            <div className="mp-cartbar-info">
              <small>{totalItensCarrinho} item(ns)</small>
              <strong>{formatarPreco(subtotalCarrinho)}</strong>
            </div>
            <span className="mp-cartbar-cta">Ver pedido</span>
          </button>
        </div>
      )}
      </div>
    </>
  )
}
