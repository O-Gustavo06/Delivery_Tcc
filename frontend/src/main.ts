import './style.css'

type OrderStatus =
  | 'novo'
  | 'enviado_cozinha'
  | 'em_preparo'
  | 'pronto'
  | 'saiu_entrega'
  | 'entregue'
  | 'cancelado'

type OrderType = 'mesa' | 'delivery'

type OrderItem = {
  name: string
  qty: number
  price: number
}

type Order = {
  id: number
  number: number
  type: OrderType
  tableNumber?: number | null
  customerName: string
  address?: string
  status: OrderStatus
  total: number
  items: OrderItem[]
  createdAt: string
}

const API_BASE = '/api'
const DEMO_CREDENTIALS = {
  email: 'admin@local.test',
  password: 'admin123',
}

const mockOrders: Order[] = [
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

let orders: Order[] = [...mockOrders]
let apiToken: string | null = null
let apiEnabled = true

const statusLabels: Record<OrderStatus, string> = {
  novo: 'Novo',
  enviado_cozinha: 'Cozinha',
  em_preparo: 'Preparando',
  pronto: 'Pronto',
  saiu_entrega: 'Saiu entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const statusTone: Record<OrderStatus, string> = {
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
  { path: '/financeiro', label: 'Financeiro' },
  { path: '/relatorios', label: 'Relatorios' },
]

const filters = {
  search: '',
  status: 'all',
  type: 'all',
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">
          <span>R</span>
        </div>
        <div>
          <strong>RestaurantOS</strong>
          <span>Gestao Completa</span>
        </div>
      </div>
      <nav class="nav">
        ${routes
          .map(
            (route) => `
          <button class="nav-item" data-route="${route.path}">
            <span class="nav-dot"></span>
            ${route.label}
          </button>
        `,
          )
          .join('')}
      </nav>
      <div class="sidebar-footer">v1.0 • RestaurantOS</div>
    </aside>
    <div class="app-main">
      <header class="topbar">
        <div class="topbar-left">
          <span class="pulse"></span>
          <div>
            <h1 id="pageTitle">Pedidos</h1>
            <p id="pageSubtitle">Controle central de pedidos</p>
          </div>
        </div>
        <div class="topbar-right">
          <select id="routeSelect" class="route-select" aria-label="Selecionar rota">
            ${routes
              .map(
                (route) => `
              <option value="${route.path}">${route.path}</option>
            `,
              )
              .join('')}
          </select>
          <button class="btn btn-primary">Novo Pedido</button>
        </div>
      </header>
      <main id="page" class="page"></main>
    </div>
  </div>
`

const page = document.querySelector<HTMLDivElement>('#page')
const title = document.querySelector<HTMLHeadingElement>('#pageTitle')
const subtitle = document.querySelector<HTMLParagraphElement>('#pageSubtitle')
const routeSelect = document.querySelector<HTMLSelectElement>('#routeSelect')

if (!page || !title || !subtitle || !routeSelect) {
  throw new Error('Layout nodes not found')
}

const setHeader = (heading: string, sub: string) => {
  title.textContent = heading
  subtitle.textContent = sub
}

const formatMoney = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatTime = (value: string) => {
  if (!value) return ''
  if (value.includes(' ')) {
    const parts = value.split(' ')
    return parts[1]?.slice(0, 5) ?? value
  }
  return value.slice(0, 5)
}

const mapApiOrder = (order: Record<string, unknown>): Order => {
  return {
    id: Number(order.id),
    number: Number(order.number),
    type: order.type as OrderType,
    tableNumber: (order.table_number ?? order.tableNumber ?? null) as number | null,
    customerName: String(order.customer_name ?? order.customerName ?? ''),
    address: order.address ? String(order.address) : undefined,
    status: order.status as OrderStatus,
    total: Number(order.total ?? 0),
    items: (order.items as OrderItem[]) ?? [],
    createdAt: formatTime(String(order.created_at ?? order.createdAt ?? '')),
  }
}

const getAuthToken = async (): Promise<string | null> => {
  if (apiToken) return apiToken

  const cached = window.localStorage.getItem('adminToken')
  if (cached) {
    apiToken = cached
    return cached
  }

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEMO_CREDENTIALS),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as { token?: string }
  if (payload.token) {
    window.localStorage.setItem('adminToken', payload.token)
    apiToken = payload.token
    return payload.token
  }

  return null
}

const fetchOrdersFromApi = async () => {
  const token = await getAuthToken()
  if (!token) {
    apiEnabled = false
    return
  }

  const response = await fetch(`${API_BASE}/admin/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    apiEnabled = false
    return
  }

  const payload = (await response.json()) as { data?: Record<string, unknown>[] }
  if (Array.isArray(payload.data)) {
    orders = payload.data.map(mapApiOrder)
  }
}

const updateOrderStatus = async (orderId: number, status: OrderStatus) => {
  if (!apiEnabled) {
    return
  }

  const token = await getAuthToken()
  if (!token) {
    apiEnabled = false
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

  if (!response.ok) {
    return
  }

  const payload = (await response.json()) as Record<string, unknown>
  const updated = mapApiOrder(payload)
  orders = orders.map((order) => (order.id === updated.id ? updated : order))
}

const renderOrdersPage = () => {
  setHeader('Pedidos', 'Fluxo completo de pedidos e cozinha')

  const filtered = orders.filter((order) => {
    const matchesStatus =
      filters.status === 'all' || order.status === filters.status
    const matchesType = filters.type === 'all' || order.type === filters.type
    const search = filters.search.trim().toLowerCase()
    const matchesSearch =
      !search ||
      order.customerName.toLowerCase().includes(search) ||
      order.number.toString().includes(search) ||
      order.items.some((item) => item.name.toLowerCase().includes(search))

    return matchesStatus && matchesType && matchesSearch
  })

  const counts = orders.reduce(
    (acc, order) => {
      acc.total += 1
      acc[order.status] += 1
      return acc
    },
    {
      total: 0,
      novo: 0,
      enviado_cozinha: 0,
      em_preparo: 0,
      pronto: 0,
      saiu_entrega: 0,
      entregue: 0,
      cancelado: 0,
    },
  )

  page.innerHTML = `
    <section class="cards">
      <div class="card metric">
        <div>
          <span>Total hoje</span>
          <strong>${counts.total}</strong>
        </div>
        <div class="metric-icon badge-orange">${counts.novo}</div>
      </div>
      <div class="card metric">
        <div>
          <span>Cozinha</span>
          <strong>${counts.enviado_cozinha + counts.em_preparo}</strong>
        </div>
        <div class="metric-icon badge-blue">${counts.em_preparo}</div>
      </div>
      <div class="card metric">
        <div>
          <span>Prontos</span>
          <strong>${counts.pronto}</strong>
        </div>
        <div class="metric-icon badge-green">${counts.pronto}</div>
      </div>
      <div class="card metric">
        <div>
          <span>Entrega</span>
          <strong>${counts.saiu_entrega}</strong>
        </div>
        <div class="metric-icon badge-lime">${counts.saiu_entrega}</div>
      </div>
    </section>

    <section class="filters card">
      <div class="filter-group">
        <label>Busca</label>
        <input id="filterSearch" type="search" placeholder="Cliente, numero ou item" value="${filters.search}" />
      </div>
      <div class="filter-group">
        <label>Status</label>
        <select id="filterStatus">
          <option value="all" ${filters.status === 'all' ? 'selected' : ''}>Todos</option>
          ${Object.entries(statusLabels)
            .map(
              ([value, label]) => `
            <option value="${value}" ${filters.status === value ? 'selected' : ''}>${label}</option>
          `,
            )
            .join('')}
        </select>
      </div>
      <div class="filter-group">
        <label>Tipo</label>
        <select id="filterType">
          <option value="all" ${filters.type === 'all' ? 'selected' : ''}>Todos</option>
          <option value="mesa" ${filters.type === 'mesa' ? 'selected' : ''}>Mesa</option>
          <option value="delivery" ${filters.type === 'delivery' ? 'selected' : ''}>Delivery</option>
        </select>
      </div>
      <div class="filter-group filter-actions">
        <button class="btn btn-light" id="filterReset">Limpar filtros</button>
      </div>
    </section>

    <section class="status-tabs">
      ${[
        { label: 'Todos', value: 'all' },
        { label: 'Novos', value: 'novo' },
        { label: 'Cozinha', value: 'enviado_cozinha' },
        { label: 'Preparando', value: 'em_preparo' },
        { label: 'Prontos', value: 'pronto' },
        { label: 'Entrega', value: 'saiu_entrega' },
      ]
        .map(
          (tab) => `
        <button class="tab ${filters.status === tab.value ? 'active' : ''}" data-tab="${tab.value}">
          ${tab.label}
        </button>
      `,
        )
        .join('')}
    </section>

    <section class="orders">
      ${filtered
        .map((order, index) => {
          const nextActions = getActions(order)
          return `
            <article class="card order-card fade-in" style="--i: ${index}">
              <div class="order-header">
                <div>
                  <span class="order-number">#${order.number}</span>
                  <span class="badge ${statusTone[order.status]}">${statusLabels[order.status]}</span>
                </div>
                <span class="order-time">${order.createdAt}</span>
              </div>
              <div class="order-body">
                <div>
                  <h3>${order.customerName}</h3>
                  <p>${order.type === 'mesa' ? `Mesa ${order.tableNumber}` : order.address}</p>
                  <ul>
                    ${order.items
                      .map(
                        (item) => `
                      <li>${item.qty}x ${item.name}</li>
                    `,
                      )
                      .join('')}
                  </ul>
                </div>
                <div class="order-total">
                  <span>Total</span>
                  <strong>${formatMoney(order.total)}</strong>
                  <span class="badge badge-muted">${order.type}</span>
                </div>
              </div>
              <div class="order-actions">
                ${nextActions
                  .map(
                    (action) => `
                  <button class="btn ${action.primary ? 'btn-primary' : 'btn-light'}" data-action="${action.action}" data-id="${order.id}">${action.label}</button>
                `,
                  )
                  .join('')}
              </div>
            </article>
          `
        })
        .join('')}
    </section>
  `

  bindOrdersEvents()
}

const renderPlaceholder = (path: string) => {
  const label = routes.find((route) => route.path === path)?.label || 'Em breve'
  setHeader(label, 'Tela em construcao')
  page.innerHTML = `
    <section class="card empty">
      <h2>${label}</h2>
      <p>Estamos preparando esta tela. Quer que eu avance aqui depois dos pedidos?</p>
    </section>
  `
}

const renderRoute = (path = window.location.pathname) => {
  const target = path === '/' ? '/pedidos' : path
  if (target !== window.location.pathname) {
    window.history.replaceState({}, '', target)
  }

  const navItems = document.querySelectorAll<HTMLButtonElement>('.nav-item')
  navItems.forEach((item) => {
    const isActive = item.dataset.route === target
    item.classList.toggle('active', isActive)
  })

  routeSelect.value = target

  if (target === '/pedidos') {
    renderOrdersPage()
    return
  }

  renderPlaceholder(target)
}

const bindNavEvents = () => {
  const navItems = document.querySelectorAll<HTMLButtonElement>('.nav-item')
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const route = item.dataset.route
      if (!route) return
      window.history.pushState({}, '', route)
      renderRoute(route)
    })
  })

  routeSelect.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value
    window.history.pushState({}, '', value)
    renderRoute(value)
  })

  window.addEventListener('popstate', () => renderRoute())
}

const bindOrdersEvents = () => {
  const searchInput = document.querySelector<HTMLInputElement>('#filterSearch')
  const statusSelect = document.querySelector<HTMLSelectElement>('#filterStatus')
  const typeSelect = document.querySelector<HTMLSelectElement>('#filterType')
  const resetButton = document.querySelector<HTMLButtonElement>('#filterReset')

  searchInput?.addEventListener('input', (event) => {
    filters.search = (event.target as HTMLInputElement).value
    renderOrdersPage()
  })

  statusSelect?.addEventListener('change', (event) => {
    filters.status = (event.target as HTMLSelectElement).value
    renderOrdersPage()
  })

  typeSelect?.addEventListener('change', (event) => {
    filters.type = (event.target as HTMLSelectElement).value
    renderOrdersPage()
  })

  resetButton?.addEventListener('click', () => {
    filters.search = ''
    filters.status = 'all'
    filters.type = 'all'
    renderOrdersPage()
  })

  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      filters.status = tab.dataset.tab || 'all'
      renderOrdersPage()
    })
  })

  document.querySelectorAll<HTMLButtonElement>('[data-action]')?.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const orderId = Number(btn.dataset.id)
      const action = btn.dataset.action
      if (!action) return
      await handleAction(orderId, action)
      renderOrdersPage()
    })
  })
}

const getActions = (order: Order) => {
  const actions: { label: string; action: string; primary?: boolean }[] = []

  if (order.status === 'novo') {
    actions.push({ label: 'Enviar cozinha', action: 'send-kitchen', primary: true })
  }

  if (order.status === 'enviado_cozinha') {
    actions.push({ label: 'Iniciar preparo', action: 'start-prep', primary: true })
  }

  if (order.status === 'em_preparo') {
    actions.push({ label: 'Marcar pronto', action: 'mark-ready', primary: true })
  }

  if (order.status === 'pronto') {
    if (order.type === 'delivery') {
      actions.push({ label: 'Saiu entrega', action: 'start-delivery', primary: true })
    } else {
      actions.push({ label: 'Finalizar pedido', action: 'complete', primary: true })
    }
  }

  if (order.status === 'saiu_entrega') {
    actions.push({ label: 'Confirmar entrega', action: 'complete', primary: true })
  }

  if (order.status !== 'entregue' && order.status !== 'cancelado') {
    actions.push({ label: 'Cancelar', action: 'cancel' })
  }

  return actions
}

const handleAction = async (orderId: number, action: string) => {
  const order = orders.find((item) => item.id === orderId)
  if (!order) return

  switch (action) {
    case 'send-kitchen':
      order.status = 'enviado_cozinha'
      await updateOrderStatus(orderId, 'enviado_cozinha')
      break
    case 'start-prep':
      order.status = 'em_preparo'
      await updateOrderStatus(orderId, 'em_preparo')
      break
    case 'mark-ready':
      order.status = 'pronto'
      await updateOrderStatus(orderId, 'pronto')
      break
    case 'start-delivery':
      order.status = 'saiu_entrega'
      await updateOrderStatus(orderId, 'saiu_entrega')
      break
    case 'complete':
      order.status = 'entregue'
      await updateOrderStatus(orderId, 'entregue')
      break
    case 'cancel':
      order.status = 'cancelado'
      await updateOrderStatus(orderId, 'cancelado')
      break
    default:
      break
  }
}

const bootstrap = async () => {
  if (apiEnabled) {
    await fetchOrdersFromApi()
  }

  renderRoute()
}

bindNavEvents()
bootstrap()
