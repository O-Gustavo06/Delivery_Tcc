import { useEffect, useMemo, useState } from 'react'
import { resolveApiBase } from '../utils/apiBase'

const API_BASE = resolveApiBase()

export default function usePromotionQuote({ code, items, phone, clientId, enabled = true }) {
  const itemsKey = useMemo(() => JSON.stringify(items), [items])
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ((!code && !enabled) || !items.length) {
      setResult(null)
      setError('')
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setResult(null)
    setError('')
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/pedir/precificar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            coupon_code: code || undefined,
            items: JSON.parse(itemsKey),
            ...(phone ? { telefone: phone } : {}),
            ...(clientId ? { id_cliente: clientId } : {}),
          }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          const validationError = Object.values(payload.errors || {}).flat()[0]
          setError(validationError || payload.message || 'Não foi possível validar o cupom.')
          return
        }
        setResult(payload)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError('Não foi possível validar o cupom. Verifique sua conexão e tente novamente.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [code, itemsKey, phone, clientId, enabled])

  return { quote: result, error, loading }
}
