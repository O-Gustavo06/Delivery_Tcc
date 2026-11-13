import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import Login from './pages/Login.jsx'
import Pedidos from './pages/Pedidos.jsx'
import NovoPedidoModal from './pages/NovoPedidoModal.jsx'
import Usuarios from './pages/Usuarios.jsx'
import Painel from './pages/Painel.jsx'
import Cozinha from './pages/Cozinha.jsx'
import Mesas from './pages/Mesas.jsx'
import Entrega from './pages/Entrega.jsx'
import Relatorios from './pages/Relatorios.jsx'
import Compras from './pages/Compras.jsx'
import Cardapio from './pages/Cardapio.jsx'
import FiscalContabil from './pages/FiscalContabil.jsx'
import Promocoes from './pages/Promocoes.jsx'
import Clientes from './pages/Clientes.jsx'
import Crescimento from './pages/Crescimento.jsx'
import Pedidos_Ifood from './pages/Pedidos_Ifood.jsx'
import WhatsApp from './pages/whatsApp.jsx'
import CardapioPublico from './pages_delivery/CardapioPublico.jsx'
import MesaPublica from './pages_delivery/MesaPublica.jsx'
import './CentralScreens.css'
// Lazy: o CSS do cardapio presencial mexe no <html>/fontes e o video pesa ~1 MB - so carrega
// quando alguem abre o cardapio presencial, sem entrar no bundle do painel admin.
const CardapioPresencial = lazy(() => import('./pages_delivery/CardapioPresencial/CardapioPresencial.jsx'))
import logo from './assets/logo.png'
import { resolveApiBase } from './utils/apiBase'


const API_BASE = resolveApiBase()
const AUTH_BYPASS = false
const IDLE_TIMEOUT_MS = 60 * 60 * 1000
const LAST_ACTIVITY_KEY = 'adminLastActivity'

const statusLabels = {
  novo: 'Novo',
  enviado_cozinha: 'Cozinha',
  em_preparo: 'Preparando',
  pronto: 'Pronto',
  saiu_entrega: 'Saiu entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const statusTone = {
  novo: 'badge-sun',
  enviado_cozinha: 'badge-orange',
  em_preparo: 'badge-blue',
  pronto: 'badge-green',
  saiu_entrega: 'badge-sun',
  entregue: 'badge-green',
  cancelado: 'badge-red',
}

const routes = [
  { path: '/painel', label: 'Painel', code: 'PN' },
  { path: '/pedidos', label: 'Pedidos', code: 'PD' },
  { path: '/cardapio/pedidos', label: 'Pedidos Online', code: 'PO' },
  { path: '/cardapio', label: 'Cardapio', code: 'CD' },
  { path: '/promocoes', label: 'Promoções', code: 'PR' },
  { path: '/cardapio/presencial', label: 'Cardápio Presencial', code: 'CPR' },
  { path: '/motoboy/', label: 'Motoboy', code: 'MB' },
  { path: '/cozinha', label: 'Cozinha', code: 'CZ' },
  { path: '/mesas', label: 'Mesas', code: 'MS' },
  { path: '/entrega', label: 'Entrega', code: 'EN' },
  { path: '/usuarios', label: 'Usuarios', code: 'US' },
  { path: '/financeiro', label: 'Financeiro', code: 'FN' },
  { path: '/fiscal', label: 'Fiscal', code: 'FC' },
  { path: '/armazem', label: 'Armazém', code: 'AZ' },
  { path: '/clientes', label: 'Clientes', code: 'CL' },
  { path: '/crescimento', label: 'Crescimento', code: 'CR' },
  { path: '/pedidos_ifood', label: 'Pedidos iFood', code: 'IF' },
  { path: '/whatsapp', label: 'WhatsApp', code: 'WA' },
]

const navGroups = [
  { label: 'Operação', paths: ['/painel', '/pedidos', '/cardapio', '/cozinha', '/mesas', '/entrega'] },
  { label: 'Gestão', paths: ['/usuarios', '/armazem', '/clientes', '/crescimento', '/promocoes', '/fiscal'] },
  { label: 'Canais', paths: ['/pedidos_ifood', '/whatsapp'] },
]

const roleLabels = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  ATENDENTE: 'Atendente',
  ENTREGADOR: 'Entregador',
}

const rotasAtendente = ['/pedidos', '/cardapio', '/cozinha', '/mesas', '/entrega', '/whatsapp', '/motoboy/']
const temAcessoPainel = (role) => ['ADMIN', 'GERENTE', 'ATENDENTE'].includes(role)
const podeAcessarRota = (role, path) => ['ADMIN', 'GERENTE'].includes(role) || (role === 'ATENDENTE' && rotasAtendente.includes(path))

const getInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

const EMPTY_DASHBOARD_DATA = {
  panelData: {
    alerts: [],
    channels: [],
    timeline: [],
  },
  kitchenData: {
    stations: [],
    prepList: [],
  },
  tablesData: {
    summary: {
      total: 0,
      occupied: 0,
      reserved: 0,
      cleaning: 0,
      waiting: 0,
    },
    areas: [],
    waitingList: [],
  },
  deliveryData: {
    couriers: [],
    routes: [],
    incidents: [],
  },
  financeData: {
    kpis: [],
    cashFlow: [],
    paymentMethods: [],
    pendingPayments: [],
    checklist: [],
  },
  reportsData: {
    cards: [],
    topProducts: [],
    exports: [],
  },
  customersData: {
    segments: [],
    spotlight: [],
    campaigns: [],
  },
  marketplaceData: {
    scorecards: [],
    queues: [],
    actions: [],
  },
}

const normalizeRoute = (path) => (path === '/compras' ? '/armazem' : path)

const getInitialRoute = () => {
  const path = normalizeRoute(window.location.pathname)
  if (path !== window.location.pathname) {
    window.history.replaceState({}, '', path)
  }

  if (path === '/') {
    return '/login'
  }

  return path
}

const formatTime = (value) => {
  if (!value) return ''
  if (value.includes(' ')) {
    const parts = value.split(' ')
    return parts[1]?.slice(0, 5) ?? value
  }
  return value.slice(0, 5)
}

const mapApiOrder = (order) => ({
  id: Number(order.id),
  number: Number(order.number),
  deliveryNumber: order.delivery_number != null ? Number(order.delivery_number) : null,
  type: order.type,
  channel: order.channel ?? 'loja',
  tableNumber: order.table_number ?? order.tableNumber ?? null,
  customerName: String(order.customer_name ?? order.customerName ?? ''),
  address: order.address ? String(order.address) : undefined,
  note: order.note ? String(order.note) : undefined,
  status: order.status,
  paymentStatus: order.payment_status ?? null,
  motivoCancelamento: order.motivo_cancelamento ?? null,
  codigoQr: order.codigo_qr ?? null,
  total: Number(order.total ?? 0),
  items: Array.isArray(order.items) ? order.items : [],
  additions: Number(order.additions ?? 0),
  lastAddedAt: order.last_added_at ?? null,
  hasNewItems: Boolean(order.has_new_items),
  createdAt: formatTime(String(order.created_at ?? order.createdAt ?? '')),
  avaliacao: order.avaliacao ?? null,
})

const mapApiUser = (user) => ({
  id: Number(user.id),
  name: String(user.name ?? ''),
  email: String(user.email ?? ''),
  role: user.role ?? 'cliente',
  isActive: Boolean(user.is_active ?? user.isActive ?? true),
  telefone: user.telefone ?? null,
  pairingCode: user.pairing_code ?? null,
  pairingExpiresAt: user.pairing_expires_at ?? null,
  pareado: user.pareado ?? null,
})

const mergeDashboardData = (payload = {}) => ({
  panelData: { ...EMPTY_DASHBOARD_DATA.panelData, ...(payload.panelData ?? {}) },
  kitchenData: { ...EMPTY_DASHBOARD_DATA.kitchenData, ...(payload.kitchenData ?? {}) },
  tablesData: {
    ...EMPTY_DASHBOARD_DATA.tablesData,
    ...(payload.tablesData ?? {}),
    summary: {
      ...EMPTY_DASHBOARD_DATA.tablesData.summary,
      ...(payload.tablesData?.summary ?? {}),
    },
  },
  deliveryData: { ...EMPTY_DASHBOARD_DATA.deliveryData, ...(payload.deliveryData ?? {}) },
  financeData: { ...EMPTY_DASHBOARD_DATA.financeData, ...(payload.financeData ?? {}) },
  reportsData: { ...EMPTY_DASHBOARD_DATA.reportsData, ...(payload.reportsData ?? {}) },
  customersData: { ...EMPTY_DASHBOARD_DATA.customersData, ...(payload.customersData ?? {}) },
  marketplaceData: { ...EMPTY_DASHBOARD_DATA.marketplaceData, ...(payload.marketplaceData ?? {}) },
})

export default function App() {
  const [route, setRoute] = useState(getInitialRoute)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState([])
  const [dashboardData, setDashboardData] = useState(EMPTY_DASHBOARD_DATA)
  const [filters, setFilters] = useState({ search: '', status: 'all', type: 'all' })
  const [apiToken, setApiToken] = useState(null)
  const [apiEnabled, setApiEnabled] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [userLoadError, setUserLoadError] = useState('')
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false)
  const [comandasPendentes, setComandasPendentes] = useState([])
  const [empresa, setEmpresa] = useState(null)
  const [theme, setTheme] = useState(() => window.localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  useEffect(() => {
    if (AUTH_BYPASS) {
      setIsAuthenticated(true)
      return undefined
    }

    const cached = window.localStorage.getItem('adminToken')
    const lastActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY))
    if (cached && lastActivity > 0 && Date.now() - lastActivity < IDLE_TIMEOUT_MS) {
      setApiToken(cached)
      setIsAuthenticated(true)
      if (getInitialRoute() === '/login') {
        navigate('/painel')
      }
    } else if (cached) {
      window.localStorage.removeItem('adminToken')
      window.localStorage.removeItem(LAST_ACTIVITY_KEY)
    }

    const handlePopstate = () => setRoute(getInitialRoute())
    window.addEventListener('popstate', handlePopstate)

    return () => window.removeEventListener('popstate', handlePopstate)
  }, [])

  const navigate = useCallback((path) => {
    const nextPath = normalizeRoute(path)
    window.history.pushState({}, '', nextPath)
    setRoute(nextPath)
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [route])

  useEffect(() => {
    if (!mobileMenuOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  const invalidateSession = useCallback(() => {
    window.localStorage.removeItem('adminToken')
    window.localStorage.removeItem(LAST_ACTIVITY_KEY)
    setApiToken(null)
    setApiEnabled(true)
    setIsAuthenticated(false)
    setCurrentUser(null)
    setOrders([])
    setUsers([])
    setDashboardData(EMPTY_DASHBOARD_DATA)
    setComandasPendentes([])
    setEmpresa(null)
    navigate('/login')
  }, [navigate])

  const getAuthToken = useCallback(async () => {
    if (apiToken) return apiToken
    const cached = window.localStorage.getItem('adminToken')
    if (cached) {
      setApiToken(cached)
      return cached
    }
    return null
  }, [apiToken])

  const loginWithCredentials = useCallback(async (email, password) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        return { ok: false, message: 'Credenciais invalidas.' }
      }

      const payload = await response.json()
      if (!payload.token) {
        return { ok: false, message: 'Token nao retornado.' }
      }
      if (!temAcessoPainel(payload.user?.role)) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${payload.token}` },
        })
        return { ok: false, message: 'Este perfil não tem acesso ao painel. Entregadores devem usar o aplicativo Motoboy.' }
      }

      window.localStorage.setItem('adminToken', payload.token)
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
      setApiToken(payload.token)
      setApiEnabled(true)
      setIsAuthenticated(true)
      if (payload.user) setCurrentUser(mapApiUser(payload.user))

      return { ok: true, message: '' }
    } catch {
      return { ok: false, message: 'Nao foi possivel conectar ao servidor.' }
    }
  }, [])

  const logout = useCallback(async () => {
    const token = await getAuthToken()
    invalidateSession()
    if (token) {
      try {
        const response = await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok && response.status !== 401) {
          console.error('Nao foi possivel revogar a sessao:', response.status)
        }
      } catch (error) {
        console.error('Nao foi possivel revogar a sessao:', error)
      }
    }
  }, [getAuthToken, invalidateSession])

  useEffect(() => {
    if (!isAuthenticated || !apiToken) return undefined

    let idleTimer
    let activityTimer
    let lastSent = 0
    let lastActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY))

    const expire = () => {
      window.clearTimeout(idleTimer)
      const sharedActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY))
      lastActivity = Math.max(lastActivity, sharedActivity || 0)
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity)
      if (remaining > 0) {
        idleTimer = window.setTimeout(expire, remaining)
      } else {
        void logout()
      }
    }

    const sendActivity = () => {
      activityTimer = undefined
      lastSent = Date.now()
      fetch(`${API_BASE}/auth/activity`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' },
      }).then((response) => {
        if (response.status === 401 && window.localStorage.getItem('adminToken') === apiToken) {
          invalidateSession()
        } else if (!response.ok) {
          console.error('Nao foi possivel registrar a atividade da sessao:', response.status)
        }
      }).catch((error) => console.error('Nao foi possivel registrar a atividade da sessao:', error))
    }

    const recordActivity = () => {
      const now = Date.now()
      const sharedActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY))
      lastActivity = Math.max(lastActivity, sharedActivity || 0)
      if (now - lastActivity >= IDLE_TIMEOUT_MS) {
        void logout()
        return
      }
      lastActivity = now
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(expire, IDLE_TIMEOUT_MS)

      if (now - lastSent >= 1000) {
        window.clearTimeout(activityTimer)
        sendActivity()
      } else if (!activityTimer) {
        activityTimer = window.setTimeout(sendActivity, 1000 - (now - lastSent))
      }
    }

    const handleStorage = (event) => {
      if (event.key === 'adminToken' && event.newValue !== apiToken) {
        setApiToken(null)
        setIsAuthenticated(false)
        setCurrentUser(null)
        setOrders([])
        setUsers([])
        setDashboardData(EMPTY_DASHBOARD_DATA)
        setComandasPendentes([])
        setEmpresa(null)
        navigate('/login')
      }
    }

    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }))
    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', expire)
    expire()

    return () => {
      window.clearTimeout(idleTimer)
      window.clearTimeout(activityTimer)
      events.forEach((event) => window.removeEventListener(event, recordActivity))
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', expire)
    }
  }, [apiToken, invalidateSession, isAuthenticated, logout, navigate])

  const fetchCurrentUser = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return

    setUserLoadError('')
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 401) {
        invalidateSession()
        return
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      if (!payload || !temAcessoPainel(payload.role)) {
        invalidateSession()
        return
      }
      setCurrentUser(mapApiUser(payload))
    } catch (error) {
      setUserLoadError(`Não foi possível verificar seu acesso: ${error.message}`)
    }
  }, [getAuthToken, invalidateSession])

  const fetchOrdersFromApi = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) {
      setApiEnabled(false)
      return
    }

    const response = await fetch(`${API_BASE}/admin/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      setApiEnabled(false)
      return
    }

    const payload = await response.json()
    if (Array.isArray(payload.data)) {
      setOrders(payload.data.map(mapApiOrder))
    }
  }, [getAuthToken])

  const createOrder = useCallback(
    async (orderPayload) => {
      const token = await getAuthToken()
      if (!token) {
        setApiEnabled(false)
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      })

      if (response.status === 401) {
        invalidateSession()
        return { ok: false, message: 'Sua sessão expirou. Entre novamente.' }
      }

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao criar pedido.' }
      }

      const created = mapApiOrder(await response.json())
      setOrders((prev) => [created, ...prev])
      return { ok: true, message: '' }
    },
    [getAuthToken, invalidateSession],
  )

  const fetchComandasPendentes = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) {
      setApiEnabled(false)
      return
    }

    const response = await fetch(`${API_BASE}/admin/comandas/pendentes`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) return

    const payload = await response.json()
    if (Array.isArray(payload)) {
      setComandasPendentes(payload)
    }
  }, [getAuthToken])

  const updateOrderStatus = useCallback(
    async (orderId, status, motivo) => {
      if (!apiEnabled) return

      const token = await getAuthToken()
      if (!token) {
        setApiEnabled(false)
        return
      }

      const response = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(motivo ? { status, motivo } : { status }),
      })

      if (!response.ok) return

      const payload = await response.json()
      const updated = mapApiOrder(payload)
      setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)))
    },
    [apiEnabled, getAuthToken],
  )

  const fetchUsersFromApi = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) {
      setApiEnabled(false)
      return
    }

    const response = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      setApiEnabled(false)
      return
    }

    const payload = await response.json()
    if (Array.isArray(payload.data)) {
      setUsers(payload.data.map(mapApiUser))
    }
  }, [getAuthToken])

  const fetchDashboardFromApi = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) {
      setApiEnabled(false)
      return false
    }

    const response = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      setApiEnabled(false)
      return false
    }

    const payload = await response.json()
    setDashboardData(mergeDashboardData(payload))
    return true
  }, [getAuthToken])

  const fetchAdminInsight = useCallback(async (path) => {
    const token = await getAuthToken()
    if (!token) {
      return { ok: false, message: 'Sua sessão expirou. Entre novamente para consultar esses dados.' }
    }

    const response = await fetch(`${API_BASE}/admin/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    const responseText = await response.text()
    let payload

    try {
      payload = responseText ? JSON.parse(responseText) : null
    } catch {
      return {
        ok: false,
        message: `A API retornou uma resposta que não é JSON (HTTP ${response.status}). Verifique o endereço da API e se o backend está ativo.`,
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        message: payload?.message || `Não foi possível carregar os dados (HTTP ${response.status}).`,
      }
    }

    return { ok: true, data: payload }
  }, [getAuthToken])

  const fetchGrowthData = useCallback((inicio, fim) => {
    const params = new URLSearchParams({ inicio, fim })
    return fetchAdminInsight(`growth?${params.toString()}`)
  }, [fetchAdminInsight])

  const fetchCustomers = useCallback((busca, page = 1) => {
    const params = new URLSearchParams({ por_pagina: '25', page: String(page) })
    if (busca) params.set('busca', busca)
    return fetchAdminInsight(`customers?${params.toString()}`)
  }, [fetchAdminInsight])

  const fetchCustomerAudit = useCallback((id) => (
    fetchAdminInsight(`customers/${encodeURIComponent(id)}/audit`)
  ), [fetchAdminInsight])

  const updateCustomer = useCallback(async (id, payload) => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sua sessão expirou. Entre novamente para editar clientes.' }

    const response = await fetch(`${API_BASE}/admin/customers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, message: result.message || 'Não foi possível atualizar o cliente.' }
    return { ok: true, data: result }
  }, [getAuthToken])

  const deleteCustomer = useCallback(async (id) => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sua sessão expirou. Entre novamente para excluir clientes.' }

    const response = await fetch(`${API_BASE}/admin/customers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, message: result.message || 'Não foi possível excluir o cliente.' }
    return { ok: true }
  }, [getAuthToken])

  const fetchIngredientes = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return null

    const response = await fetch(`${API_BASE}/admin/ingredientes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null

    return response.json()
  }, [getAuthToken])

  const fetchPrevisaoEstoque = useCallback(async (dias, prazoCompraDias) => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const params = new URLSearchParams({
      dias: String(dias),
      prazo_compra: String(prazoCompraDias),
    })
    const response = await fetch(`${API_BASE}/admin/estoque/previsao?${params}`, {
      headers: { Authorization: 'Bearer ' + token },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, message: payload.message || 'Falha ao carregar a previsão de estoque.' }
    }

    return { ok: true, data: payload }
  }, [getAuthToken])

  const fetchCompras = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return null

    const response = await fetch(`${API_BASE}/admin/compras`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null

    return response.json()
  }, [getAuthToken])

  const fetchResumoFinanceiro = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return null

    const response = await fetch(`${API_BASE}/admin/financeiro/resumo?meses=6`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null

    return response.json()
  }, [getAuthToken])

  const registrarCompra = useCallback(
    async (payload) => {
      const token = await getAuthToken()
      if (!token) {
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/compras`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao registrar compra.' }
      }

      return { ok: true, message: '' }
    },
    [getAuthToken],
  )

  const criarIngrediente = useCallback(
    async (payload) => {
      const token = await getAuthToken()
      if (!token) {
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/ingredientes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao criar ingrediente.' }
      }

      const ingrediente = await response.json()
      return { ok: true, message: '', ingrediente }
    },
    [getAuthToken],
  )

  const editarIngrediente = useCallback(
    async (ingredienteId, payload) => {
      const token = await getAuthToken()
      if (!token) {
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/ingredientes/${ingredienteId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao editar ingrediente.' }
      }

      return { ok: true, message: '' }
    },
    [getAuthToken],
  )

  const registrarMovimentoAvulso = useCallback(
    async (payload) => {
      const token = await getAuthToken()
      if (!token) {
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/estoque/movimento`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao registrar movimento de estoque.' }
      }

      const resultado = await response.json()
      return { ok: true, message: '', ingrediente: resultado.ingrediente }
    },
    [getAuthToken],
  )

  const fetchWhatsappStatus = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return null

    const response = await fetch(`${API_BASE}/admin/whatsapp/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null

    return response.json()
  }, [getAuthToken])

  const criarWhatsappInstancia = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const response = await fetch(`${API_BASE}/admin/whatsapp/instancia`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      return { ok: false, message: errorPayload.message || 'Falha ao criar instancia do WhatsApp.' }
    }

    return { ok: true, message: '', data: await response.json() }
  }, [getAuthToken])

  const gerarWhatsappQrCode = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const response = await fetch(`${API_BASE}/admin/whatsapp/qrcode`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      return { ok: false, message: errorPayload.message || 'Falha ao gerar QR Code.' }
    }

    return { ok: true, message: '', data: await response.json() }
  }, [getAuthToken])

  const desconectarWhatsapp = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const response = await fetch(`${API_BASE}/admin/whatsapp/desconectar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      return { ok: false, message: errorPayload.message || 'Falha ao desconectar o WhatsApp.' }
    }

    return { ok: true, message: '', data: await response.json() }
  }, [getAuthToken])

  const reconectarWhatsapp = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const response = await fetch(`${API_BASE}/admin/whatsapp/reconectar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      return { ok: false, message: errorPayload.message || 'Falha ao reconectar o WhatsApp.' }
    }

    return { ok: true, message: '', data: await response.json() }
  }, [getAuthToken])

  const salvarConfiguracoesMensagensWhatsapp = useCallback(async (configuracoes) => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const response = await fetch(`${API_BASE}/admin/whatsapp/configuracoes-mensagens`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(configuracoes),
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      return { ok: false, message: errorPayload.message || 'Falha ao salvar as mensagens do WhatsApp.' }
    }

    const resultado = await response.json()
    return { ok: true, message: '', data: resultado.configuracoes_mensagens }
  }, [getAuthToken])

  const fetchWhatsappConversas = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return null

    const response = await fetch(`${API_BASE}/admin/whatsapp/conversas`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null

    return response.json()
  }, [getAuthToken])

  const fetchWhatsappMensagens = useCallback(
    async (telefone) => {
      const token = await getAuthToken()
      if (!token) return null

      const response = await fetch(`${API_BASE}/admin/whatsapp/conversas/${telefone}/mensagens`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return null

      return response.json()
    },
    [getAuthToken],
  )

  const enviarWhatsappMensagem = useCallback(
    async (telefone, mensagem) => {
      const token = await getAuthToken()
      if (!token) return { ok: false, message: 'Sem token de acesso.' }

      const response = await fetch(`${API_BASE}/admin/whatsapp/conversas/${telefone}/mensagens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao enviar mensagem.' }
      }

      return { ok: true, message: '', data: await response.json() }
    },
    [getAuthToken],
  )

  const requestFiscal = useCallback(async (path, method = 'GET', body) => {
    try {
      const token = await getAuthToken()
      if (!token) return { ok: false, message: 'Sem token de acesso.' }
      const response = await fetch(`${API_BASE}/admin/${path}`, {
        method,
        headers: {
          Authorization: ['Be', 'arer'].join('') + ' ' + token,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
        return { ok: false, message: `O serviço fiscal retornou uma resposta inesperada (HTTP ${response.status}). Verifique a API e sua configuração.` }
      }
      const payload = await response.json()
      if (!response.ok) {
        return { ok: false, message: Object.values(payload.errors || {}).flat()[0] || payload.message || `Erro HTTP ${response.status}.` }
      }
      return { ok: true, data: payload }
    } catch (error) {
      return { ok: false, message: `Não foi possível comunicar com o serviço fiscal: ${error.message}` }
    }
  }, [getAuthToken])

  const fetchProdutos = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return null

    const response = await fetch(`${API_BASE}/admin/produtos`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null

    return response.json()
  }, [getAuthToken])

  const fetchCategorias = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return null

    const response = await fetch(`${API_BASE}/admin/categorias`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null

    return response.json()
  }, [getAuthToken])

  const fetchPromocoes = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const response = await fetch(`${API_BASE}/admin/promocoes`, {
      headers: { Authorization: ['Be', 'arer'].join('') + ' ' + token },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, message: payload.message || 'Não foi possível carregar as promoções.' }
    return { ok: true, data: payload.data || [] }
  }, [getAuthToken])

  const salvarPromocao = useCallback(async (id, payload) => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const response = await fetch(`${API_BASE}/admin/promocoes${id ? `/${id}` : ''}`, {
      method: id ? 'PATCH' : 'POST',
      headers: {
        Authorization: ['Be', 'arer'].join('') + ' ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const validationMessage = Object.values(result.errors || {}).flat()[0]
      return {
        ok: false,
        message: validationMessage || result.message || `Não foi possível salvar a promoção (HTTP ${response.status}).`,
      }
    }
    return { ok: true, data: result.data }
  }, [getAuthToken])

  const criarProduto = useCallback(
    async (payload) => {
      const token = await getAuthToken()
      if (!token) {
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const formData = new FormData()
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value)
        }
      })

      const response = await fetch(`${API_BASE}/admin/produtos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao criar produto.' }
      }

      return { ok: true, message: '' }
    },
    [getAuthToken],
  )

  const criarCategoria = useCallback(
    async (nome) => {
      const token = await getAuthToken()
      if (!token) {
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/categorias`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nome }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao criar categoria.' }
      }

      const categoria = await response.json()
      return { ok: true, message: '', categoria }
    },
    [getAuthToken],
  )

  const atualizarCategoria = useCallback(async (id, nome) => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const response = await fetch(`${API_BASE}/admin/categorias/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nome }),
    })
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      return { ok: false, message: errorPayload.message || `Falha ao alterar categoria (HTTP ${response.status}).` }
    }

    return { ok: true, categoria: await response.json() }
  }, [getAuthToken])

  const atualizarProduto = useCallback(
    async (produtoId, payload) => {
      const token = await getAuthToken()
      if (!token) {
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/produtos/${produtoId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao atualizar produto.' }
      }

      return { ok: true, message: '' }
    },
    [getAuthToken],
  )

  const editarProduto = useCallback(
    async (produtoId, payload) => {
      const token = await getAuthToken()
      if (!token) {
        return { ok: false, message: 'Sem token de acesso.' }
      }

      // FormData + spoof de metodo (POST com _method=PATCH): PHP nao le corpo multipart em
      // requisicoes PATCH de verdade, e essa e a unica forma de mandar a foto nova junto com
      // os outros campos editados numa unica chamada.
      const formData = new FormData()
      formData.append('_method', 'PATCH')
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value)
        }
      })

      const response = await fetch(`${API_BASE}/admin/produtos/${produtoId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao editar produto.' }
      }

      return { ok: true, message: '' }
    },
    [getAuthToken],
  )

  const excluirProduto = useCallback(
    async (produtoId) => {
      const token = await getAuthToken()
      if (!token) {
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/produtos/${produtoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao excluir produto.' }
      }

      return { ok: true, message: '' }
    },
    [getAuthToken],
  )

  const fetchReceitaProduto = useCallback(
    async (produtoId) => {
      const token = await getAuthToken()
      if (!token) return null

      const response = await fetch(`${API_BASE}/admin/produtos/${produtoId}/receita`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return null

      return response.json()
    },
    [getAuthToken],
  )

  const salvarReceitaProduto = useCallback(
    async (produtoId, itens) => {
      const token = await getAuthToken()
      if (!token) {
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/produtos/${produtoId}/receita`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itens }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao salvar receita.' }
      }

      const receita = await response.json()
      return { ok: true, message: '', receita }
    },
    [getAuthToken],
  )

  const confirmarPagamentoComanda = useCallback(
    async (comandaId) => {
      const token = await getAuthToken()
      if (!token) {
        setApiEnabled(false)
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/comandas/${comandaId}/confirmar-pagamento`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao confirmar pagamento.' }
      }

      setComandasPendentes((prev) => prev.filter((comanda) => comanda.id_comanda !== comandaId))
      void fetchDashboardFromApi()
      return { ok: true, message: '' }
    },
    [fetchDashboardFromApi, getAuthToken],
  )

  const fetchEmpresa = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) {
      setApiEnabled(false)
      return
    }

    const response = await fetch(`${API_BASE}/admin/empresa`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) return

    setEmpresa(await response.json())
  }, [getAuthToken])

  const updateEmpresa = useCallback(
    async (payload) => {
      const token = await getAuthToken()
      if (!token) {
        setApiEnabled(false)
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/empresa`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao salvar.' }
      }

      setEmpresa(await response.json())
      return { ok: true, message: '' }
    },
    [getAuthToken],
  )

  const fetchMesaDetalhe = useCallback(
    async (mesaId) => {
      const token = await getAuthToken()
      if (!token) return { ok: false, message: 'Sem token de acesso.' }

      const response = await fetch(`${API_BASE}/admin/mesas/${mesaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao carregar a mesa.' }
      }

      return { ok: true, data: await response.json() }
    },
    [getAuthToken],
  )

  const requestMesa = useCallback(async (path, method = 'GET', body) => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }
    let response
    try {
      response = await fetch(`${API_BASE}/admin/mesas${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    } catch (error) {
      return { ok: false, message: `Não foi possível comunicar com o servidor: ${error.message}` }
    }
    let payload
    try {
      payload = await response.json()
    } catch {
      return { ok: false, message: `Resposta inesperada da API (HTTP ${response.status}).` }
    }
    if (!response.ok) return { ok: false, message: Object.values(payload.errors || {}).flat()[0] || payload.message || `Erro HTTP ${response.status}.` }
    if (method !== 'GET') {
      try {
        if (!await fetchDashboardFromApi()) return { ok: true, data: payload.data, message: 'Alteração salva, mas não foi possível atualizar a lista de mesas.' }
      } catch {
        return { ok: true, data: payload.data, message: 'Alteração salva, mas não foi possível atualizar a lista de mesas.' }
      }
    }
    return { ok: true, data: payload.data, message: payload.message || '' }
  }, [getAuthToken, fetchDashboardFromApi])

  const liberarMesa = useCallback(
    async (mesaId) => {
      const token = await getAuthToken()
      if (!token) return { ok: false, message: 'Sem token de acesso.' }

      const response = await fetch(`${API_BASE}/admin/mesas/${mesaId}/liberar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao liberar a mesa.' }
      }

      await fetchDashboardFromApi()

      return { ok: true, message: '' }
    },
    [getAuthToken, fetchDashboardFromApi],
  )

  const adicionarNaFilaEspera = useCallback(
    async (payload) => {
      const token = await getAuthToken()
      if (!token) return { ok: false, message: 'Sem token de acesso.' }

      const response = await fetch(`${API_BASE}/admin/mesas/fila-espera`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao adicionar na fila de espera.' }
      }

      await fetchDashboardFromApi()

      return { ok: true, message: '' }
    },
    [getAuthToken, fetchDashboardFromApi],
  )

  const removerDaFilaEspera = useCallback(
    async (id) => {
      const token = await getAuthToken()
      if (!token) return { ok: false, message: 'Sem token de acesso.' }

      const response = await fetch(`${API_BASE}/admin/mesas/fila-espera/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao remover da fila de espera.' }
      }

      await fetchDashboardFromApi()

      return { ok: true, message: '' }
    },
    [getAuthToken, fetchDashboardFromApi],
  )

  const exportarRelatorio = useCallback(async (filters) => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'columns') {
        value.forEach((column) => params.append('columns[]', column))
      } else if (value) {
        params.set(key, value)
      }
    })

    const response = await fetch(`${API_BASE}/admin/relatorios/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      return { ok: false, message: errorPayload.message || 'Falha ao gerar o relatório.' }
    }

    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename="?([^"]+)"?/)
    const filename = match ? match[1] : 'relatorio-pedidos.csv'

    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    return { ok: true, message: '' }
  }, [getAuthToken])

  const atualizarChecklistFinanceiro = useCallback(
    async (itemId, checked) => {
      const token = await getAuthToken()
      if (!token) return { ok: false, message: 'Sem token de acesso.' }

      const response = await fetch(`${API_BASE}/admin/financeiro/checklist`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, checked }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao atualizar checklist.' }
      }

      await fetchDashboardFromApi()

      return { ok: true, message: '' }
    },
    [getAuthToken, fetchDashboardFromApi],
  )

  const fetchEntregadorEntregas = useCallback(
    async (entregadorId) => {
      const token = await getAuthToken()
      if (!token) return { ok: false, message: 'Sem token de acesso.' }

      const response = await fetch(`${API_BASE}/admin/motoboys/${entregadorId}/entregas`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao carregar as entregas.' }
      }

      return { ok: true, data: await response.json() }
    },
    [getAuthToken],
  )

  const createUser = useCallback(
    async (payload) => {
      const token = await getAuthToken()
      if (!token) {
        setApiEnabled(false)
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/users/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao criar usuario.' }
      }

      const created = mapApiUser(await response.json())
      setUsers((prev) => [created, ...prev])
      return { ok: true, message: '', user: created }
    },
    [getAuthToken],
  )

  const updateUser = useCallback(async (userId, payload) => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, message: result.message || 'Falha ao atualizar usuário.' }

    const updated = mapApiUser(result)
    setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)))
    return { ok: true, user: updated }
  }, [getAuthToken])

  const deleteUser = useCallback(async (userId) => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, message: result.message || 'Falha ao excluir usuário.' }

    setUsers((prev) => prev.filter((user) => user.id !== Number(userId)))
    return { ok: true }
  }, [getAuthToken])

  const regeneratePairingCode = useCallback(
    async (userId) => {
      const token = await getAuthToken()
      if (!token) {
        setApiEnabled(false)
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/users/${userId}/gerar-codigo-pareamento`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao gerar codigo.' }
      }

      const updated = mapApiUser(await response.json())
      setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)))
      return { ok: true, message: '', user: updated }
    },
    [getAuthToken],
  )

  useEffect(() => {
    if (!isAuthenticated) return
    void fetchCurrentUser()
  }, [isAuthenticated, fetchCurrentUser])

  useEffect(() => {
    if (!isAuthenticated || !apiEnabled || !currentUser || !podeAcessarRota(currentUser.role, route)) return

    void fetchDashboardFromApi()

    if (route === '/pedidos' || route === '/painel' || route === '/cozinha' || route === '/entrega') {
      void fetchOrdersFromApi()
    }

    if (route === '/usuarios' || route === '/painel') {
      void fetchUsersFromApi()
    }

    if (route === '/mesas') {
      void fetchComandasPendentes()
      if (currentUser.role !== 'ATENDENTE') void fetchEmpresa()
    }
  }, [
    apiEnabled,
    fetchComandasPendentes,
    fetchDashboardFromApi,
    fetchEmpresa,
    fetchOrdersFromApi,
    fetchUsersFromApi,
    isAuthenticated,
    currentUser,
    route,
  ])

  // Pedido novo (mesa ou cardapio online) precisa aparecer sozinho pra cozinha, sem
  // depender de alguem apertar F5. Atualiza em segundo plano enquanto a tela mostra pedidos.
  // Mesas tambem entra aqui: cliente escaneando o QR e ocupando a mesa precisa refletir no
  // painel sem o admin precisar recarregar a pagina.
  useEffect(() => {
    if (!isAuthenticated || !apiEnabled || !currentUser || !podeAcessarRota(currentUser.role, route)) return undefined

    const precisaAoVivo =
      route === '/pedidos' || route === '/painel' || route === '/cozinha' || route === '/entrega' || route === '/mesas'
    if (!precisaAoVivo) return undefined

    const timer = setInterval(() => {
      if (route === '/mesas') {
        void fetchDashboardFromApi()
        void fetchComandasPendentes()
        return
      }

      void fetchOrdersFromApi()
      if (route === '/painel') void fetchDashboardFromApi()
    }, route === '/mesas' ? 5000 : 8000) // mesas: conta acompanhada em tempo real pelo QR

    return () => clearInterval(timer)
  }, [apiEnabled, isAuthenticated, currentUser, route, fetchOrdersFromApi, fetchDashboardFromApi, fetchComandasPendentes])

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }),
    [],
  )

  const pageTitle = useMemo(() => {
    const current = routes.find((item) => item.path === route)
    return current?.label || 'Pedidos'
  }, [route])

  const isPublicMenuRoute = route.startsWith('/cardapio/') && route !== '/cardapio/presencial'
  const isPublicMesaRoute = route.startsWith('/mesa/')
  const isPresencialRoute =
    route === '/cardapio/presencial' || route === '/presencial' || route.startsWith('/presencial/')

  // Aba do navegador so mostrava "Restaurante" em toda tela - agora reflete onde voce esta.
  useEffect(() => {
    if (isPresencialRoute) {
      document.title = 'Cardápio · Restaurante'
    } else if (isPublicMesaRoute) {
      document.title = 'Peça pela mesa · Restaurante'
    } else if (isPublicMenuRoute) {
      document.title = 'Cardápio Online · Restaurante'
    } else if (!isAuthenticated) {
      document.title = 'Login · Restaurante'
    } else {
      document.title = `${pageTitle} · Restaurante`
    }
  }, [isPresencialRoute, isPublicMesaRoute, isPublicMenuRoute, isAuthenticated, pageTitle])

  const pageSubtitle = useMemo(() => {
    const subtitles = {
      '/painel': 'Visao executiva da operacao em tempo real',
      '/pedidos': 'Controle central de pedidos',
      '/cardapio': 'Itens, precos e categorias do cardapio',
      '/promocoes': 'Descontos, cupons e regras de utilização',
      '/cozinha': 'Fila de preparo e expedição da cozinha',
      '/mesas': 'Ocupacao, reservas e fila de espera do salao',
      '/entrega': 'Rotas, motoboys e monitoramento de entregas',
      '/usuarios': 'Gestao de perfis e acessos internos',
      '/financeiro': 'Fluxo de caixa, pagamentos e fechamento diário',
      '/fiscal': 'Rascunhos e referências fiscais da empresa',
      '/relatorios': 'Indicadores operacionais e financeiros consolidados',
      '/armazem': 'Estoque atual, movimentações e previsão de reposição',
      '/clientes': 'Base de clientes, segmentos e campanhas',
      '/crescimento': 'Vendas, finanças, recorrência e satisfação dos clientes',
      '/pedidos_ifood': 'Integracoes com apps, canais externos e cadastro do cardapio online',
      '/whatsapp': 'Atendimento, automacoes e campanhas no WhatsApp',
    }

    return subtitles[route] || 'Controle central de pedidos'
  }, [route])

  if (isPresencialRoute) {
    return (
      <Suspense fallback={null}>
        <CardapioPresencial />
      </Suspense>
    )
  }

  if (isPublicMenuRoute) {
    return (
      <div className="delivery-shell">
        <CardapioPublico theme={theme} onToggleTheme={toggleTheme} />
      </div>
    )
  }

  if (isPublicMesaRoute) {
    return (
      <div className="delivery-shell">
        <MesaPublica theme={theme} onToggleTheme={toggleTheme} />
      </div>
    )
  }

  if (!AUTH_BYPASS && !isAuthenticated) {
    return (
      <Login
        onLogin={async (email, password) => {
          const result = await loginWithCredentials(email, password)
          if (result.ok) {
            navigate('/pedidos')
          }
          return result
        }}
      />
    )
  }

  if (!currentUser) {
    return <main className="page">{userLoadError ? <><div className="login-error" role="alert">{userLoadError}</div><button className="btn btn-light" type="button" onClick={fetchCurrentUser}>Tentar novamente</button><button className="btn btn-light" type="button" onClick={logout}>Sair</button></> : 'Verificando acesso...'}</main>
  }

  const rotaPermitida = podeAcessarRota(currentUser.role, route)
  const rotasVisiveis = routes.filter((item) => podeAcessarRota(currentUser.role, item.path))

  return (
    <div className="app-shell">
      {mobileMenuOpen && (
        <button
          className="mobile-nav-backdrop"
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <aside className={`sidebar${mobileMenuOpen ? ' sidebar-open' : ''}`} id="main-navigation">
        <div className="brand">
          <div className="brand-icon">
            <img className="brand-logo" src={logo} alt="Logo" />
          </div>
          <div>
            <strong>Restaurante</strong>
            <span>Gestao Completa</span>
          </div>
          <button
            className="mobile-menu-close"
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu de navegação"
          >
            ×
          </button>
        </div>
        <nav className="nav">
          {navGroups.filter((group) => group.paths.some((path) => podeAcessarRota(currentUser.role, path))).map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.paths.map((path) => {
                const routeItem = routes.find((item) => item.path === path)
                if (!routeItem || !podeAcessarRota(currentUser.role, path)) return null
                return (
                  <button
                    key={routeItem.path}
                    className={`nav-item ${routeItem.path === route ? 'active' : ''}`}
                    data-route={routeItem.path}
                    type="button"
                    onClick={() => navigate(routeItem.path)}
                  >
                    <span className="nav-icon">{routeItem.code}</span>
                    {routeItem.label}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="user-avatar">{getInitials(currentUser?.name)}</span>
            <div className="user-chip-info">
              <strong>{currentUser?.name || 'Carregando...'}</strong>
              <span>{roleLabels[currentUser?.role] || currentUser?.role || ''}</span>
            </div>
            <button className="user-logout" type="button" onClick={logout} aria-label="Sair" title="Sair">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M15 17L20 12L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 4H5C4.44772 4 4 4.44772 4 5V19C4 19.5523 4.44772 20 5 20H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <span className="sidebar-version">v1.0 • Restaurante</span>
        </div>
      </aside>
      <div className="app-main">
        <header
          className={`topbar topbar-flat${route === '/painel' ? ' topbar-dashboard' : route === '/pedidos' ? ' topbar-orders' : ''}`}
        >
          <div className="topbar-left">
            <button
              className="mobile-menu-toggle"
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu de navegação"
              aria-expanded={mobileMenuOpen}
              aria-controls="main-navigation"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <span className="pulse"></span>
            <div>
              <h1>{pageTitle}</h1>
              <p>{pageSubtitle}</p>
            </div>
          </div>
          <div className="topbar-right">
            <button
              className="btn btn-light theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <span className="topbar-date">{todayLabel}</span>
            <select
              className="route-select"
              value={route}
              onChange={(event) => {
                const target = event.target.value
                if (target.startsWith('/cardapio/') || target === '/motoboy/') {
                  const destinationUrl = new URL(target, window.location.href)
                  if (target === '/motoboy/' && !window.location.hostname.includes('ngrok')) {
                    destinationUrl.port = '5174'
                  }
                  window.open(destinationUrl.href, '_blank', 'noopener,noreferrer')
                  return
                }
                navigate(target)
              }}
              aria-label="Ir para pagina"
            >
              {rotasVisiveis.map((routeItem) => (
                <option key={routeItem.path} value={routeItem.path}>
                  {routeItem.label}
                </option>
              ))}
            </select>
            {!rotaPermitida && <div className="notice notice-danger" role="alert">Você não tem acesso a esta tela. <button className="btn btn-light" type="button" onClick={() => navigate('/pedidos')}>Ir para Pedidos</button></div>}
            {rotaPermitida && route === '/pedidos' && (
              <button className="btn btn-primary" type="button" onClick={() => setIsNewOrderOpen(true)}>
                Novo Pedido
              </button>
            )}
          </div>
        </header>
        {isNewOrderOpen && (
          <NovoPedidoModal onCreate={createOrder} onClose={() => setIsNewOrderOpen(false)} />
        )}
        <main className="page">
          {route === '/pedidos' && (
            <Pedidos
              orders={orders}
              filters={filters}
              setFilters={setFilters}
              statusLabels={statusLabels}
              statusTone={statusTone}
              onUpdateStatus={updateOrderStatus}
            />
          )}
          {rotaPermitida && route === '/cardapio' && (
            <Cardapio
              somenteLeitura={currentUser.role === 'ATENDENTE'}
              onFetchProdutos={fetchProdutos}
              onFetchCategorias={fetchCategorias}
              onCriarProduto={criarProduto}
              onCriarCategoria={criarCategoria}
              onAtualizarProduto={atualizarProduto}
              onEditarProduto={editarProduto}
              onExcluirProduto={excluirProduto}
              onFetchIngredientes={fetchIngredientes}
              onFetchReceita={fetchReceitaProduto}
              onSalvarReceita={salvarReceitaProduto}
              requestFiscal={requestFiscal}
            />
          )}
          {rotaPermitida && route === '/fiscal' && <FiscalContabil requestFiscal={requestFiscal} />}
          {rotaPermitida && route === '/promocoes' && (
            <Promocoes
              onFetchPromocoes={fetchPromocoes}
              onFetchProdutos={fetchProdutos}
              onFetchCategorias={fetchCategorias}
              onSalvarPromocao={salvarPromocao}
            />
          )}
          {rotaPermitida && route === '/usuarios' && (
            <Usuarios
              users={users}
              onCreateUser={createUser}
              onUpdateUser={updateUser}
              onDeleteUser={deleteUser}
              onLoadUsers={fetchUsersFromApi}
              onRegeneratePairingCode={regeneratePairingCode}
            />
          )}
          {rotaPermitida && route === '/painel' && (
            <Painel
              orders={orders}
              users={users}
              panelData={dashboardData.panelData}
              tablesData={dashboardData.tablesData}
            />
          )}
          {rotaPermitida && route === '/cozinha' && (
            <Cozinha
              orders={orders}
              kitchenData={dashboardData.kitchenData}
              statusLabels={statusLabels}
            />
          )}
          {rotaPermitida && route === '/mesas' && (
            <Mesas
              tablesData={dashboardData.tablesData}
              comandasPendentes={comandasPendentes}
              onConfirmarPagamento={confirmarPagamentoComanda}
              empresa={empresa}
              onUpdateEmpresa={currentUser.role === 'ATENDENTE' ? undefined : updateEmpresa}
              onFetchMesaDetalhe={fetchMesaDetalhe}
              onLiberarMesa={liberarMesa}
              requestMesa={requestMesa}
              onAdicionarFilaEspera={adicionarNaFilaEspera}
              onRemoverFilaEspera={removerDaFilaEspera}
            />
          )}
          {rotaPermitida && route === '/entrega' && (
            <Entrega
              orders={orders}
              deliveryData={dashboardData.deliveryData}
              onFetchEntregadorEntregas={fetchEntregadorEntregas}
            />
          )}
          {rotaPermitida && (route === '/crescimento' || route === '/financeiro') && (
            <Crescimento
              key={route}
              financeData={dashboardData.financeData}
              onFetchGrowth={fetchGrowthData}
              onNavigate={navigate}
              onVerPedido={(numero) => {
                setFilters({ search: String(numero), status: 'all', type: 'all' })
                navigate('/pedidos')
              }}
              onAtualizarChecklist={atualizarChecklistFinanceiro}
            />
          )}
          {rotaPermitida && route === '/relatorios' && <Relatorios onExportar={exportarRelatorio} />}
          {rotaPermitida && route === '/armazem' && (
            <Compras
              key={route}
              initialTab="armazem"
              onFetchIngredientes={fetchIngredientes}
              onFetchPrevisaoEstoque={fetchPrevisaoEstoque}
              onFetchCompras={fetchCompras}
              onFetchResumoFinanceiro={fetchResumoFinanceiro}
              onRegistrarCompra={registrarCompra}
              onCriarIngrediente={criarIngrediente}
              onEditarIngrediente={editarIngrediente}
              onRegistrarMovimentoAvulso={registrarMovimentoAvulso}
              onFetchCategorias={fetchCategorias}
              onCriarCategoria={criarCategoria}
              onAtualizarCategoria={atualizarCategoria}
            />
          )}
          {rotaPermitida && route === '/clientes' && (
            <Clientes
              customersData={dashboardData.customersData}
              onFetchCustomers={fetchCustomers}
              onFetchCustomerAudit={fetchCustomerAudit}
              onUpdateCustomer={updateCustomer}
              onDeleteCustomer={deleteCustomer}
            />
          )}
          {rotaPermitida && route === '/pedidos_ifood' && <Pedidos_Ifood marketplaceData={dashboardData.marketplaceData} />}
          {rotaPermitida && route === '/whatsapp' && (
            <WhatsApp
              onFetchStatus={fetchWhatsappStatus}
              onCriarInstancia={criarWhatsappInstancia}
              onGerarQrCode={gerarWhatsappQrCode}
              onDesconectar={desconectarWhatsapp}
              onReconectar={reconectarWhatsapp}
              onSalvarConfiguracoesMensagens={salvarConfiguracoesMensagensWhatsapp}
              onFetchConversas={fetchWhatsappConversas}
              onFetchMensagens={fetchWhatsappMensagens}
              onEnviarMensagem={enviarWhatsappMensagem}
            />
          )}

        </main>
      </div>
    </div>
  )
}
