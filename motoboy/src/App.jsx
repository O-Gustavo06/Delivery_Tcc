import React, { useCallback, useEffect, useState } from 'react'
import Pareamento from './pages/Pareamento.jsx'
import Scanner from './pages/Scanner.jsx'
import Rota from './pages/Rota.jsx'
import Historico from './pages/Historico.jsx'
import Clock from './components/Clock.jsx'
import { IconRota, IconScan, IconHistorico, IconLogout } from './components/icons.jsx'
import { api, ApiError, clearToken, getToken, setToken } from './api.js'

const NAV_ITEMS = [
  { view: 'rota', label: 'Rota', Icon: IconRota },
  { view: 'scanner', label: 'Bipar', Icon: IconScan },
  { view: 'historico', label: 'Historico', Icon: IconHistorico },
]

const getInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [userName, setUserName] = useState('')
  const [view, setView] = useState('rota')

  const [rota, setRota] = useState(null)
  const [rotaLoading, setRotaLoading] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanError, setScanError] = useState('')
  const [actingEntregaId, setActingEntregaId] = useState(null)
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useState(() => window.localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const refreshRota = useCallback(async () => {
    setRotaLoading(true)
    try {
      const data = await api.rotaAtiva()
      setRota(data)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setRota(null)
      } else if (err instanceof ApiError && err.status === 401) {
        setIsAuthenticated(false)
      }
    } finally {
      setRotaLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setCheckingSession(false)
      return
    }
    setIsAuthenticated(true)
    api.me().then((user) => setUserName(user?.name || '')).catch(() => null)
    refreshRota().finally(() => setCheckingSession(false))
  }, [refreshRota])

  const handlePair = useCallback(
    async (codigo) => {
      try {
        const payload = await api.parear(codigo)
        if (!payload?.token) {
          return { ok: false, message: 'Nao foi possivel parear.' }
        }

        setToken(payload.token)
        setUserName(payload.user?.name || '')
        setIsAuthenticated(true)
        await refreshRota()
        setView('rota')
        return { ok: true, message: '' }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Nao foi possivel conectar ao servidor.'
        return { ok: false, message }
      }
    },
    [refreshRota],
  )

  const handleLogout = useCallback(async () => {
    await api.logout()
    clearToken()
    setIsAuthenticated(false)
    setRota(null)
    setView('rota')
  }, [])

  const handleDetect = useCallback(
    async (codigoQr) => {
      setScanBusy(true)
      setScanError('')
      try {
        await api.scan(codigoQr)
        await refreshRota()
        setToast('Pedido atribuido com sucesso.')
        setView('rota')
      } catch (err) {
        setScanError(err instanceof ApiError ? err.message : 'Nao foi possivel bipar esse codigo.')
      } finally {
        setScanBusy(false)
      }
    },
    [refreshRota],
  )

  const handleIniciar = useCallback(
    async (entregaId) => {
      setActingEntregaId(entregaId)
      try {
        await api.iniciar(entregaId)
        await refreshRota()
      } catch {
        setToast('Nao foi possivel iniciar essa entrega.')
      } finally {
        setActingEntregaId(null)
      }
    },
    [refreshRota],
  )

  const handleConcluir = useCallback(
    async (entregaId, codigo) => {
      setActingEntregaId(entregaId)
      try {
        await api.concluir(entregaId, codigo)
        await refreshRota()
        setToast('Entrega concluida!')
      } catch (err) {
        setToast(err instanceof ApiError ? err.message : 'Nao foi possivel concluir essa entrega.')
      } finally {
        setActingEntregaId(null)
      }
    },
    [refreshRota],
  )

  const handleReordenar = useCallback(
    async (rotaId, ordem) => {
      try {
        await api.reordenar(rotaId, ordem)
        await refreshRota()
      } catch {
        setToast('Nao foi possivel reordenar a rota.')
      }
    },
    [refreshRota],
  )

  const fetchHistorico = useCallback((periodo) => api.historico(periodo).catch(() => ({
    periodo,
    total_entregas: 0,
    total_taxas: 0,
    entregas: [],
  })), [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  if (checkingSession) {
    return <div className="empty">Carregando...</div>
  }

  if (!isAuthenticated) {
    return <Pareamento onPair={handlePair} />
  }

  const saudacao = userName ? `Ola, ${userName.split(' ')[0]}` : ''
  const titles = {
    rota: ['Rota ativa', rota ? `${rota.status === 'EM_ANDAMENTO' ? 'Em andamento' : rota.status}` : saudacao || 'Nenhuma parada agora'],
    scanner: ['Bipar comanda', 'Aponte pro QR ou digite o codigo'],
    historico: ['Historico', 'Suas entregas concluidas'],
  }
  const [title, subtitle] = titles[view] || titles.rota

  return (
    <div className="mobile-shell">
      <Clock />
      <header className="mobile-header">
        <div className="mobile-header-user">
          <span className="mobile-avatar">{getInitials(userName)}</span>
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="mobile-logout"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="mobile-logout" type="button" onClick={handleLogout} aria-label="Sair" title="Sair">
            <IconLogout />
          </button>
        </div>
      </header>

      {toast && (
        <div className="notice notice-success" role="status">
          {toast}
        </div>
      )}

      {view === 'rota' && (
        <Rota
          rota={rota}
          loading={rotaLoading}
          actingEntregaId={actingEntregaId}
          onIniciar={handleIniciar}
          onConcluir={handleConcluir}
          onReordenar={handleReordenar}
        />
      )}

      {view === 'scanner' && <Scanner onDetect={handleDetect} busy={scanBusy} error={scanError} />}

      {view === 'historico' && <Historico fetchHistorico={fetchHistorico} />}

      <nav className="bottom-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            className={`bottom-nav-item ${view === item.view ? 'active' : ''}`}
            onClick={() => setView(item.view)}
          >
            <span className="bottom-nav-icon">
              <item.Icon />
            </span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
