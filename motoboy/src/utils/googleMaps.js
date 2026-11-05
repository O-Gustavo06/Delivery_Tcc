// Carrega o Maps JavaScript API sob demanda (so quando a aba Mapa abre), sem dependencia npm.
// A chave vem de motoboy/.env.local -> VITE_GOOGLE_MAPS_API_KEY.
export const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// Centro padrao enquanto o GPS nao responde (ou se o motoboy negar a permissao).
// Configure VITE_EMPRESA_LAT / VITE_EMPRESA_LNG pra apontar pra loja; sem isso cai em Sao Paulo.
const envLat = parseFloat(import.meta.env.VITE_EMPRESA_LAT)
const envLng = parseFloat(import.meta.env.VITE_EMPRESA_LNG)
export const EMPRESA =
  Number.isFinite(envLat) && Number.isFinite(envLng) ? { lat: envLat, lng: envLng } : null
export const CENTRO_PADRAO = EMPRESA || { lat: -23.55052, lng: -46.633308 }

export class MapsError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

let loadPromise = null
let authFailed = false
const authListeners = new Set()
const CALLBACK_NAME = '__motoboyGoogleMapsLoaded'

// O Google chama essa funcao global quando a chave e invalida / restrita / sem faturamento.
window.gm_authFailure = () => {
  authFailed = true
  authListeners.forEach((fn) => fn())
}

export function onMapsAuthFailure(fn) {
  authListeners.add(fn)
  if (authFailed) fn()
  return () => authListeners.delete(fn)
}

export function loadGoogleMaps() {
  if (!MAPS_KEY) {
    return Promise.reject(
      new MapsError('NO_KEY', 'Chave do Google Maps nao configurada (VITE_GOOGLE_MAPS_API_KEY).'),
    )
  }
  if (window.google?.maps?.Map && window.google?.maps?.geometry?.encoding) {
    return Promise.resolve(window.google.maps)
  }
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src =
      'https://maps.googleapis.com/maps/api/js' +
      `?key=${encodeURIComponent(MAPS_KEY)}&v=weekly&libraries=geometry&loading=async&language=pt-BR&region=BR&callback=${CALLBACK_NAME}`
    script.async = true
    window[CALLBACK_NAME] = () => {
      delete window[CALLBACK_NAME]
      resolve(window.google.maps)
    }
    script.onerror = () => {
      delete window[CALLBACK_NAME]
      loadPromise = null
      script.remove()
      reject(new MapsError('LOAD_FAILED', 'Nao foi possivel carregar o Google Maps. Verifique a internet.'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}
