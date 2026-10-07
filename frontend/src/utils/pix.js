// Gera o payload do "Pix Copia e Cola" (BR Code, padrao EMV do Banco Central) a partir da
// chave Pix da empresa. E o mesmo texto que vira QR Code escaneavel por qualquer banco -
// nao depende de nenhuma API externa, e so montar os campos TLV certos + CRC16 no final.

function montarCampo(id, valor) {
  const tamanho = String(valor.length).padStart(2, '0')
  return `${id}${tamanho}${valor}`
}

function limparTexto(valor, tamanhoMaximo) {
  return (valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, tamanhoMaximo)
    .toUpperCase()
}

function crc16(payload) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * @param {{ chave: string, nome?: string, cidade?: string, valor?: number }} dados
 * @returns {string|null} payload pronto pra virar QR Code, ou null se nao tem chave cadastrada
 */
export function gerarPixCopiaECola({ chave, nome, cidade, valor }) {
  if (!chave) return null

  const merchantAccount =
    montarCampo('00', 'br.gov.bcb.pix') + montarCampo('01', chave.trim())

  const nomeExibicao = limparTexto(nome, 25) || 'RESTAURANTE'
  const cidadeExibicao = limparTexto(cidade, 15) || 'BRASIL'

  const campos = [
    montarCampo('00', '01'),
    montarCampo('26', merchantAccount),
    montarCampo('52', '0000'),
    montarCampo('53', '986'),
  ]

  if (valor && valor > 0) {
    campos.push(montarCampo('54', valor.toFixed(2)))
  }

  campos.push(montarCampo('58', 'BR'))
  campos.push(montarCampo('59', nomeExibicao))
  campos.push(montarCampo('60', cidadeExibicao))
  campos.push(montarCampo('62', montarCampo('05', '***')))

  const semCrc = campos.join('') + '6304'
  return semCrc + crc16(semCrc)
}
