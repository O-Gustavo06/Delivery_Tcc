import React, { useEffect, useState } from 'react'

const campos = [
  ['ncm', 'NCM (8 dígitos)', 'text', '8'],
  ['cest', 'CEST (7 dígitos)', 'text', '7'],
  ['cfop', 'CFOP de referência (4 dígitos)', 'text', '4'],
  ['cst_csosn', 'CST/CSOSN de referência', 'text', '3'],
  ['origem', 'Origem da mercadoria (0 a 8)', 'text', '1'],
  ['aliquota_icms', 'Alíquota ICMS (%)', 'number'],
  ['aliquota_pis', 'Alíquota PIS (%)', 'number'],
  ['aliquota_cofins', 'Alíquota COFINS (%)', 'number'],
  ['aliquota_ipi', 'Alíquota IPI (%)', 'number'],
]

export default function FiscalProduto({ produto, requestFiscal, onClose }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    requestFiscal(`produtos/${produto.id}/fiscal`).then((result) => {
      if (!ativo) return
      if (result.ok) setDados(result.data.data || {})
      else setErro(result.message)
    })
    return () => { ativo = false }
  }, [produto.id, requestFiscal])

  const salvar = async (event) => {
    event.preventDefault()
    setSalvando(true)
    setErro('')
    const payload = Object.fromEntries([...campos.map(([chave]) => chave), 'informacoes_adicionais']
      .map((chave) => [chave, dados[chave] === '' || dados[chave] == null ? null : dados[chave]]))
    const result = await requestFiscal(`produtos/${produto.id}/fiscal`, 'PUT', payload)
    setSalvando(false)
    if (!result.ok) setErro(result.message)
    else onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><h2>Tributação: {produto.nome}</h2><p>Dados de referência; confirme as regras com a contabilidade para cada operação.</p></div>
          <button type="button" className="btn btn-light" onClick={onClose}>Fechar</button>
        </div>
        {erro && <div className="login-error" role="alert">{erro}</div>}
        {!dados && !erro && <p>Carregando...</p>}
        {dados && (
          <>
            <p>Para esta etapa, o sistema considera o Simples Nacional. Não é necessário preencher dados fiscais por produto para usar os rascunhos.</p>
            <p>Os campos abaixo são opcionais e não calculam impostos nem emitem notas. Confirme qualquer informação com o contador antes de usá-la fiscalmente.</p>
            <details>
              <summary>Dados fiscais avançados (opcional)</summary>
              <form onSubmit={salvar} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                <div className="form-grid-2">
                  {campos.map(([chave, label, tipo, tamanho]) => (
                    <label className="filter-group" key={chave}>
                      {label}
                      <input type={tipo} value={dados[chave] ?? ''} maxLength={tamanho}
                        inputMode={tipo === 'text' ? 'numeric' : 'decimal'}
                        min={tipo === 'number' ? '0' : undefined} max={tipo === 'number' ? '100' : undefined}
                        step={tipo === 'number' ? '0.0001' : undefined}
                        onChange={(event) => setDados((anterior) => ({ ...anterior, [chave]: event.target.value }))} />
                    </label>
                  ))}
                </div>
                <label className="filter-group">Outras informações tributárias
                  <textarea rows={3} maxLength={5000} value={dados.informacoes_adicionais ?? ''}
                    onChange={(event) => setDados((anterior) => ({ ...anterior, informacoes_adicionais: event.target.value }))} />
                </label>
                <button type="submit" className="btn btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar tributação'}</button>
              </form>
            </details>
          </>
        )}
      </div>
    </div>
  )
}
