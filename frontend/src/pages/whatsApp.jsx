import React, { useCallback, useEffect, useRef, useState } from 'react'

const STATUS_LABEL = {
  open: 'Conectado',
  connecting: 'Aguardando leitura do QR Code',
  close: 'Desconectado',
  inexistente: 'Nenhuma instancia criada',
}

const STATUS_BADGE = {
  open: 'badge-green',
  connecting: 'badge-orange badge-blink',
  close: 'badge-red',
  inexistente: 'badge-muted',
}

const formatTelefone = (numero) => {
  if (!numero) return '-'
  const digitos = String(numero).replace(/\D/g, '')
  const semDdi = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos
  const ddd = semDdi.slice(0, 2)
  const restante = semDdi.slice(2)
  if (restante.length === 9) return `(${ddd}) ${restante.slice(0, 5)}-${restante.slice(5)}`
  if (restante.length === 8) return `(${ddd}) ${restante.slice(0, 4)}-${restante.slice(4)}`
  return numero
}

const formatData = (iso) => {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return '-'
  }
}

const formatHora = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const TIPO_PREVIEW = {
  stickerMessage: 'Figurinha',
  imageMessage: 'Imagem',
  videoMessage: 'Video',
  audioMessage: 'Audio',
  documentMessage: 'Documento',
  locationMessage: 'Localizacao',
  contactMessage: 'Contato',
}

const formatPreview = (conversa) => {
  const texto = conversa.ultima_mensagem || TIPO_PREVIEW[conversa.tipo] || 'Mensagem'
  return conversa.direcao === 'SAIDA' ? `Voce: ${texto}` : texto
}

const formatConteudoMensagem = (mensagem) => {
  // O nome exato do campo de texto pode variar conforme a API (texto, mensagem, conteudo,
  // corpo, body, message, content...). Tentamos os candidatos mais comuns antes de cair
  // no rotulo do tipo de midia ou num generico "Mensagem".
  const texto =
    mensagem.texto ??
    mensagem.mensagem ??
    mensagem.conteudo ??
    mensagem.corpo ??
    mensagem.body ??
    mensagem.message ??
    mensagem.content ??
    mensagem.ultima_mensagem
  return texto || TIPO_PREVIEW[mensagem.tipo] || 'Mensagem'
}

export default function WhatsApp({
  onFetchStatus,
  onCriarInstancia,
  onGerarQrCode,
  onDesconectar,
  onReconectar,
  onFetchConversas,
  onFetchMensagens,
  onEnviarMensagem,
}) {
  const [dados, setDados] = useState({ existe: false, status: 'inexistente' })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [conversas, setConversas] = useState([])
  const [conversasLoading, setConversasLoading] = useState(true)
  const [telefoneSelecionado, setTelefoneSelecionado] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [mensagensLoading, setMensagensLoading] = useState(false)
  const [textoEnvio, setTextoEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')
  const pollRef = useRef(null)
  const pollConversasRef = useRef(null)
  const pollMensagensRef = useRef(null)
  const mensagensFimRef = useRef(null)

  const carregarStatus = useCallback(async () => {
    const resultado = await onFetchStatus()
    // O endpoint de status nao devolve QR Code (so o de /qrcode devolve). Sem isso, cada
    // poll de status (a cada 5s, enquanto aguarda leitura) apagava o QR Code que ja estava
    // na tela antes mesmo dele expirar de verdade, dando so ~5s pra escanear.
    if (resultado) {
      setDados((anterior) => ({
        ...resultado,
        qrcode: resultado.qrcode ?? (resultado.status !== 'open' ? anterior.qrcode : null),
      }))
    }
    return resultado
  }, [onFetchStatus])

  const carregarConversas = useCallback(async () => {
    const resultado = await onFetchConversas()
    if (resultado?.data) setConversas(resultado.data)
  }, [onFetchConversas])

  const carregarMensagens = useCallback(
    async (telefone, { silencioso = false } = {}) => {
      if (!telefone) return
      if (!silencioso) setMensagensLoading(true)
      const resultado = await onFetchMensagens(telefone)
      if (resultado?.data) setMensagens(resultado.data)
      if (!silencioso) setMensagensLoading(false)
    },
    [onFetchMensagens],
  )

  const abrirConversa = (telefone) => {
    if (telefone === telefoneSelecionado) return
    setTelefoneSelecionado(telefone)
    setErroEnvio('')
    setMensagens([])
    carregarMensagens(telefone)
  }

  const handleEnviarMensagem = async (event) => {
    event.preventDefault()
    const texto = textoEnvio.trim()
    if (!texto || !telefoneSelecionado) return

    setErroEnvio('')
    setEnviando(true)
    const resultado = await onEnviarMensagem(telefoneSelecionado, texto)
    setEnviando(false)

    if (!resultado?.ok) {
      setErroEnvio(resultado?.message || 'Nao foi possivel enviar a mensagem.')
      return
    }

    setTextoEnvio('')
    if (resultado.data?.data) setMensagens(resultado.data.data)
    carregarConversas()
  }

  useEffect(() => {
    setLoading(true)
    carregarStatus().finally(() => setLoading(false))
    setConversasLoading(true)
    carregarConversas().finally(() => setConversasLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Enquanto a instancia nao estiver conectada (aguardando leitura do QR), fica consultando
  // o status periodicamente pra detectar sozinho quando o WhatsApp for pareado no celular.
  useEffect(() => {
    const devePoll = dados.existe && dados.status !== 'open'
    if (!devePoll) {
      clearInterval(pollRef.current)
      return undefined
    }

    pollRef.current = setInterval(() => {
      carregarStatus()
    }, 5000)

    return () => clearInterval(pollRef.current)
  }, [dados.existe, dados.status, carregarStatus])

  // Com o WhatsApp conectado, atualiza a lista de conversas periodicamente pra novas
  // mensagens recebidas via Webhook aparecerem sem precisar recarregar a pagina.
  useEffect(() => {
    if (dados.status !== 'open') {
      clearInterval(pollConversasRef.current)
      return undefined
    }

    pollConversasRef.current = setInterval(() => {
      carregarConversas()
    }, 15000)

    return () => clearInterval(pollConversasRef.current)
  }, [dados.status, carregarConversas])

  // Com uma conversa aberta, fica consultando as mensagens dela periodicamente (de forma
  // silenciosa, sem re-exibir o "Carregando...") pra novas mensagens aparecerem sozinhas.
  useEffect(() => {
    if (!telefoneSelecionado || dados.status !== 'open') {
      clearInterval(pollMensagensRef.current)
      return undefined
    }

    pollMensagensRef.current = setInterval(() => {
      carregarMensagens(telefoneSelecionado, { silencioso: true })
    }, 5000)

    return () => clearInterval(pollMensagensRef.current)
  }, [telefoneSelecionado, dados.status, carregarMensagens])

  // Rola a conversa para o final sempre que novas mensagens chegam ou uma conversa e aberta.
  useEffect(() => {
    mensagensFimRef.current?.scrollIntoView({ block: 'end' })
  }, [mensagens])

  const executarAcao = async (acao) => {
    setError('')
    setActionLoading(true)
    const resultado = await acao()
    setActionLoading(false)

    if (!resultado?.ok) {
      setError(resultado?.message || 'Nao foi possivel completar a acao.')
      return
    }
    if (resultado.data) setDados(resultado.data)
  }

  const handleCriarInstancia = () => executarAcao(onCriarInstancia)
  const handleGerarQrCode = () => executarAcao(onGerarQrCode)
  const handleReconectar = () => executarAcao(onReconectar)
  const handleDesconectar = () => executarAcao(onDesconectar)
  const handleAtualizar = () =>
    executarAcao(async () => {
      const [statusAtual] = await Promise.all([carregarStatus(), carregarConversas()])
      return { ok: true, data: statusAtual }
    })

  const status = dados.status || 'inexistente'
  const conectado = status === 'open'

  return (
    <section className="page-grid">
      <div className="page-stack">
        <article className="card section-card fade-in" style={{ '--i': 0 }}>
          <div className="section-head">
            <div>
              <h2>WhatsApp</h2>
              <p>Conecte o WhatsApp da sua empresa para atender clientes e automatizar avisos de pedido.</p>
            </div>
            <span className={`badge ${STATUS_BADGE[status] ?? 'badge-muted'}`}>
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>

          {loading ? (
            <p>Carregando...</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="mini-grid">
                <div className="info-tile">
                  <span>Numero conectado</span>
                  <strong>{formatTelefone(dados.numero)}</strong>
                </div>
                <div className="info-tile">
                  <span>Instancia</span>
                  <strong>{dados.instancia || '-'}</strong>
                </div>
                <div className="info-tile">
                  <span>Conectado desde</span>
                  <strong>{conectado ? formatData(dados.dt_conectado) : '-'}</strong>
                </div>
              </div>

              {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

              {!dados.existe && (
                <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
                  <p>Nenhuma instancia foi criada ainda para esta empresa.</p>
                  <button className="btn btn-primary" type="button" disabled={actionLoading} onClick={handleCriarInstancia}>
                    {actionLoading ? 'Criando...' : 'Conectar WhatsApp'}
                  </button>
                </div>
              )}

              {dados.existe && !conectado && (
                <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
                  {dados.qrcode ? (
                    <>
                      <img
                        src={dados.qrcode}
                        alt="QR Code para conectar o WhatsApp"
                        style={{ width: 220, height: 220, borderRadius: 12, border: '1px solid var(--line)' }}
                      />
                      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--muted)' }}>
                        <li>Abra o WhatsApp no celular da empresa.</li>
                        <li>Toque em Mais opcoes (ou Configuracoes) &gt; Aparelhos conectados.</li>
                        <li>Toque em Conectar um aparelho e aponte a camera para o QR Code acima.</li>
                      </ol>
                    </>
                  ) : (
                    <p>Gere um QR Code para conectar o WhatsApp pelo celular.</p>
                  )}
                  <button className="btn btn-primary" type="button" disabled={actionLoading} onClick={handleGerarQrCode}>
                    {actionLoading ? 'Gerando...' : dados.qrcode ? 'Gerar novo QR Code' : 'Gerar QR Code'}
                  </button>
                </div>
              )}

              {conectado && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-light" type="button" disabled={actionLoading} onClick={handleAtualizar}>
                    Atualizar status
                  </button>
                  <button className="btn btn-light" type="button" disabled={actionLoading} onClick={handleReconectar}>
                    Reconectar
                  </button>
                  <button className="btn btn-light" type="button" disabled={actionLoading} onClick={handleDesconectar}>
                    Desconectar
                  </button>
                </div>
              )}
            </div>
          )}
        </article>

        <article className="card section-card fade-in" style={{ '--i': 1 }}>
          <div className="section-head">
            <div>
              <h2>Conversas</h2>
              <p>Contatos que ja escreveram para o WhatsApp da empresa.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: telefoneSelecionado ? 'minmax(220px, 320px) 1fr' : '1fr', gap: 16 }}>
            {conversasLoading ? (
              <p>Carregando...</p>
            ) : conversas.length === 0 ? (
              <p>Nenhuma conversa ainda. Assim que um cliente escrever, ele aparece aqui.</p>
            ) : (
              <div className="data-table">
                {conversas.map((conversa) => {
                  const selecionada = conversa.telefone === telefoneSelecionado
                  const naoRespondida = conversa.nao_respondida
                  return (
                    <div
                      className={`data-row${selecionada ? ' data-row-active' : ''}`}
                      key={conversa.telefone}
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirConversa(conversa.telefone)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') abrirConversa(conversa.telefone)
                      }}
                      style={{
                        gridTemplateColumns: '1fr',
                        gap: 4,
                        alignItems: 'start',
                        cursor: 'pointer',
                        background: selecionada ? 'var(--surface-active, rgba(0,0,0,0.04))' : undefined,
                        borderRadius: 10,
                        borderLeft: naoRespondida ? '3px solid var(--danger)' : '3px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {naoRespondida && (
                            <span
                              title="Aguardando resposta"
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: 'var(--danger)',
                                display: 'inline-block',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <strong>{conversa.nome || formatTelefone(conversa.telefone)}</strong>
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {formatData(conversa.dt_mensagem)}
                        </span>
                      </div>
                      {conversa.nome && (
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatTelefone(conversa.telefone)}</span>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{formatPreview(conversa)}</span>
                        {naoRespondida && (
                          <span
                            title={`${conversa.mensagens_pendentes} mensagem(ns) sem resposta`}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#fff',
                              background: 'var(--danger)',
                              borderRadius: 999,
                              padding: '2px 7px',
                              flexShrink: 0,
                            }}
                          >
                            {conversa.mensagens_pendentes}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {telefoneSelecionado && (
              <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 12, minHeight: 360, maxHeight: 480 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
                  {(() => {
                    const nomeContato = conversas.find((c) => c.telefone === telefoneSelecionado)?.nome
                    return (
                      <>
                        <strong>{nomeContato || formatTelefone(telefoneSelecionado)}</strong>
                        {nomeContato && (
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatTelefone(telefoneSelecionado)}</div>
                        )}
                      </>
                    )
                  })()}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'grid', gap: 8, alignContent: 'start' }}>
                  {mensagensLoading ? (
                    <p>Carregando mensagens...</p>
                  ) : mensagens.length === 0 ? (
                    <p style={{ color: 'var(--muted)' }}>Nenhuma mensagem nesta conversa ainda.</p>
                  ) : (
                    mensagens.map((mensagem, indice) => {
                      const enviadaPorNos = mensagem.direcao === 'SAIDA'
                      return (
                        <div
                          key={mensagem.id ?? indice}
                          style={{
                            justifySelf: enviadaPorNos ? 'end' : 'start',
                            maxWidth: '75%',
                            background: enviadaPorNos ? 'var(--accent-3)' : 'var(--panel-soft)',
                            color: 'var(--text)',
                            border: '1px solid var(--line)',
                            borderRadius: 12,
                            padding: '8px 12px',
                          }}
                        >
                          <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {formatConteudoMensagem(mensagem)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 2 }}>
                            {formatHora(mensagem.dt_mensagem)}
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={mensagensFimRef} />
                </div>

                {erroEnvio && (
                  <p style={{ color: 'var(--danger)', fontSize: 13, padding: '0 14px' }}>{erroEnvio}</p>
                )}

                <form
                  onSubmit={handleEnviarMensagem}
                  style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--line)' }}
                >
                  <input
                    type="text"
                    value={textoEnvio}
                    onChange={(event) => setTextoEnvio(event.target.value)}
                    placeholder="Escreva uma mensagem"
                    disabled={enviando}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)' }}
                  />
                  <button className="btn btn-primary" type="submit" disabled={enviando || !textoEnvio.trim()}>
                    {enviando ? 'Enviando...' : 'Enviar'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}