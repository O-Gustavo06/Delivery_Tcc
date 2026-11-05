// Calcula a rota (origem -> paradas na ordem -> ultima parada) pela Routes API do Google.
// Roda no navegador com a mesma chave do mapa; ela precisa ter a "Routes API" habilitada.
import { MAPS_KEY } from './googleMaps.js'

const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes'

const FIELD_MASK = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.polyline.encodedPolyline',
  'routes.legs.duration',
  'routes.legs.distanceMeters',
  'routes.legs.endLocation',
].join(',')

const hasCoords = (stop) =>
  stop.lat != null && stop.lng != null && Number.isFinite(Number(stop.lat)) && Number.isFinite(Number(stop.lng))

const toWaypoint = (point) =>
  point.address
    ? { address: point.address }
    : { location: { latLng: { latitude: point.lat, longitude: point.lng } } }

const stopToPoint = (stop) =>
  hasCoords(stop) ? { lat: Number(stop.lat), lng: Number(stop.lng) } : { address: stop.endereco }

// "1234s" -> 1234
const parseSeconds = (value) => Number.parseInt(String(value || '0'), 10) || 0

function friendlyError(status, payload) {
  const apiMessage = payload?.error?.message || ''
  if (status === 403 || payload?.error?.status === 'PERMISSION_DENIED') {
    return 'A chave nao tem permissao pra Routes API. Habilite a "Routes API" no Google Cloud e confira as restricoes da chave.'
  }
  if (status === 400) return `Pedido de rota invalido. ${apiMessage}`.trim()
  if (status === 429) return 'Limite de requisicoes do Google atingido. Tente de novo em instantes.'
  return apiMessage || `Erro ${status} ao calcular a rota.`
}

/**
 * @param {{lat:number,lng:number}|null} origin posicao atual do motoboy (ou null)
 * @param {Array} stops paradas ja na ordem de visita (saida de normalizeStops)
 * @returns {Promise<null | {encodedPolyline, distanceMeters, durationSeconds, legs, originIsStop}>}
 *   legs[i] = trecho ate a parada correspondente (veja originIsStop)
 */
export async function computeRoute(origin, stops) {
  const points = stops.map(stopToPoint)
  if (points.length === 0) return null

  // Sem GPS: usa a 1a parada como origem (precisa de pelo menos 2 paradas pra ter trecho).
  const originIsStop = !origin
  const start = origin || points[0]
  const rest = originIsStop ? points.slice(1) : points
  if (rest.length === 0) return null

  const destination = rest[rest.length - 1]
  const intermediates = rest.slice(0, -1)

  const body = {
    origin: toWaypoint(start),
    destination: toWaypoint(destination),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    languageCode: 'pt-BR',
    units: 'METRIC',
  }
  if (intermediates.length) body.intermediates = intermediates.map(toWaypoint)

  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': MAPS_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Sem conexao com o Google pra calcular a rota.')
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(friendlyError(response.status, payload))

  const route = payload?.routes?.[0]
  if (!route?.polyline?.encodedPolyline) {
    throw new Error('O Google nao encontrou uma rota entre esses enderecos.')
  }

  return {
    encodedPolyline: route.polyline.encodedPolyline,
    distanceMeters: route.distanceMeters || 0,
    durationSeconds: parseSeconds(route.duration),
    legs: (route.legs || []).map((leg) => ({
      distanceMeters: leg.distanceMeters || 0,
      durationSeconds: parseSeconds(leg.duration),
      end: leg.endLocation?.latLng
        ? { lat: leg.endLocation.latLng.latitude, lng: leg.endLocation.latLng.longitude }
        : null,
    })),
    originIsStop,
  }
}

export const formatDistance = (meters) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(meters)} m`

export function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

// Link universal: abre o app do Google Maps com navegacao por voz ate a parada (modo moto).
export function navigationUrl(stop) {
  const destination = hasCoords(stop) ? `${stop.lat},${stop.lng}` : stop.endereco
  return (
    'https://www.google.com/maps/dir/?api=1&travelmode=two-wheeler&dir_action=navigate' +
    `&destination=${encodeURIComponent(destination)}`
  )
}

export { hasCoords }
