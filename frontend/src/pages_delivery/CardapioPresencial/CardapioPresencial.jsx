import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { resolveApiBase, resolveAssetUrl } from '../../utils/apiBase'
import { gerarPixCopiaECola } from '../../utils/pix'
import './cardapioPresencial.css'

const API_BASE = resolveApiBase()

/*
  VÍDEOS (pasta ../../../Video, mantenha o "V" maiúsculo):
  - principal.mp4 -> vídeo da abertura (se não existir, usa o primeiro .mp4 da pasta).
  - <id do produto>.mp4 (ex.: 12.mp4) -> vídeo daquele prato no lugar da foto.
  Formato ideal: MP4 (H.264), sem áudio, até 5 MB, de preferência vertical 9:16.
  Se o vídeo falhar, a foto cadastrada no admin aparece no lugar.
*/
const arquivosDeVideo = import.meta.glob('../../../Video/*.mp4', { eager: true, import: 'default' })
const videosPorNome = Object.fromEntries(
  Object.entries(arquivosDeVideo).map(([caminho, url]) => [caminho.split('/').pop().replace(/\.mp4$/i, ''), url]),
)
const videoPrincipal = videosPorNome.principal || Object.values(arquivosDeVideo)[0] || ''

const ORDEM_CATEGORIAS = ['Entradas', 'Principais', 'Lanches', 'Pizzas', 'Acompanhamentos', 'Porções', 'Sobremesas', 'Bebidas']
const MAX_DESTAQUES = 4
// Conta da mesa atualiza sozinha nesse intervalo (pedido de outra pessoa da mesa, caixa
// confirmando pagamento etc.).
const INTERVALO_CONTA_MS = 5000

const FORMAS_PAGAMENTO = [
  { id: 'pix', label: 'Pix' },
  { id: 'cartao', label: 'Cartão' },
  { id: 'dinheiro', label: 'Dinheiro' },
]

const formatarPreco = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Nome (e, na mesa, o id_cliente devolvido pelo backend) fica lembrado no aparelho pra quem
// pede mais de um prato não precisar digitar de novo.
const chaveCliente = (token) => (token ? `presencial_cliente_${token}` : 'presencial_cliente')

function lerJson(chave) {
  try {
    return JSON.parse(window.localStorage.getItem(chave)) || {}
  } catch {
    return {}
  }
}

function salvarJson(chave, valor) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    // sem localStorage: só não lembra na próxima vez
  }
}

/* Vídeo com fallback para foto (e para um quadro vazio se não houver foto). `ativo` controla play/pause. */
function Media({ produto, ativo = true, className = '' }) {
  const [erro, setErro] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (ativo) v.play().catch(() => {})
    else v.pause()
  }, [ativo, erro])

  if (produto.video && !erro) {
    return (
      <video
        ref={ref}
        className={className}
        src={produto.video}
        poster={produto.imagem || undefined}
        muted
        loop
        playsInline
        preload="metadata"
        onError={() => setErro(true)}
      />
    )
  }
  if (produto.imagem) {
    return <img className={className} src={produto.imagem} alt={produto.nome} loading="lazy" />
  }
  return (
    <span className={`${className} cp-sem-foto`} aria-hidden="true">
      {produto.nome?.charAt(0)}
    </span>
  )
}

/* Um vídeo vertical do carrossel; só toca quando está visível na tela. */
function Cena({ produto, abrir }) {
  const [visivel, setVisivel] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => setVisivel(e.intersectionRatio > 0.6), {
      threshold: [0, 0.6, 1],
    })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <button className="cp-cena" ref={ref} onClick={() => abrir(produto)}>
      <Media produto={produto} ativo={visivel} className="cp-cena-media" />
      <span className="cp-cena-texto">
        <small>{produto.selo}</small>
        <strong>{produto.nome}</strong>
        <span>{formatarPreco(produto.preco)}</span>
      </span>
    </button>
  )
}

/* Painel que sobe de baixo, usado pelo prato e pela conta. Arraste para baixo para fechar. */
function Painel({ fechar, arrastavel = true, children }) {
  const [dy, setDy] = useState(0)
  const inicio = useRef(null)
  const painel = useRef(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const toque = (e) => {
    // Com formulário aberto o arrastar fica desligado: fechar sem querer perderia o que foi digitado.
    if (!arrastavel) return
    if (painel.current.scrollTop <= 0) inicio.current = e.touches[0].clientY
  }
  const move = (e) => {
    if (inicio.current === null) return
    setDy(Math.max(0, e.touches[0].clientY - inicio.current))
  }
  const solta = () => {
    if (dy > 110) fechar()
    setDy(0)
    inicio.current = null
  }

  return (
    <div className="cp-modal" onClick={fechar}>
      <div
        ref={painel}
        className="cp-painel"
        role="dialog"
        aria-modal="true"
        style={{ transform: `translateY(${dy}px)`, transition: dy ? 'none' : undefined }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={toque}
        onTouchMove={move}
        onTouchEnd={solta}
      >
        <span className="cp-alca" />
        {children}
      </div>
    </div>
  )
}

/*
  Formulário do "Pedir comida".
  - Com mesa (token): o pedido entra na conta da mesa e vai direto pra cozinha.
  - Sem mesa: vira um pedido de balcão em /pedidos, pago no caixa.
*/
function FormPedido({ produto, token, voltar, aoEnviar }) {
  const salvo = useMemo(() => lerJson(chaveCliente(token)), [token])
  const [qtd, setQtd] = useState(1)
  const [nome, setNome] = useState(salvo.nome || '')
  const [pagamento, setPagamento] = useState('pix')
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) {
      setErro('Informe seu nome para chamarmos quando o pedido ficar pronto.')
      return
    }
    setEnviando(true)
    setErro('')

    const notaLimpa = nota.trim() || null
    const url = token ? `${API_BASE}/mesa/${token}/pedidos` : `${API_BASE}/presencial/pedidos`
    const corpo = token
      ? {
          // Mesmo nome de antes -> reaproveita o cliente; nome diferente -> outra pessoa da mesa.
          ...(salvo.idCliente && salvo.nome === nomeLimpo ? { id_cliente: salvo.idCliente } : { nome: nomeLimpo }),
          items: [{ id_produto: produto.id, qty: qtd, note: notaLimpa }],
        }
      : {
          nome: nomeLimpo,
          payment_method: pagamento,
          note: notaLimpa,
          items: [{ id_produto: produto.id, qty: qtd }],
        }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(corpo),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setErro(data.message || 'Não foi possível enviar o pedido. Tente de novo.')
        return
      }
      salvarJson(chaveCliente(token), { nome: nomeLimpo, idCliente: data.id_cliente ?? salvo.idCliente })
      aoEnviar({
        numero: token ? data.id_pedido : data.number,
        total: produto.preco * qtd,
        qtd,
        comanda: token ? data : null,
      })
    } catch {
      setErro('Não foi possível conectar ao restaurante.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="cp-form" onSubmit={enviar}>
      <div className="cp-painel-corpo">
        <span className="cp-rotulo">Seu pedido</span>
        <h2>{produto.nome}</h2>

        <div className="cp-qtd">
          <button type="button" onClick={() => setQtd((q) => Math.max(1, q - 1))} aria-label="Diminuir quantidade">
            −
          </button>
          <span>{qtd}</span>
          <button type="button" onClick={() => setQtd((q) => Math.min(50, q + 1))} aria-label="Aumentar quantidade">
            +
          </button>
        </div>

        <label className="cp-campo">
          <span>Seu nome *</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={150} autoComplete="name" required />
        </label>

        {!token && (
          <div className="cp-campo">
            <span>Pagamento no caixa</span>
            <div className="cp-abas cp-abas-form">
              {FORMAS_PAGAMENTO.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={pagamento === f.id ? 'cp-on' : ''}
                  onClick={() => setPagamento(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="cp-campo">
          <span>Observação (opcional)</span>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} rows={2} placeholder="Ex.: sem cebola" />
        </label>

        <div className="cp-painel-preco">{formatarPreco(produto.preco * qtd)}</div>
        {token && <p className="cp-dica">Vai para a conta da mesa. O pagamento é feito no final.</p>}
        {erro && <p className="cp-erro">{erro}</p>}
      </div>
      <div className="cp-painel-acao">
        <button type="submit" className="cp-botao" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Confirmar pedido'}
        </button>
        <button type="button" className="cp-voltar" onClick={voltar}>
          Voltar
        </button>
      </div>
    </form>
  )
}

/* Painel do prato: detalhe -> formulário -> confirmação. */
function ModalProduto({ produto, token, fechar, contaFechada, aoPedir, etapaInicial = 'detalhe' }) {
  const [etapa, setEtapa] = useState(etapaInicial)
  const [enviado, setEnviado] = useState(null)
  const ingredientes = produto.ingredientes || []
  const contem = produto.contem || []

  return (
    <Painel fechar={fechar} arrastavel={etapa !== 'pedido'}>
      <Media produto={produto} className={etapa === 'detalhe' ? 'cp-painel-media' : 'cp-painel-media cp-menor'} />

      {etapa === 'pedido' && (
        <FormPedido
          produto={produto}
          token={token}
          voltar={() => (etapaInicial === 'pedido' ? fechar() : setEtapa('detalhe'))}
          aoEnviar={(info) => {
            setEnviado(info)
            setEtapa('enviado')
            aoPedir(info)
          }}
        />
      )}

      {etapa === 'enviado' && enviado && (
        <>
          <div className="cp-painel-corpo cp-sucesso">
            <span className="cp-orna" />
            <span className="cp-rotulo">{token ? 'Adicionado ao pedido da mesa' : 'Pedido recebido'}</span>
            <h2>
              Pedido <em>#{enviado.numero}</em> {token ? 'atualizado!' : 'enviado!'}
            </h2>
            <p>
              {enviado.qtd}× {produto.nome} · {formatarPreco(enviado.total)}
            </p>
            {token ? (
              <p>
                A cozinha já recebeu e o valor entrou na conta da mesa
                {enviado.comanda ? ` (total agora: ${formatarPreco(enviado.comanda.total)})` : ''}.
              </p>
            ) : (
              <p>A cozinha já recebeu. Chamaremos pelo seu nome quando estiver pronto. O pagamento é feito no caixa.</p>
            )}
          </div>
          <div className="cp-painel-acao">
            <button type="button" className="cp-botao" onClick={fechar}>
              Voltar ao cardápio
            </button>
          </div>
        </>
      )}

      {etapa === 'detalhe' && (
        <>
          <div className="cp-painel-corpo">
            <h2>{produto.nome}</h2>
            {produto.descricao && <p>{produto.descricao}</p>}

            {ingredientes.length > 0 && (
              <div className="cp-ingredientes">
                <span className="cp-rotulo">Ingredientes</span>
                <ul>
                  {ingredientes.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                {contem.length > 0 && (
                  <p className="cp-contem">
                    <span>Contém</span> {contem.join(' · ')}
                  </p>
                )}
              </div>
            )}

            <div className="cp-painel-preco">{formatarPreco(produto.preco)}</div>
            {contaFechada && <p className="cp-dica">A conta desta mesa já foi pedida. Para pedir mais, chame o garçom.</p>}
          </div>
          <div className="cp-painel-acao">
            <button type="button" className="cp-botao" onClick={() => setEtapa('pedido')} disabled={contaFechada}>
              Pedir comida
            </button>
            <button type="button" className="cp-voltar" onClick={fechar}>
              Voltar ao cardápio
            </button>
          </div>
        </>
      )}
    </Painel>
  )
}

/* Extrato da conta da mesa (tempo real) + "Pedir a conta". */
function ModalConta({ token, mesa, empresa, comanda, fechar, aoAtualizar }) {
  const [pagamento, setPagamento] = useState('pix')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [qrPix, setQrPix] = useState('')

  const aguardando = comanda?.status === 'AGUARDANDO_PAGAMENTO'
  const consumo = comanda?.consumo || []
  const formaEscolhida = (comanda?.forma_pagamento || '').toLowerCase()
  const pixPayload = useMemo(() => {
    if (!aguardando || formaEscolhida !== 'pix' || !empresa?.chave_pix || !comanda?.total) return ''
    return gerarPixCopiaECola({ chave: empresa.chave_pix, nome: empresa.nome || 'Restaurante', valor: comanda.total })
  }, [aguardando, formaEscolhida, empresa?.chave_pix, empresa?.nome, comanda?.total])

  useEffect(() => {
    if (!pixPayload) return undefined
    let cancelado = false
    QRCode.toDataURL(pixPayload, { width: 220, margin: 1 }).then((url) => {
      if (!cancelado) setQrPix(url)
    })
    return () => {
      cancelado = true
    }
  }, [pixPayload])

  const pedirConta = async () => {
    setEnviando(true)
    setErro('')
    try {
      const response = await fetch(`${API_BASE}/mesa/${token}/fechar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ forma_pagamento: pagamento }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setErro(data.message || 'Não foi possível pedir a conta.')
        return
      }
      aoAtualizar(data)
    } catch {
      setErro('Não foi possível conectar ao restaurante.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel fechar={fechar}>
      <div className="cp-painel-corpo cp-conta">
        <span className="cp-rotulo">Mesa {mesa?.numero} · {aguardando ? 'Conta pedida' : 'Conta aberta'}</span>
        <h2>
          Sua <em>conta</em>
        </h2>

        {consumo.length === 0 ? (
          <p>Nenhum pedido ainda. Escolha um prato no cardápio e toque em “Pedir comida”.</p>
        ) : (
          <ul className="cp-extrato">
            {consumo.map((item) => (
              <li key={`${item.id_produto}-${item.preco}`}>
                <span className="cp-extrato-qtd">{item.qty}×</span>
                <span className="cp-extrato-nome">
                  {item.nome}
                  <small>{formatarPreco(item.preco)} cada</small>
                </span>
                <span className="cp-extrato-valor">{formatarPreco(item.subtotal)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="cp-painel-preco cp-conta-total">
          <span>Total</span>
          {formatarPreco(comanda?.total || 0)}
        </div>

        {aguardando ? (
          <div className="cp-conta-aguardando">
            <p>
              Conta pedida ({FORMAS_PAGAMENTO.find((f) => f.id === formaEscolhida)?.label || 'pagamento'}). O caixa
              vai confirmar o pagamento e liberar a mesa.
            </p>
            {qrPix && (
              <>
                <img src={qrPix} alt="QR Code Pix" width={200} height={200} />
                <code className="cp-pix-codigo">{pixPayload}</code>
              </>
            )}
          </div>
        ) : (
          consumo.length > 0 && (
            <div className="cp-campo">
              <span>Como vai pagar?</span>
              <div className="cp-abas cp-abas-form">
                {FORMAS_PAGAMENTO.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={pagamento === f.id ? 'cp-on' : ''}
                    onClick={() => setPagamento(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )
        )}
        {erro && <p className="cp-erro">{erro}</p>}
      </div>
      <div className="cp-painel-acao">
        {!aguardando && consumo.length > 0 && (
          <button type="button" className="cp-botao" onClick={pedirConta} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Pedir a conta'}
          </button>
        )}
        <button type="button" className="cp-voltar" onClick={fechar}>
          Voltar ao cardápio
        </button>
      </div>
    </Painel>
  )
}

export default function CardapioPresencial() {
  // /presencial -> cardápio do salão (pedido de balcão, pago no caixa).
  // /presencial/<token da mesa> -> QR da mesa: ocupa a mesa e os pedidos entram na conta dela.
  const token = window.location.pathname.match(/^\/presencial\/([^/]+)\/?$/)?.[1] || ''

  const [empresa, setEmpresa] = useState(null)
  const [mesa, setMesa] = useState(null)
  const [comanda, setComanda] = useState(null)
  const [contaPaga, setContaPaga] = useState(false)
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [categoria, setCategoria] = useState('')
  const [aberto, setAberto] = useState(null)
  const [contaAberta, setContaAberta] = useState(false)
  const [indice, setIndice] = useState(0)
  const trilho = useRef(null)

  // Fundo preto na página inteira (inclusive o "elástico" do scroll no celular) só enquanto
  // este cardápio está aberto - o body global do sistema usa o tema claro/escuro do admin.
  useEffect(() => {
    document.documentElement.classList.add('cp-pagina')
    return () => document.documentElement.classList.remove('cp-pagina')
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      // Mesa: POST /ocupar abre a comanda e marca a mesa como ocupada no momento da leitura do QR.
      const response = token
        ? await fetch(`${API_BASE}/mesa/${token}/ocupar`, { method: 'POST', headers: { Accept: 'application/json' } })
        : await fetch(`${API_BASE}/pedir`, { headers: { Accept: 'application/json' } })
      if (!response.ok) {
        setErro(token ? 'Mesa não encontrada. Confira o QR Code.' : 'Cardápio indisponível no momento.')
        return
      }
      const data = await response.json()
      setEmpresa(data.empresa || null)
      setMesa(data.mesa || null)
      setComanda(data.comanda || null)
      setContaPaga(false)
      setProdutos(
        (data.produtos || []).map((p) => ({
          ...p,
          categoria: p.categoria || 'Outros',
          imagem: p.imagem ? resolveAssetUrl(p.imagem) : '',
          video: videosPorNome[String(p.id)] || '',
        })),
      )
      setErro('')
    } catch {
      setErro('Não foi possível conectar ao restaurante.')
    } finally {
      setCarregando(false)
    }
  }, [token])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Atualiza a conta da mesa em segundo plano. Usa o GET (não o /ocupar) pra não reabrir a
  // mesa sozinho depois que o caixa confirmou o pagamento.
  useEffect(() => {
    if (!token || erro || carregando) return undefined
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/mesa/${token}`, { headers: { Accept: 'application/json' } })
        if (!response.ok) return
        const data = await response.json()
        setComanda((anterior) => {
          if (anterior && !data.comanda) setContaPaga(true)
          return data.comanda || null
        })
      } catch {
        // sem rede agora: tenta de novo no próximo ciclo
      }
    }, INTERVALO_CONTA_MS)
    return () => clearInterval(timer)
  }, [token, erro, carregando])

  const categorias = useMemo(() => {
    const existentes = [...new Set(produtos.map((p) => p.categoria))]
    const posicao = (c) => {
      const i = ORDEM_CATEGORIAS.indexOf(c)
      return i === -1 ? ORDEM_CATEGORIAS.length : i
    }
    return existentes.sort((a, b) => posicao(a) - posicao(b))
  }, [produtos])

  // Destaques: prioriza quem tem vídeo, depois quem tem foto - prato sem imagem não
  // funciona num carrossel visual.
  const destaques = useMemo(() => {
    const comVideo = produtos.filter((p) => p.video)
    const comFoto = produtos.filter((p) => !p.video && p.imagem)
    return [...comVideo, ...comFoto].slice(0, MAX_DESTAQUES).map((p) => ({ ...p, selo: p.categoria }))
  }, [produtos])

  const categoriaAtual = categorias.includes(categoria) ? categoria : categorias[0]
  const lista = produtos.filter((p) => p.categoria === categoriaAtual)
  const contaFechada = comanda?.status === 'AGUARDANDO_PAGAMENTO'
  const qtdItensConta = (comanda?.consumo || []).reduce((soma, item) => soma + item.qty, 0)

  const aoRolar = () => {
    const t = trilho.current
    if (!t?.firstElementChild) return
    const passo = t.firstElementChild.offsetWidth + 12
    setIndice(Math.round(t.scrollLeft / passo))
  }
  const irPara = (i) => {
    const t = trilho.current
    if (!t?.firstElementChild) return
    t.scrollTo({ left: i * (t.firstElementChild.offsetWidth + 12), behavior: 'smooth' })
  }

  /* Animação suave de entrada dos elementos ao rolar */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('cp-visivel')
            obs.unobserve(e.target)
          }
        }),
      { threshold: 0.15 },
    )
    document.querySelectorAll('.cp-rev:not(.cp-visivel)').forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [categoriaAtual, produtos])

  const nomeRestaurante = empresa?.nome || "CHEF'S Hub"
  const heroProduto = { nome: nomeRestaurante, imagem: destaques[0]?.imagem || '', video: videoPrincipal }

  return (
    <div className="cp-site">
      <nav className="cp-topo">
        <a href="#inicio" className="cp-logo">
          CHEF'S <em>Hub</em>
        </a>
        {mesa ? (
          <button type="button" className="cp-botao cp-pequeno" onClick={() => setContaAberta(true)}>
            Mesa {mesa.numero}
          </button>
        ) : (
          <a href="#menu" className="cp-botao cp-pequeno">
            Cardápio
          </a>
        )}
      </nav>

      <header className="cp-hero" id="inicio">
        <Media produto={heroProduto} className="cp-hero-media" />
        <div className="cp-hero-sombra" />
      </header>

      <section className="cp-hero-texto">
        <span className="cp-rotulo">
          {mesa ? `Bem-vindo · Mesa ${mesa.numero}` : `${empresa?.nome || 'Restaurante'} · Desde 2026`}
        </span>
        <h1>
          Comida que <em>merece</em> ser vista.
        </h1>
        <p>Terça a domingo, das 18h às 23h.</p>
        <a href={destaques.length ? '#destaques' : '#menu'} className="cp-botao cp-cheio">
          Ver os melhores pratos
        </a>
      </section>

      {carregando && <p className="cp-aviso">Carregando o cardápio…</p>}

      {!carregando && erro && (
        <div className="cp-aviso">
          <p>{erro}</p>
          <button type="button" className="cp-botao cp-pequeno" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {contaPaga && (
        <div className="cp-aviso cp-aviso-pago">
          <p>Conta paga e mesa liberada. Obrigado pela visita!</p>
          <button type="button" className="cp-botao cp-pequeno" onClick={carregar}>
            Abrir nova conta
          </button>
        </div>
      )}

      {!carregando && !erro && destaques.length > 0 && (
        <section className="cp-destaques" id="destaques">
          <span className="cp-rotulo cp-rev">Seleção do chef</span>
          <h2 className="cp-rev">
            Os melhores <em>pratos</em> da casa
          </h2>
          <div className="cp-trilho" ref={trilho} onScroll={aoRolar}>
            {destaques.map((p) => (
              <Cena key={p.id} produto={p} abrir={setAberto} />
            ))}
          </div>
          <div className="cp-pontos">
            {destaques.map((p, i) => (
              <button
                key={p.id}
                className={i === indice ? 'cp-on' : ''}
                onClick={() => irPara(i)}
                aria-label={`Ir para ${p.nome}`}
              />
            ))}
          </div>
        </section>
      )}

      {!carregando && !erro && (
        <section className="cp-menu" id="menu">
          <span className="cp-rotulo cp-rev">Nossa mesa</span>
          <h2 className="cp-rev">
            O <em>cardápio</em>
          </h2>
          <div className="cp-abas">
            {categorias.map((c) => (
              <button key={c} className={c === categoriaAtual ? 'cp-on' : ''} onClick={() => setCategoria(c)}>
                {c}
              </button>
            ))}
          </div>

          {lista.length === 0 && <p className="cp-aviso">Nenhum prato disponível agora.</p>}

          <ul className="cp-lista">
            {lista.map((p) => (
              <li key={p.id} className="cp-rev">
                <div className="cp-item">
                  <button className="cp-item-abrir" onClick={() => setAberto(p)}>
                    <span className="cp-item-texto">
                      <h3>{p.nome}</h3>
                      {p.descricao && <p>{p.descricao}</p>}
                    </span>
                    <Media produto={p} ativo={false} className="cp-item-media" />
                  </button>
                  <div className="cp-item-rodape">
                    <span className="cp-linha-preco">{formatarPreco(p.preco)}</span>
                    <button
                      type="button"
                      className="cp-botao cp-pequeno"
                      onClick={() => setAberto({ ...p, etapa: 'pedido' })}
                      disabled={contaFechada}
                    >
                      Pedir
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cp-frase cp-rev">
        <span className="cp-orna" />
        <h2>
          Boa comida não precisa <em>de explicação.</em>
        </h2>
      </section>

      <footer className="cp-rodape" id="contato">
        <h2>
          CHEF'S <em>Hub</em>
        </h2>
        <p>Rua Exemplo, 123 · Centro</p>
        <p>Terça a domingo, 18h às 23h</p>
        <p>@chefshub</p>
        <small>© 2026 {nomeRestaurante}</small>
      </footer>

      {mesa && comanda && (
        <div className="cp-pedido-barra">
          <button type="button" className="cp-botao cp-cheio cp-barra-conta" onClick={() => setContaAberta(true)}>
            <span>
              Mesa {mesa.numero} · {contaFechada ? 'conta pedida' : `${qtdItensConta} ${qtdItensConta === 1 ? 'item' : 'itens'}`}
            </span>
            <strong>{formatarPreco(comanda.total || 0)}</strong>
          </button>
        </div>
      )}

      {aberto && (
        <ModalProduto
          produto={aberto}
          token={token}
          fechar={() => setAberto(null)}
          contaFechada={contaFechada}
          etapaInicial={aberto.etapa}
          aoPedir={(info) => {
            if (info.comanda) setComanda(info.comanda)
          }}
        />
      )}

      {contaAberta && mesa && (
        <ModalConta
          token={token}
          mesa={mesa}
          empresa={empresa}
          comanda={comanda}
          fechar={() => setContaAberta(false)}
          aoAtualizar={setComanda}
        />
      )}
    </div>
  )
}
