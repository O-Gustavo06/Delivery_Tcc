import React, { useEffect, useRef, useState } from 'react'

export default function FiscalXmlRascunho({ documento, requestFiscal, onDirtyChange, onClose }) {
  const [xml, setXml] = useState('')
  const [original, setOriginal] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [falhaCarregamento, setFalhaCarregamento] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const dialogo = useRef(null)
  const path = documento ? `fiscal/documentos/${documento.id_documento_fiscal}/xml-rascunho` : 'fiscal/xml-editor'

  useEffect(() => {
    const elemento = dialogo.current
    elemento.showModal()
    return () => elemento.close()
  }, [])

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setFalhaCarregamento(false)
    setErro('')
    requestFiscal(path).then((resultado) => {
      if (!ativo) return
      setCarregando(false)
      if (!resultado.ok) {
        setFalhaCarregamento(true)
        setErro(resultado.message)
        return
      }
      const salvo = resultado.data.data ?? ''
      setXml(salvo)
      setOriginal(salvo)
    })
    return () => { ativo = false }
  }, [path, requestFiscal, tentativa])

  useEffect(() => {
    onDirtyChange(xml !== original)
    return () => onDirtyChange(false)
  }, [xml, original, onDirtyChange])

  useEffect(() => {
    if (xml === original) return undefined
    const alertar = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', alertar)
    return () => window.removeEventListener('beforeunload', alertar)
  }, [xml, original])

  const gerar = async () => {
    if (xml && !window.confirm('Substituir o conteúdo atual pelo XML gerado? As alterações não salvas serão perdidas.')) return
    setOcupado(true); setErro(''); setAviso('')
    const resultado = await requestFiscal(`${path}/gerar`, 'POST')
    setOcupado(false)
    if (!resultado.ok) setErro(resultado.message)
    else { setXml(resultado.data.data); setAviso('XML gerado. Salve para manter as alterações.') }
  }

  const salvar = async () => {
    setOcupado(true); setErro(''); setAviso('')
    const resultado = await requestFiscal(path, 'PUT', { xml })
    setOcupado(false)
    if (!resultado.ok) setErro(resultado.message)
    else { setOriginal(xml); setAviso('XML salvo.') }
  }

  const baixar = () => {
    setErro('')
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const encoding = xml.match(/<\?xml\s[^?]*encoding\s*=\s*["']([^"']+)["']/i)
    if (/<!DOCTYPE/i.test(xml) || doc.querySelector('parsererror') || (encoding && encoding[1].toUpperCase() !== 'UTF-8')) {
      setErro('Informe um XML bem formado em UTF-8, sem DOCTYPE.')
      return
    }
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = documento ? `xml-rascunho-${documento.id_documento_fiscal}.xml` : 'xml-editor.xml'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <dialog ref={dialogo} className="fiscal-xml" aria-labelledby="fiscal-xml-titulo"
      onCancel={(event) => { event.preventDefault(); onClose() }}>
      <div className="fiscal-xml-header">
        <h2 id="fiscal-xml-titulo">Editor de XML</h2>
        <button type="button" className="btn btn-light" onClick={onClose}>Fechar</button>
      </div>
      <div className="fiscal-notice">
        <strong>Visualização e edição</strong>
        <p>O editor não valida nem autoriza notas na SEFAZ. Alterar um XML assinado pode invalidar sua assinatura; preserve o arquivo original.</p>
      </div>
      <>
          {documento
            ? <p>Rascunho #{documento.id_documento_fiscal}. O XML gerado é interno, não segue o formato oficial e não tem validade fiscal.</p>
            : <p>Cole seu XML abaixo. Este editor guarda um arquivo por usuário; ao salvar, o conteúdo anterior deste editor é substituído.</p>}
          {erro && <div className="login-error" role="alert">{erro}</div>}
          {aviso && <p role="status">{aviso}</p>}
          {falhaCarregamento && <button type="button" className="btn btn-light" onClick={() => setTentativa((valor) => valor + 1)}>Tentar carregar novamente</button>}
          {carregando ? <p>Carregando XML...</p> : !falhaCarregamento && (
            <>
              {documento && <button type="button" className="btn btn-light" onClick={gerar} disabled={ocupado}>Gerar rascunho a partir do cadastro</button>}
              <label className="filter-group">Cole ou edite o XML
                <textarea className="fiscal-xml-editor" value={xml} onChange={(event) => { setXml(event.target.value); setAviso('') }} disabled={ocupado}
                  placeholder={'<?xml version="1.0" encoding="UTF-8"?>\nCole seu XML aqui'} spellCheck={false} rows={18} />
              </label>
              <p>{xml !== original ? 'Alterações não salvas.' : xml ? 'XML salvo.' : 'Cole e salve o XML para consultá-lo novamente.'}</p>
              <div className="fiscal-xml-actions">
                <button type="button" className="btn btn-primary" onClick={salvar} disabled={ocupado || !xml || xml === original}>Salvar XML</button>
                <button type="button" className="btn btn-light" onClick={baixar} disabled={ocupado || !xml}>Baixar XML</button>
              </div>
            </>
          )}
      </>
    </dialog>
  )
}
