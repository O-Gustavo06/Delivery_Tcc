// Pagina servida via HTTPS nao pode chamar API em HTTP puro (mixed content bloqueado
// pelo navegador). Em vez de depender de um proxy HTTPS externo rodando numa porta separada,
// usa caminho relativo (/api) quando a pagina esta em HTTPS - o proprio Vite (vite.config.js)
// ja tem um proxy de /api pro backend em http://localhost:8000, sem precisar de mais nada rodando.
// Mesmo padrao ja usado em motoboy/src/api.js.
export function resolveApiBase() {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE

  const isHttps = window.location.protocol === 'https:'
  return isHttps ? '/api' : `http://${window.location.hostname}:8000/api`
}

// O backend monta a URL da foto do produto com o host que ELE enxergou na requisicao
// (request->getSchemeAndHttpHost()) - atras do proxy do Vite (usado quando a pagina esta em
// https) isso vira sempre "localhost:8000", porque e o proprio Vite quem fala com o backend
// nesse endereco. "localhost" no celular da pessoa e o celular dela, nao o computador - por
// isso a foto nunca carregava la. Em vez de confiar no host que veio na URL, extrai so o path
// (ex: /images/produtos/x.jpg) e remonta com o mesmo host que o app ja usa pra falar com a API.
export function resolveAssetUrl(url) {
  if (!url) return url

  let path = url
  try {
    path = new URL(url, window.location.origin).pathname
  } catch {
    // ja veio como path relativo, usa como esta
  }

  if (import.meta.env.VITE_API_BASE) {
    return new URL(path, import.meta.env.VITE_API_BASE).toString()
  }

  const isHttps = window.location.protocol === 'https:'
  return isHttps ? path : `http://${window.location.hostname}:8000${path}`
}
