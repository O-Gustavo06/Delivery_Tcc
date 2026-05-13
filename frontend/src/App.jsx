import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Login from './pages/Login.jsx'
import Pedidos from './pages/Pedidos.jsx'
import Usuarios from './pages/Usuarios.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Cozinha from './pages/Cozinha.jsx'
import Mesas from './pages/Mesas.jsx'
import Delivery from './pages/Delivery.jsx'
import Financeiro from './pages/Financeiro.jsx'
import Relatorios from './pages/Relatorios.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'
const DEMO_CREDENTIALS = {
  email: 'gustavolimadossantos643@gmail.com',
  password: 'admin123',
}

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
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/pedidos', label: 'Pedidos' },
  { path: '/cozinha', label: 'Cozinha' },
  { path: '/mesas', label: 'Mesas' },
  { path: '/delivery', label: 'Delivery' },
  { path: '/usuarios', label: 'Usuarios' },
  { path: '/financeiro', label: 'Financeiro' },
  { path: '/relatorios', label: 'Relatorios' },
]

const mockOrders = [
  {
    id: 1,
    number: 1001,
    type: 'mesa',
    tableNumber: 12,
    customerName: 'Mesa 12',
    status: 'novo',
    total: 58.5,
    items: [
      { name: 'Pizza Calabresa', qty: 1, price: 39.9 },
      { name: 'Refrigerante Lata', qty: 2, price: 9.3 },
    ],
    createdAt: '10:10',
  },
  {
    id: 2,
    number: 1002,
    type: 'delivery',
    tableNumber: null,
    customerName: 'Joao Silva',
    address: 'Rua A, 123 - Centro',
    status: 'enviado_cozinha',
    total: 72.0,
    items: [
      { name: 'Lanche X', qty: 2, price: 18 },
      { name: 'Batata Media', qty: 1, price: 12 },
      { name: 'Suco', qty: 2, price: 12 },
    ],
    createdAt: '10:22',
  },
  {
    id: 3,
    number: 1003,
    type: 'mesa',
    tableNumber: 5,
    customerName: 'Mesa 5',
    status: 'em_preparo',
    total: 42.0,
    items: [
      { name: 'File de Frango', qty: 1, price: 26 },
      { name: 'Arroz Integral', qty: 1, price: 16 },
    ],
    createdAt: '10:31',
  },
  {
    id: 4,
    number: 1004,
    type: 'delivery',
    tableNumber: null,
    customerName: 'Carlos Lima',
    address: 'Av. Paulista, 456 - Apto 12',
    status: 'pronto',
    total: 98.0,
    items: [
      { name: 'Hamburguer Artesanal', qty: 2, price: 28 },
      { name: 'Batata Frita', qty: 1, price: 14 },
    ],
    createdAt: '10:45',
  },
]

const getInitialRoute = () => {
  if (window.location.pathname === '/') {
    return '/pedidos'
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
  type: order.type,
  tableNumber: order.table_number ?? order.tableNumber ?? null,
  customerName: String(order.customer_name ?? order.customerName ?? ''),
  address: order.address ? String(order.address) : undefined,
  status: order.status,
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
})

export default function App() {
  const [route, setRoute] = useState(getInitialRoute)
  const [orders, setOrders] = useState([...mockOrders])
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({ search: '', status: 'all', type: 'all' })
  const [apiToken, setApiToken] = useState(null)
  const [apiEnabled, setApiEnabled] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const cached = window.localStorage.getItem('adminToken')
    if (cached) {
      setApiToken(cached)
      setIsAuthenticated(true)
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

    return { ok: true, message: '' }
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
    navigate('/login')
  }, [getAuthToken, navigate])

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

  const updateOrderStatus = useCallback(
    async (orderId, status) => {
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
        body: JSON.stringify({ status }),
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

  const createUser = useCallback(
    async (payload) => {
      const token = await getAuthToken()
      if (!token) {
        setApiEnabled(false)
        return { ok: false, message: 'Sem token de acesso.' }
      }

      const response = await fetch(`${API_BASE}/admin/users`, {
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
      return { ok: true, message: '' }
    },
    [getAuthToken],
  )

  useEffect(() => {
    if (!isAuthenticated || !apiEnabled) return

    if (route === '/pedidos') {
      void fetchOrdersFromApi()
    }

    if (route === '/usuarios') {
      void fetchUsersFromApi()
    }
  }, [apiEnabled, fetchOrdersFromApi, fetchUsersFromApi, isAuthenticated, route])

  const pageTitle = useMemo(() => {
    const current = routes.find((item) => item.path === route)
    return current?.label || 'Pedidos'
  }, [route])

  if (!isAuthenticated) {
    return (
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">
              <span>R</span>
            </div>
            <div>
              <strong>RestaurantOS</strong>
              <span>Gestao Completa</span>
            </div>
          </div>
        </aside>
        <div className="app-main">
          <header className="topbar">
            <div className="topbar-left">
              <span className="pulse"></span>
              <div>
                <h1>Acesso</h1>
                <p>Entre para continuar</p>
              </div>
            </div>
          </header>
          <main className="page">
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
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <span>R</span>
          </div>
          <div>
            <strong>RestaurantOS</strong>
            <span>Gestao Completa</span>
          </div>
        </div>
        <nav className="nav">
          {routes.map((routeItem) => (
            <button
              key={routeItem.path}
              className={`nav-item ${routeItem.path === route ? 'active' : ''}`}
              data-route={routeItem.path}
              type="button"
              onClick={() => navigate(routeItem.path)}
            >
              <span className="nav-dot"></span>
              {routeItem.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-light btn-logout" type="button" onClick={logout}>
            Sair
          </button>
          <span>v1.0 • RestaurantOS</span>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <span className="pulse"></span>
            <div>
              <h1>{pageTitle}</h1>
              <p>Controle central de pedidos</p>
            </div>
          </div>
          <div className="topbar-right">
            <select
              className="route-select"
              value={route}
              onChange={(event) => navigate(event.target.value)}
              aria-label="Selecionar rota"
            >
              {routes.map((routeItem) => (
                <option key={routeItem.path} value={routeItem.path}>
                  {routeItem.path}
                </option>
              ))}
            </select>
            {route === '/pedidos' && <button className="btn btn-primary">Novo Pedido</button>}
          </div>
        </header>
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
            <Usuarios users={users} onCreateUser={createUser} onLoadUsers={fetchUsersFromApi} />
          )}
          {route === '/dashboard' && <Dashboard />}
          {route === '/cozinha' && <Cozinha />}
          {route === '/mesas' && <Mesas />}
          {route === '/delivery' && <Delivery />}
          {route === '/financeiro' && <Financeiro />}
          {route === '/relatorios' && <Relatorios />}
        </main>
      </div>
    </div>
  )
}
