// Tudo que a lista de pedidos e a tela de detalhe precisam saber de uma parada da rota, num
// formato so (a API devolve a rota aninhada: rota -> itens -> entrega -> pedido -> ...).

export const STATUS_LABEL = {
  AGUARDANDO: 'Aguardando coleta',
  COLETADO: 'Coletado',
  EM_ROTA: 'Em percurso',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
}

export const STATUS_BADGE = {
  AGUARDANDO: 'badge-sun',
  COLETADO: 'badge-blue',
  EM_ROTA: 'badge-lime',
  ENTREGUE: 'badge-muted',
  CANCELADA: 'badge-red',
}

export const PAYMENT_LABEL = { PIX: 'Pix', CARTAO: 'Cartão', DINHEIRO: 'Dinheiro' }

const CANAL_LABEL = { IFOOD: 'iFood' }

export function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return null
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatHora(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDataHora(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.toLocaleDateString('pt-BR')} às ${formatHora(value)}`
}

/** "Rua X, 123 - Centro" -> rua em destaque ("Rua X") e o resto ("123 - Centro") mais apagado. */
export function splitEndereco(endereco) {
  const texto = String(endereco || '').trim()
  const corte = texto.indexOf(',')
  if (corte === -1) return { destaque: texto, resto: '' }
  return { destaque: texto.slice(0, corte), resto: texto.slice(corte + 1).trim() }
}

export function normalizeStops(rota) {
  if (!rota?.itens) return []

  return [...rota.itens]
    .sort((a, b) => a.ordem_sequencia - b.ordem_sequencia)
    .map((item) => {
      const entrega = item.entrega || {}
      const pedido = entrega.pedido || {}
      const pagamento = pedido.pagamento || {}
      const vlFinal = pagamento.vl_final != null ? Number(pagamento.vl_final) : null
      const trocoPara = pagamento.troco_para != null ? Number(pagamento.troco_para) : null
      const trocoCalculado =
        pagamento.forma === 'DINHEIRO' && trocoPara != null && vlFinal != null
          ? Math.round((trocoPara - vlFinal) * 100) / 100
          : null

      return {
        idItem: item.id_rota_entrega_item,
        ordem: item.ordem_sequencia,
        idEntrega: entrega.id_entrega,
        idPedido: pedido.id_pedido,
        numero: pedido.nr_pedido_delivery ?? pedido.id_pedido,
        statusEntrega: entrega.status_entrega,
        pedidoEm: pedido.dt_pedido,
        endereco: pedido.ds_observacao || 'Endereço não informado',
        lat: entrega.latitude_destino,
        lng: entrega.longitude_destino,
        clienteNome: pedido.cliente?.usuario?.nm_usuario,
        telefone: pedido.cliente?.telefone || pedido.telefone_contato || null,
        canal: CANAL_LABEL[pedido.canal_origem] || null,
        notaPedido: pedido.ds_nota_pedido || null,
        itens: Array.isArray(pedido.itens)
          ? pedido.itens.map((i) => ({
              qtd: i.nr_quantidade,
              nome: i.produto?.nm_produto ?? 'Item',
              nota: i.adicionais_json?.observacao || null,
            }))
          : [],
        forma: pagamento.forma,
        pago: pagamento.status === 'APROVADO',
        vlFinal,
        trocoCalculado,
        precisaCodigo: Boolean(entrega.codigo_confirmacao_entrega),
      }
    })
}

export function mapsUrl(stop) {
  if (stop.lat && stop.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.endereco)}`
}

/** Rota completa (todas as paradas pendentes) no app de mapas do celular. Null se nao tem parada. */
export function buildRouteUrl(stops) {
  const pontos = stops
    .filter((stop) => stop.statusEntrega !== 'ENTREGUE' && stop.statusEntrega !== 'CANCELADA')
    .map((stop) => (stop.lat && stop.lng ? `${stop.lat},${stop.lng}` : stop.endereco))

  if (pontos.length === 0) return null

  const params = new URLSearchParams({ api: '1', destination: pontos[pontos.length - 1], travelmode: 'driving' })
  // O Google Maps aceita no maximo 9 paradas intermediarias por link.
  const intermediarios = pontos.slice(0, -1).slice(0, 9)
  if (intermediarios.length > 0) params.set('waypoints', intermediarios.join('|'))

  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function whatsappUrl(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '')
  if (digitos.length < 10) return null
  return `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`
}

export function telUrl(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '')
  return digitos ? `tel:${digitos}` : null
}
