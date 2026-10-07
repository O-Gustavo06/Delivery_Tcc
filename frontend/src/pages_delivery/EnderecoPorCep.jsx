import React, { useState } from 'react'
import { buscarEnderecoPorCep, formatarCep } from '../utils/cep.js'

/**
 * Campo de CEP que autocompleta rua/bairro/cidade (ViaCEP) - o usuario so digita o numero.
 * Chama onResolved({ cep, numero, endereco }) sempre que o endereco final muda, com
 * endereco = null enquanto nao tiver um CEP valido resolvido.
 */
export default function EnderecoPorCep({ onResolved, className = 'filter-group' }) {
  const [cep, setCep] = useState('')
  const [numero, setNumero] = useState('')
  const [endereco, setEndereco] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [erroCep, setErroCep] = useState('')

  const emitir = (dadosEndereco, valorNumero) => {
    if (!dadosEndereco) {
      onResolved(null)
      return
    }
    const partes = [dadosEndereco.rua, valorNumero || 's/n', dadosEndereco.bairro].filter(Boolean)
    const completo = `${partes.join(', ')} - ${dadosEndereco.cidade}/${dadosEndereco.uf}`
    onResolved({
      cep: dadosEndereco.cep,
      numero: valorNumero,
      endereco: completo,
      rua: dadosEndereco.rua,
      cidade: dadosEndereco.cidade,
      uf: dadosEndereco.uf,
    })
  }

  const handleCepChange = async (value) => {
    const formatado = formatarCep(value)
    setCep(formatado)
    setErroCep('')

    const digits = formatado.replace(/\D/g, '')
    if (digits.length !== 8) {
      setEndereco(null)
      onResolved(null)
      return
    }

    setBuscando(true)
    const resultado = await buscarEnderecoPorCep(digits)
    setBuscando(false)

    if (!resultado) {
      setErroCep('CEP não encontrado.')
      setEndereco(null)
      onResolved(null)
      return
    }

    setEndereco(resultado)
    emitir(resultado, numero)
  }

  const handleNumeroChange = (value) => {
    setNumero(value)
    emitir(endereco, value)
  }

  return (
    <>
      <div className={className}>
        <label>CEP</label>
        <input
          placeholder="00000-000"
          value={cep}
          onChange={(event) => handleCepChange(event.target.value)}
          inputMode="numeric"
          maxLength={9}
          required
        />
        {buscando && <small style={{ color: 'var(--muted)' }}>Buscando endereço...</small>}
        {erroCep && <small style={{ color: 'var(--danger)' }}>{erroCep}</small>}
        {endereco && (
          <small style={{ color: 'var(--muted)' }}>
            {endereco.rua ? `${endereco.rua}, ` : ''}
            {endereco.bairro} — {endereco.cidade}/{endereco.uf}
          </small>
        )}
      </div>
      <div className={className}>
        <label>Número</label>
        <input
          placeholder="Número"
          value={numero}
          onChange={(event) => handleNumeroChange(event.target.value)}
          disabled={!endereco}
          required
        />
      </div>
    </>
  )
}
