import { useState, useEffect, useCallback, useMemo } from 'react'
import KpiBar from './components/KpiBar'
import DevGrid from './components/DevGrid'
import BacklogPanel from './components/BacklogPanel'
import AIInsightsView from './components/AIInsightsView'
import ProductView from './components/ProductView'
import KanbanView from './components/KanbanView'
import StaleBanner from './components/StaleBanner'
import NightSummary from './components/NightSummary'
import './App.css'

// Detectar URL da API dinamicamente
const getApiUrl = () => {
  // Se tiver variável de ambiente, usar primeiramente
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  // Se estiver em dev local, usar localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000'
  }

  // Se estiver em tunnel/produção, substituir porta 5173 por 8000
  const host = window.location.host.replace(':5173', ':8000').replace('-5173.', '-8000.')
  return `${window.location.protocol}//${host}`
}

const API = getApiUrl()
const REFRESH_SECRET = import.meta.env.VITE_REFRESH_SECRET ?? ''
const REFRESH_INTERVAL = 5 * 60 * 1000

function isBusinessHours() {
  const now = new Date()
  const day  = now.getDay()   // 0=Dom, 6=Sáb
  const hour = now.getHours()
  return day >= 1 && day <= 5 && hour >= 8 && hour < 19
}

export default function App() {
  const [data, setData]           = useState(null)
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)
  const [currentView, setCurrentView] = useState('dashboard')
  const [filters, setFilters] = useState({})
  const [nightMode, setNightMode] = useState(!isBusinessHours())

  // Detecta automaticamente entrada/saída do horário comercial
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isBusinessHours()) setNightMode(true)
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/dashboard`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setLastFetch(new Date())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetch(`${API}/api/refresh`, {
        method: 'POST',
        headers: REFRESH_SECRET ? { 'X-Refresh-Secret': REFRESH_SECRET } : {},
      })
      await fetchDashboard()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  // Opções de filtro derivadas dos dados carregados
  const filterOptions = useMemo(() => {
    if (!data) return { accounts: [], products: [], assignees: [], issueTypes: [] }
    const allIssues = [...data.backlog, ...data.devs.flatMap(d => d.active_issues)]
    return {
      accounts:   [...new Set(allIssues.map(i => i.account).filter(Boolean))].sort(),
      products:   [...new Set(allIssues.map(i => i.product).filter(Boolean))].sort(),
      assignees:  [...new Set(data.devs.map(d => d.assignee?.display_name).filter(Boolean))].sort(),
      issueTypes: [...new Set(allIssues.map(i => i.issue_type?.name).filter(Boolean))].sort(),
    }
  }, [data])

  // Filtragem client-side — não faz re-fetch
  const filteredData = useMemo(() => {
    if (!data || !Object.keys(filters).length) return data
    let devs = data.devs
    let backlog = data.backlog

    if (filters.account) {
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(i => i.account === filters.account) }))
                 .filter(d => d.active_issues.length > 0)
      backlog = backlog.filter(i => i.account === filters.account)
    }
    if (filters.product) {
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(i => i.product === filters.product) }))
                 .filter(d => d.active_issues.length > 0)
      backlog = backlog.filter(i => i.product === filters.product)
    }
    if (filters.assignee) {
      devs = devs.filter(d => d.assignee?.display_name === filters.assignee)
      backlog = backlog.filter(i => i.assignee?.display_name === filters.assignee)
    }
    if (filters.issue_type) {
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(i => i.issue_type?.name === filters.issue_type) }))
                 .filter(d => d.active_issues.length > 0)
      backlog = backlog.filter(i => i.issue_type?.name === filters.issue_type)
    }
    return { ...data, devs, backlog }
  }, [data, filters])

  const setFilter = (key, value) => {
    setFilters(prev => value ? { ...prev, [key]: value } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)))
  }

  const handleViewChange = (view) => {
    setCurrentView(view)
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Carregando dados...</p>
        <span className="loading-tagline">tech, but people first.</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="error-screen">
        <h2>Não foi possível conectar</h2>
        <p>{error}</p>
        <button onClick={fetchDashboard}>Tentar novamente</button>
      </div>
    )
  }

  // Modo resumo (noturno)
  if (nightMode && data) {
    return (
      <NightSummary
        data={data}
        lastFetch={lastFetch}
        onExit={() => setNightMode(false)}
      />
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <p className="tagline">tech, but <em>people first.</em></p>
        <div className="header-right">
          <button
            className={`view-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleViewChange('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`view-btn ${currentView === 'ai' ? 'active' : ''}`}
            onClick={() => handleViewChange('ai')}
          >
            IA Insights
          </button>
          <button
            className={`view-btn ${currentView === 'product' ? 'active' : ''}`}
            onClick={() => handleViewChange('product')}
          >
            Visão Produto
          </button>
          <button
            className={`view-btn ${currentView === 'kanban' ? 'active' : ''}`}
            onClick={() => handleViewChange('kanban')}
          >
            Kanban
          </button>
          {lastFetch && (
            <span className="last-updated">
              atualizado às {lastFetch.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className="night-btn"
            onClick={() => setNightMode(true)}
            title="Modo resumo"
          >
            🌙
          </button>
          <button
            className={`refresh-btn ${refreshing ? 'loading' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'atualizando...' : '↻ atualizar'}
          </button>
        </div>
      </header>

      {currentView === 'dashboard' && filteredData && (
        <>
          <KpiBar kpis={data.kpis} delta={data.kpi_delta} />

          {/* Barra de filtros inline */}
          <div className="filter-bar">
            <select value={filters.assignee || ''} onChange={e => setFilter('assignee', e.target.value)}>
              <option value="">Responsável</option>
              {filterOptions.assignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filters.account || ''} onChange={e => setFilter('account', e.target.value)}>
              <option value="">Account</option>
              {filterOptions.accounts.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filters.product || ''} onChange={e => setFilter('product', e.target.value)}>
              <option value="">Produto</option>
              {filterOptions.products.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filters.issue_type || ''} onChange={e => setFilter('issue_type', e.target.value)}>
              <option value="">Tipo</option>
              {filterOptions.issueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {Object.keys(filters).length > 0 && (
              <button className="clear-filters-btn" onClick={() => setFilters({})}>✕ limpar</button>
            )}
          </div>

          {data.stale_issues?.length > 0 && (
            <StaleBanner issues={data.stale_issues} jiraBaseUrl={data.jira_base_url} />
          )}

          <main className="app-body">
            <DevGrid devs={filteredData.devs} jiraBaseUrl={filteredData.jira_base_url} />
            <BacklogPanel issues={filteredData.backlog} jiraBaseUrl={filteredData.jira_base_url} />
          </main>
        </>
      )}

      {currentView === 'ai' && data && (
        <AIInsightsView data={data} />
      )}

      {currentView === 'product' && data && (
        <ProductView data={data} />
      )}

      {currentView === 'kanban' && data && (
        <KanbanView data={data} />
      )}
    </div>
  )
}
