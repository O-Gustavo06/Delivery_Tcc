// Busca o endereco a partir de um CEP usando o ViaCEP (gratuito, sem chave). O backend
// depois converte esse mesmo CEP em coordenadas (Nominatim) na hora de criar o pedido -
// aqui e so pra autocompletar a rua/bairro/cidade na tela.
export async function buscarEnderecoPorCep(cep) {
  const digits = String(cep || '').replace(/\D/g, '')
  if (digits.length !== 8) return null

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!response.ok) return null

    const data = await response.json()
    if (data.erro) return null

    return {
      cep: digits,
      rua: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      uf: data.uf || '',
    }
  } catch {
    return null
  }
}

export function formatarCep(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}
