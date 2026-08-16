// Pagina servida via HTTPS nao pode chamar API em HTTP puro (mixed content bloqueado
// pelo navegador), entao acompanha o protocolo da propria pagina e usa o proxy HTTPS
// (local-ssl-proxy, porta 8443) quando ela estiver em HTTPS.
const isHttps = window.location.protocol === 'https:'
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  `${isHttps ? 'https' : 'http'}://${window.location.hostname}:${isHttps ? 8443 : 8000}/api`

const TOKEN_KEY = 'motoboyToken'

export const getToken = () => window.localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => window.localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => window.localStorage.removeItem(TOKEN_KEY)

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getToken()
    if (!token) throw new ApiError('Sessao expirada.', 401, null)
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Nao foi possivel conectar ao servidor.', 0, null)
  }

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    if (response.status === 401) clearToken()
    throw new ApiError(payload?.message || `Erro ${response.status}`, response.status, payload)
  }

  return payload
}

export const api = {
  parear: (codigo) => request('/auth/parear', { method: 'POST', body: { codigo }, auth: false }),
  logout: () => request('/auth/logout', { method: 'POST' }).catch(() => null),
  me: () => request('/auth/me'),
  scan: (codigoQr) => request(`/motoboy/pedidos/scan/${encodeURIComponent(codigoQr)}`),
  rotaAtiva: () => request('/motoboy/rotas/ativa'),
  reordenar: (rotaId, ordem) => request(`/motoboy/rotas/${rotaId}/reordenar`, { method: 'PATCH', body: { ordem } }),
  iniciar: (entregaId) => request(`/motoboy/entregas/${entregaId}/iniciar`, { method: 'PATCH', body: {} }),
  concluir: (entregaId, codigoConfirmacao) =>
    request(`/motoboy/entregas/${entregaId}/concluir`, {
      method: 'PATCH',
      body: { codigo_confirmacao: codigoConfirmacao || null },
    }),
  historico: (periodo) => request(`/motoboy/entregas/historico?periodo=${periodo}`),
}

export { ApiError }
