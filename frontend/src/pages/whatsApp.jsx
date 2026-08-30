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

export default function WhatsApp({
  onFetchStatus,
  onCriarInstancia,
  onGerarQrCode,
  onDesconectar,
  onReconectar,
  onFetchConversas,
}) {
  const [dados, setDados] = useState({ existe: false, status: 'inexistente' })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [conversas, setConversas] = useState([])
  const [conversasLoading, setConversasLoading] = useState(true)
  const pollRef = useRef(null)
  const pollConversasRef = useRef(null)

  const carregarStatus = useCallback(async () => {
    const resultado = await onFetchStatus()
    if (resultado) setDados(resultado)
    return resultado
  }, [onFetchStatus])

  const carregarConversas = useCallback(async () => {
    const resultado = await onFetchConversas()
    if (resultado?.data) setConversas(resultado.data)
  }, [onFetchConversas])

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
                      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-muted)' }}>
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

          {conversasLoading ? (
            <p>Carregando...</p>
          ) : conversas.length === 0 ? (
            <p>Nenhuma conversa ainda. Assim que um cliente escrever, ele aparece aqui.</p>
          ) : (
            <div className="data-table">
              {conversas.map((conversa) => (
                <div
                  className="data-row"
                  key={conversa.telefone}
                  style={{ gridTemplateColumns: '1fr', gap: 4, alignItems: 'start' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{conversa.nome || formatTelefone(conversa.telefone)}</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatData(conversa.dt_mensagem)}
                    </span>
                  </div>
                  {conversa.nome && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTelefone(conversa.telefone)}</span>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatPreview(conversa)}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
