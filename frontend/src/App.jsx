import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Login from './pages/Login.jsx'
import Pedidos from './pages/Pedidos.jsx'
import NovoPedidoModal from './pages/NovoPedidoModal.jsx'
import Usuarios from './pages/Usuarios.jsx'
import Painel from './pages/Painel.jsx'
import Cozinha from './pages/Cozinha.jsx'
import Mesas from './pages/Mesas.jsx'
import Entrega from './pages/Entrega.jsx'
import Financeiro from './pages/Financeiro.jsx'
import Relatorios from './pages/Relatorios.jsx'
import Clientes from './pages/Clientes.jsx'
import Peidos_Ifood from './pages/Peidos_Ifood.jsx'
import WhatsApp from './pages/whatsApp.jsx'
import CardapioPublico from './pages_delivery/CardapioPublico.jsx'
import MesaPublica from './pages_delivery/MesaPublica.jsx'
import logo from './assets/logo.png'


const API_BASE =
  import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api`
const DEMO_CREDENTIALS = {
  email: 'gustavolimadossantos643@gmail.com',
  password: 'admin123',
}

const AUTH_BYPASS = false

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
  saiu_entrega: 'badge-lime',
  entregue: 'badge-muted',
  cancelado: 'badge-red',
}

const routes = [
  { path: '/painel', label: 'Painel', code: 'PN' },
  { path: '/pedidos', label: 'Pedidos', code: 'PD' },
  { path: '/cozinha', label: 'Cozinha', code: 'CZ' },
  { path: '/mesas', label: 'Mesas', code: 'MS' },
  { path: '/entrega', label: 'Entrega', code: 'EN' },
  { path: '/usuarios', label: 'Usuarios', code: 'US' },
  { path: '/financeiro', label: 'Financeiro', code: 'FN' },
  { path: '/relatorios', label: 'Relatorios', code: 'RL' },
  { path: '/clientes', label: 'Clientes', code: 'CL' },
  { path: '/peidos_ifood', label: 'Pedidos iFood', code: 'IF' },
  { path: '/whatsapp', label: 'WhatsApp', code: 'WA' },
]

const navGroups = [
  { label: 'Operação', paths: ['/painel', '/pedidos', '/cozinha', '/mesas', '/entrega'] },
  { label: 'Gestão', paths: ['/usuarios', '/financeiro', '/relatorios', '/clientes'] },
  { label: 'Canais', paths: ['/peidos_ifood', '/whatsapp'] },
]

const roleLabels = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  ATENDENTE: 'Atendente',
  ENTREGADOR: 'Entregador',
}

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
  whatsappData: {
    inbox: [],
    automations: [],
    campaigns: [],
  },
}

const getInitialRoute = () => {
  if (window.location.pathname === '/') {
    return '/login'
  }

  return window.location.pathname
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
  status: order.status,
  motivoCancelamento: order.motivo_cancelamento ?? null,
  codigoQr: order.codigo_qr ?? null,
  total: Number(order.total ?? 0),
  items: Array.isArray(order.items) ? order.items : [],
  createdAt: formatTime(String(order.created_at ?? order.createdAt ?? '')),
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
  whatsappData: { ...EMPTY_DASHBOARD_DATA.whatsappData, ...(payload.whatsappData ?? {}) },
})

export default function App() {
  const [route, setRoute] = useState(getInitialRoute)
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState([])
  const [dashboardData, setDashboardData] = useState(EMPTY_DASHBOARD_DATA)
  const [filters, setFilters] = useState({ search: '', status: 'all', type: 'all' })
  const [apiToken, setApiToken] = useState(null)
  const [apiEnabled, setApiEnabled] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false)
  const [comandasPendentes, setComandasPendentes] = useState([])
  const [empresa, setEmpresa] = useState(null)

  useEffect(() => {
    if (AUTH_BYPASS) {
      setIsAuthenticated(true)
      return undefined
    }

    const cached = window.localStorage.getItem('adminToken')
    if (cached) {
      setApiToken(cached)
      setIsAuthenticated(true)
      if (getInitialRoute() === '/login') {
        navigate('/painel')
      }
    }

    const handlePopstate = () => setRoute(getInitialRoute())
    window.addEventListener('popstate', handlePopstate)

    return () => window.removeEventListener('popstate', handlePopstate)
  }, [])

  const navigate = useCallback((path) => {
    window.history.pushState({}, '', path)
    setRoute(path)
  }, [])

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

      window.localStorage.setItem('adminToken', payload.token)
      setApiToken(payload.token)
      setIsAuthenticated(true)
      if (payload.user) setCurrentUser(mapApiUser(payload.user))

      return { ok: true, message: '' }
    } catch {
      return { ok: false, message: 'Nao foi possivel conectar ao servidor.' }
    }
  }, [])

  const logout = useCallback(async () => {
    const token = await getAuthToken()
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null)
    }

    window.localStorage.removeItem('adminToken')
    setApiToken(null)
    setIsAuthenticated(false)
    setCurrentUser(null)
    navigate('/login')
  }, [getAuthToken, navigate])

  const fetchCurrentUser = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return

    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) return

    const payload = await response.json()
    if (payload) setCurrentUser(mapApiUser(payload))
  }, [getAuthToken])

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

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        return { ok: false, message: errorPayload.message || 'Falha ao criar pedido.' }
      }

      const created = mapApiOrder(await response.json())
      setOrders((prev) => [created, ...prev])
      return { ok: true, message: '' }
    },
    [getAuthToken],
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
      return
    }

    const response = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      setApiEnabled(false)
      return
    }

    const payload = await response.json()
    setDashboardData(mergeDashboardData(payload))
  }, [getAuthToken])

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
    if (!isAuthenticated || !apiEnabled) return

    void fetchDashboardFromApi()

    if (route === '/pedidos' || route === '/painel' || route === '/cozinha' || route === '/entrega') {
      void fetchOrdersFromApi()
    }

    if (route === '/usuarios' || route === '/painel') {
      void fetchUsersFromApi()
    }

    if (route === '/mesas') {
      void fetchComandasPendentes()
      void fetchEmpresa()
    }
  }, [
    apiEnabled,
    fetchComandasPendentes,
    fetchDashboardFromApi,
    fetchEmpresa,
    fetchOrdersFromApi,
    fetchUsersFromApi,
    isAuthenticated,
    route,
  ])

  // Pedido novo (mesa ou cardapio online) precisa aparecer sozinho pra cozinha, sem
  // depender de alguem apertar F5. Atualiza em segundo plano enquanto a tela mostra pedidos.
  useEffect(() => {
    if (!isAuthenticated || !apiEnabled) return undefined

    const precisaPedidosAoVivo =
      route === '/pedidos' || route === '/painel' || route === '/cozinha' || route === '/entrega'
    if (!precisaPedidosAoVivo) return undefined

    const timer = setInterval(() => {
      void fetchOrdersFromApi()
      if (route === '/painel') void fetchDashboardFromApi()
    }, 8000)

    return () => clearInterval(timer)
  }, [apiEnabled, isAuthenticated, route, fetchOrdersFromApi, fetchDashboardFromApi])

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

  const isPublicMenuRoute = route.startsWith('/cardapio/')
  const isPublicMesaRoute = route.startsWith('/mesa/')

  // Aba do navegador so mostrava "Restaurante" em toda tela - agora reflete onde voce esta.
  useEffect(() => {
    if (isPublicMesaRoute) {
      document.title = 'Peça pela mesa · Restaurante'
    } else if (isPublicMenuRoute) {
      document.title = 'Cardápio Online · Restaurante'
    } else if (!isAuthenticated) {
      document.title = 'Login · Restaurante'
    } else {
      document.title = `${pageTitle} · Restaurante`
    }
  }, [isPublicMesaRoute, isPublicMenuRoute, isAuthenticated, pageTitle])

  const pageSubtitle = useMemo(() => {
    const subtitles = {
      '/painel': 'Visao executiva da operacao em tempo real',
      '/pedidos': 'Controle central de pedidos',
      '/cozinha': 'Fila de preparo e expedicao da cozinha',
      '/mesas': 'Ocupacao, reservas e fila de espera do salao',
      '/entrega': 'Rotas, motoboys e monitoramento de entregas',
      '/usuarios': 'Gestao de perfis e acessos internos',
      '/financeiro': 'Fluxo de caixa, comissoes e fechamento diario',
      '/relatorios': 'Indicadores operacionais e financeiros consolidados',
      '/clientes': 'Base de clientes, segmentos e campanhas',
      '/peidos_ifood': 'Integracoes com apps, canais externos e cadastro do cardapio online',
      '/whatsapp': 'Atendimento, automacoes e campanhas no WhatsApp',
    }

    return subtitles[route] || 'Controle central de pedidos'
  }, [route])

  if (isPublicMenuRoute) {
    return (
      <div className="delivery-shell">
        <CardapioPublico />
      </div>
    )
  }

  if (isPublicMesaRoute) {
    return (
      <div className="delivery-shell">
        <MesaPublica />
      </div>
    )
  }

  if (!AUTH_BYPASS && !isAuthenticated) {
    return (
      <Login
        defaultEmail={DEMO_CREDENTIALS.email}
        defaultPassword={DEMO_CREDENTIALS.password}
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <img className="brand-logo" src={logo} alt="Logo" />
          </div>
          <div>
            <strong>Restaurante</strong>
            <span>Gestao Completa</span>
          </div>
        </div>
        <nav className="nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.paths.map((path) => {
                const routeItem = routes.find((item) => item.path === path)
                if (!routeItem) return null
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
        <header className="topbar">
          <div className="topbar-left">
            <span className="pulse"></span>
            <div>
              <h1>{pageTitle}</h1>
              <p>{pageSubtitle}</p>
            </div>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">{todayLabel}</span>
            <select
              className="route-select"
              value={route}
              onChange={(event) => navigate(event.target.value)}
              aria-label="Ir para pagina"
            >
              {routes.map((routeItem) => (
                <option key={routeItem.path} value={routeItem.path}>
                  {routeItem.label}
                </option>
              ))}
            </select>
            {route === '/pedidos' && (
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
          {route === '/usuarios' && (
            <Usuarios
              users={users}
              onCreateUser={createUser}
              onLoadUsers={fetchUsersFromApi}
              onRegeneratePairingCode={regeneratePairingCode}
            />
          )}
          {route === '/painel' && (
            <Painel
              orders={orders}
              users={users}
              panelData={dashboardData.panelData}
              tablesData={dashboardData.tablesData}
            />
          )}
          {route === '/cozinha' && (
            <Cozinha
              orders={orders}
              kitchenData={dashboardData.kitchenData}
              statusLabels={statusLabels}
            />
          )}
          {route === '/mesas' && (
            <Mesas
              tablesData={dashboardData.tablesData}
              comandasPendentes={comandasPendentes}
              onConfirmarPagamento={confirmarPagamentoComanda}
              empresa={empresa}
              onUpdateEmpresa={updateEmpresa}
              onFetchMesaDetalhe={fetchMesaDetalhe}
            />
          )}
          {route === '/entrega' && (
            <Entrega
              orders={orders}
              deliveryData={dashboardData.deliveryData}
              onFetchEntregadorEntregas={fetchEntregadorEntregas}
            />
          )}
          {route === '/financeiro' && <Financeiro financeData={dashboardData.financeData} />}
          {route === '/relatorios' && <Relatorios reportsData={dashboardData.reportsData} />}
          {route === '/clientes' && <Clientes customersData={dashboardData.customersData} />}
          {route === '/peidos_ifood' && <Peidos_Ifood marketplaceData={dashboardData.marketplaceData} />}
          {route === '/whatsapp' && <WhatsApp whatsappData={dashboardData.whatsappData} />}

        </main>
      </div>
    </div>
  )
}
