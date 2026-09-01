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
import Compras from './pages/Compras.jsx'
import Cardapio from './pages/Cardapio.jsx'
import Clientes from './pages/Clientes.jsx'
import Pedidos_Ifood from './pages/Pedidos_Ifood.jsx'
import WhatsApp from './pages/whatsApp.jsx'
import CardapioPublico from './pages_delivery/CardapioPublico.jsx'
import MesaPublica from './pages_delivery/MesaPublica.jsx'
import logo from './assets/logo.png'
import { resolveApiBase } from './utils/apiBase'


const API_BASE = resolveApiBase()
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
  saiu_entrega: 'badge-sun',
  entregue: 'badge-green',
  cancelado: 'badge-red',
}

const routes = [
  { path: '/painel', label: 'Painel', code: 'PN' },
  { path: '/pedidos', label: 'Pedidos', code: 'PD' },
  { path: '/cardapio', label: 'Cardapio', code: 'CD' },
  { path: '/cozinha', label: 'Cozinha', code: 'CZ' },
  { path: '/mesas', label: 'Mesas', code: 'MS' },
  { path: '/entrega', label: 'Entrega', code: 'EN' },
  { path: '/usuarios', label: 'Usuarios', code: 'US' },
  { path: '/financeiro', label: 'Financeiro', code: 'FN' },
  { path: '/relatorios', label: 'Relatorios', code: 'RL' },
  { path: '/compras', label: 'Compras e Lucros', code: 'CP' },
  { path: '/clientes', label: 'Clientes', code: 'CL' },
  { path: '/pedidos_ifood', label: 'Pedidos iFood', code: 'IF' },
  { path: '/whatsapp', label: 'WhatsApp', code: 'WA' },
]

const navGroups = [
  { label: 'Operação', paths: ['/painel', '/pedidos', '/cardapio', '/cozinha', '/mesas', '/entrega'] },
  { label: 'Gestão', paths: ['/usuarios', '/financeiro', '/relatorios', '/compras', '/clientes'] },
  { label: 'Canais', paths: ['/pedidos_ifood', '/whatsapp'] },
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
  note: order.note ? String(order.note) : undefined,
  status: order.status,
  paymentStatus: order.payment_status ?? null,
  motivoCancelamento: order.motivo_cancelamento ?? null,
  codigoQr: order.codigo_qr ?? null,
  total: Number(order.total ?? 0),
  items: Array.isArray(order.items) ? order.items : [],
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

  const fetchIngredientes = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return null

    const response = await fetch(`${API_BASE}/admin/ingredientes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null

    return response.json()
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

  const exportarRelatorio = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return { ok: false, message: 'Sem token de acesso.' }

    const response = await fetch(`${API_BASE}/admin/relatorios/export`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      return { ok: false, message: 'Falha ao gerar o relatorio.' }
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
  // Mesas tambem entra aqui: cliente escaneando o QR e ocupando a mesa precisa refletir no
  // painel sem o admin precisar recarregar a pagina.
  useEffect(() => {
    if (!isAuthenticated || !apiEnabled) return undefined

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
    }, 8000)

    return () => clearInterval(timer)
  }, [apiEnabled, isAuthenticated, route, fetchOrdersFromApi, fetchDashboardFromApi, fetchComandasPendentes])

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
      '/cardapio': 'Itens, precos e categorias do cardapio',
      '/cozinha': 'Fila de preparo e expedicao da cozinha',
      '/mesas': 'Ocupacao, reservas e fila de espera do salao',
      '/entrega': 'Rotas, motoboys e monitoramento de entregas',
      '/usuarios': 'Gestao de perfis e acessos internos',
      '/financeiro': 'Fluxo de caixa, comissoes e fechamento diario',
      '/relatorios': 'Indicadores operacionais e financeiros consolidados',
      '/compras': 'Compras, estoque de ingredientes e lucro mensal',
      '/clientes': 'Base de clientes, segmentos e campanhas',
      '/pedidos_ifood': 'Integracoes com apps, canais externos e cadastro do cardapio online',
      '/whatsapp': 'Atendimento, automacoes e campanhas no WhatsApp',
    }

    return subtitles[route] || 'Controle central de pedidos'
  }, [route])

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
          {route === '/cardapio' && (
            <Cardapio
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
              onLiberarMesa={liberarMesa}
              onAdicionarFilaEspera={adicionarNaFilaEspera}
              onRemoverFilaEspera={removerDaFilaEspera}
            />
          )}
          {route === '/entrega' && (
            <Entrega
              orders={orders}
              deliveryData={dashboardData.deliveryData}
              onFetchEntregadorEntregas={fetchEntregadorEntregas}
            />
          )}
          {route === '/financeiro' && (
            <Financeiro
              financeData={dashboardData.financeData}
              onVerPedido={(numero) => {
                setFilters({ search: String(numero), status: 'all', type: 'all' })
                navigate('/pedidos')
              }}
              onAtualizarChecklist={atualizarChecklistFinanceiro}
            />
          )}
          {route === '/relatorios' && (
            <Relatorios reportsData={dashboardData.reportsData} onExportar={exportarRelatorio} />
          )}
          {route === '/compras' && (
            <Compras
              onFetchIngredientes={fetchIngredientes}
              onFetchCompras={fetchCompras}
              onFetchResumoFinanceiro={fetchResumoFinanceiro}
              onRegistrarCompra={registrarCompra}
              onCriarIngrediente={criarIngrediente}
              onEditarIngrediente={editarIngrediente}
              onRegistrarMovimentoAvulso={registrarMovimentoAvulso}
            />
          )}
          {route === '/clientes' && <Clientes customersData={dashboardData.customersData} />}
          {route === '/pedidos_ifood' && <Pedidos_Ifood marketplaceData={dashboardData.marketplaceData} />}
          {route === '/whatsapp' && (
            <WhatsApp
              onFetchStatus={fetchWhatsappStatus}
              onCriarInstancia={criarWhatsappInstancia}
              onGerarQrCode={gerarWhatsappQrCode}
              onDesconectar={desconectarWhatsapp}
              onReconectar={reconectarWhatsapp}
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
