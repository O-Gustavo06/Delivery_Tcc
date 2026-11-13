import React, { useCallback, useEffect, useRef, useState } from 'react'
import './FiscalContabil.css'
import FiscalXmlRascunho from './FiscalXmlRascunho.jsx'

const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
const status = ['RASCUNHO', 'AUTORIZADA', 'CANCELADA', 'REJEITADA']
const rotulosFiscais = {
  ncm: 'NCM', cest: 'CEST', cfop: 'CFOP', cst_csosn: 'CST/CSOSN', origem: 'Origem',
  aliquota_icms: 'ICMS (%)', aliquota_pis: 'PIS (%)', aliquota_cofins: 'COFINS (%)',
  aliquota_ipi: 'IPI (%)', informacoes_adicionais: 'Informações adicionais',
}

export default function FiscalContabil({ requestFiscal }) {
  const [config, setConfig] = useState(null)
  const [lista, setLista] = useState(null)
  const [filtro, setFiltro] = useState({ direcao: '', status: '' })
  const [pagina, setPagina] = useState(1)
  const [rascunho, setRascunho] = useState({ modelo: 'NFCE', direcao: 'SAIDA', origem: '' })
  const [detalhe, setDetalhe] = useState(null)
  const [documentoXml, setDocumentoXml] = useState(null)
  const [xmlAlterado, setXmlAlterado] = useState(false)
  const [editorAberto, setEditorAberto] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const sequenciaLista = useRef(0)

  const carregar = useCallback(async () => {
    const sequencia = ++sequenciaLista.current
    const params = new URLSearchParams({ page: String(pagina) })
    if (filtro.direcao) params.set('direcao', filtro.direcao)
    if (filtro.status) params.set('status', filtro.status)
    const resultado = await requestFiscal(`fiscal/documentos?${params}`)
    if (sequencia !== sequenciaLista.current) return
    if (resultado.ok) setLista(resultado.data)
    else { setLista(null); setErro(resultado.message) }
  }, [requestFiscal, filtro, pagina])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => () => { sequenciaLista.current += 1 }, [])
  useEffect(() => {
    requestFiscal('fiscal/configuracao').then((resultado) => {
      if (resultado.ok) setConfig(resultado.data.data || {})
      else setErro(resultado.message)
    })
  }, [requestFiscal])

  const salvarConfig = async (event) => {
    event.preventDefault()
    setSalvando(true); setErro(''); setAviso('')
    const resultado = await requestFiscal('fiscal/configuracao', 'PUT', {
      regime: 'SIMPLES_NACIONAL', uf: config.uf || null, inscricao_estadual: config.inscricao_estadual || null,
    })
    setSalvando(false)
    if (!resultado.ok) setErro(resultado.message)
    else { setConfig(resultado.data.data); setAviso('Configuração de referência salva.') }
  }

  const criar = async (event) => {
    event.preventDefault()
    setSalvando(true); setErro(''); setAviso('')
    const payload = { modelo: rascunho.modelo, direcao: rascunho.direcao }
    if (rascunho.origem) payload[rascunho.direcao === 'SAIDA' ? 'id_pedido' : 'id_compra'] = Number(rascunho.origem)
    const resultado = await requestFiscal('fiscal/documentos', 'POST', payload)
    setSalvando(false)
    if (!resultado.ok) { setErro(resultado.message); return }
    setDetalhe(resultado.data.data)
    setAviso('Rascunho interno criado. Nenhuma nota foi emitida e nenhum estoque ou lançamento financeiro foi alterado.')
    setRascunho((anterior) => ({ ...anterior, origem: '' }))
    await carregar()
  }

  const verDetalhe = async (id) => {
    setErro('')
    const resultado = await requestFiscal(`fiscal/documentos/${id}`)
    if (resultado.ok) setDetalhe(resultado.data.data)
    else setErro(resultado.message)
  }

  const abrirXml = (doc = null) => {
    if (editorAberto && documentoXml?.id_documento_fiscal === doc?.id_documento_fiscal) return
    if (xmlAlterado && !window.confirm('Há alterações no XML não salvas. Deseja selecionar outro rascunho?')) return
    setDocumentoXml(doc)
    setEditorAberto(true)
  }

  const fecharXml = () => {
    if (xmlAlterado && !window.confirm('Há alterações no XML não salvas. Deseja fechar o editor?')) return
    setEditorAberto(false)
    setDocumentoXml(null)
  }

  return (
    <>
    <div className="page-stack">
      <div>
        <button type="button" className="btn btn-primary" onClick={() => abrirXml()}>Abrir editor de XML</button>
      </div>
      <article className="card section-card fiscal-intro">
        <div>
          <span className="fiscal-intro-label">Guia inicial</span>
          <h2>Comece pela configuração fiscal</h2>
          <p>Esta tela está simplificada para o Simples Nacional. Crie rascunhos internos sem precisar configurar a tributação de cada produto.</p>
        </div>
        <ol className="fiscal-steps">
          <li>
            <span className="fiscal-step-number" aria-hidden="true">1</span>
            <div><h3>Confira a empresa</h3><p>O regime de referência é o Simples Nacional. UF e inscrição estadual são opcionais nesta etapa.</p></div>
          </li>
          <li>
            <span className="fiscal-step-number" aria-hidden="true">2</span>
            <div><h3>Dados opcionais</h3><p>No Cardápio, as referências fiscais de cada produto ficam disponíveis apenas se precisar consultá-las ou editá-las.</p></div>
          </li>
          <li>
            <span className="fiscal-step-number" aria-hidden="true">3</span>
            <div><h3>Crie um rascunho</h3><p>Escolha entrada ou saída e, se desejar, vincule uma compra ou pedido pelo ID.</p></div>
          </li>
        </ol>
        <div className="fiscal-notice">
          <strong>Esta área ainda não emite notas fiscais.</strong>
          <p>Os rascunhos não são enviados à SEFAZ, não geram XML fiscal autorizado nem DANFE e não calculam impostos. Também não alteram estoque ou financeiro.</p>
        </div>
      </article>
      {erro && <div className="login-error" role="alert">{erro}</div>}
      {aviso && <p role="status">{aviso}</p>}
      <section className="cards">
        {status.map((item) => <div className="card metric" key={item}><div><span>{item === 'RASCUNHO' ? 'Rascunhos' : item === 'AUTORIZADA' ? 'Autorizadas' : item === 'CANCELADA' ? 'Canceladas' : 'Rejeitadas'}</span><strong>{lista ? (lista.resumo[item] ?? 0) : '—'}</strong></div></div>)}
      </section>
      <article className="card section-card">
        <h2>Configuração fiscal da empresa</h2>
        <p>A configuração é apenas uma referência para novos rascunhos. Confirme os dados com o contador antes de qualquer uso fiscal.</p>
        {config && <form onSubmit={salvarConfig} style={{ display: 'grid', gap: 12 }}>
          <div>
            <strong>Regime de referência: Simples Nacional</strong>
            {config.regime !== 'SIMPLES_NACIONAL' && (
              <p>{config.regime ? `Regime cadastrado anteriormente: ${config.regime}. ` : 'Regime ainda não cadastrado. '}Ao salvar, será registrado Simples Nacional.</p>
            )}
          </div>
          <div className="form-grid-2">
            <label className="filter-group">UF (opcional)
              <select value={config.uf ?? ''} onChange={(e) => setConfig({ ...config, uf: e.target.value })}>
                <option value="">Não informada</option>{ufs.map((uf) => <option key={uf}>{uf}</option>)}
              </select>
            </label>
            <label className="filter-group">Inscrição estadual (opcional)
              <input maxLength={30} value={config.inscricao_estadual ?? ''} onChange={(e) => setConfig({ ...config, inscricao_estadual: e.target.value })} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={salvando}>Salvar configuração</button>
        </form>}
      </article>
      <article className="card section-card">
        <h2>Novo rascunho</h2>
        <p>Saída pode ser vinculada a um pedido; entrada, a uma compra. Informe o ID existente se desejar copiar seus itens. Os dados ficam registrados como referência no momento da criação.</p>
        <form onSubmit={criar} style={{ display: 'grid', gap: 12 }}>
          <div className="form-grid-2">
            <label className="filter-group">Modelo
              <select value={rascunho.modelo} onChange={(e) => setRascunho({ ...rascunho, modelo: e.target.value })}>
                <option value="NFE">NF-e</option><option value="NFCE">NFC-e</option>
              </select>
            </label>
            <label className="filter-group">Operação
              <select value={rascunho.direcao} onChange={(e) => setRascunho({ ...rascunho, direcao: e.target.value, origem: '' })}>
                <option value="SAIDA">Saída</option><option value="ENTRADA">Entrada</option>
              </select>
            </label>
            <label className="filter-group">ID {rascunho.direcao === 'SAIDA' ? 'do pedido' : 'da compra'} (opcional)
              <input type="number" min="1" step="1" value={rascunho.origem} onChange={(e) => setRascunho({ ...rascunho, origem: e.target.value })} />
            </label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={salvando}>Criar rascunho</button>
        </form>
      </article>
      <article className="card section-card">
        <h2>Documentos fiscais</h2>
        <p>Consulte rascunhos e, após integração futura, o histórico de notas e seus status.</p>
        <div className="form-grid-2">
          <label className="filter-group">Operação
            <select value={filtro.direcao} onChange={(e) => { setPagina(1); setFiltro({ ...filtro, direcao: e.target.value }) }}>
              <option value="">Todas</option><option value="ENTRADA">Entrada</option><option value="SAIDA">Saída</option>
            </select>
          </label>
          <label className="filter-group">Status
            <select value={filtro.status} onChange={(e) => { setPagina(1); setFiltro({ ...filtro, status: e.target.value }) }}>
              <option value="">Todos</option>{status.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {lista && lista.documentos.data.length === 0 && <p>Nenhum documento encontrado.</p>}
        {lista?.documentos.data.map((doc) => (
          <div className="item-row" key={doc.id_documento_fiscal} style={{ gridTemplateColumns: '1fr auto', marginTop: 8 }}>
            <span>#{doc.id_documento_fiscal} · {doc.modelo === 'NFE' ? 'NF-e' : 'NFC-e'} · {doc.direcao} · {doc.status}</span>
            <div className="fiscal-xml-actions">
              <button type="button" className="btn btn-light" onClick={() => verDetalhe(doc.id_documento_fiscal)}>Detalhes</button>
              {doc.modelo === 'NFCE' && doc.direcao === 'SAIDA' && doc.status === 'RASCUNHO' && (
                <button type="button" className="btn btn-light" onClick={() => abrirXml(doc)}>Editar XML</button>
              )}
            </div>
          </div>
        ))}
        {lista && <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button type="button" className="btn btn-light" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
          <span>Página {lista.documentos.current_page} de {lista.documentos.last_page}</span>
          <button type="button" className="btn btn-light" disabled={pagina >= lista.documentos.last_page} onClick={() => setPagina(pagina + 1)}>Próxima</button>
        </div>}
      </article>
      {detalhe && <article className="card section-card">
        <div className="section-head"><h2>Detalhes do documento #{detalhe.id_documento_fiscal}</h2><button className="btn btn-light" type="button" onClick={() => setDetalhe(null)}>Fechar</button></div>
        <p>{detalhe.modelo === 'NFE' ? 'NF-e' : 'NFC-e'} · {detalhe.direcao} · {detalhe.status}</p>
        <p>Pedido: {detalhe.id_pedido ?? '—'} · Compra: {detalhe.id_compra ?? '—'}</p>
        <p>Regime: {detalhe.contexto_fiscal?.regime || 'Não informado'} · UF: {detalhe.contexto_fiscal?.uf || 'Não informada'}</p>
        {detalhe.mensagem_status && <p>Retorno: {detalhe.mensagem_status}</p>}
        <h3>Itens e referências no momento do registro</h3>
        {!detalhe.itens?.length && <p>Nenhum item vinculado.</p>}
        {detalhe.itens?.map((item, index) => <div key={index} style={{ marginBottom: 12 }}>
          <strong>{item.nome || 'Item'} — quantidade: {item.quantidade}, subtotal: {item.subtotal}</strong>
          {item.referencia_fiscal
            ? <p>{Object.entries(rotulosFiscais).map(([chave, label]) => `${label}: ${item.referencia_fiscal[chave] ?? 'não informado'}`).join(' · ')}</p>
            : <p>Sem referência tributária do produto.</p>}
        </div>)}
        <h3>Tributos</h3>
        {detalhe.tributos ? <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(detalhe.tributos, null, 2)}</pre> : <p>Não apurados. Alíquotas de referência não são cálculo de imposto.</p>}
      </article>}
    </div>
    {editorAberto && (
      <FiscalXmlRascunho key={documentoXml?.id_documento_fiscal ?? 'livre'} documento={documentoXml} requestFiscal={requestFiscal}
        onDirtyChange={setXmlAlterado} onClose={fecharXml} />
    )}
    </>
  )
}
