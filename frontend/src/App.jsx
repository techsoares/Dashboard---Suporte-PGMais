import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import KpiBar from './components/KpiBar'
import DevGrid from './components/DevGrid'
import BacklogPanel from './components/BacklogPanel'
import AIInsightsView from './components/AIInsightsView'
import ProductView from './components/ProductView'
import KanbanView from './components/KanbanView'
import StaleBanner from './components/StaleBanner'
import NightSummary from './components/NightSummary'
import ProductStrip from './components/ProductStrip'
import FilterDropdown from './components/FilterDropdown'
import ManagementView from './components/ManagementView'
import AdminView from './components/AdminView'
import PrioritizationView from './components/PrioritizationView'
import './App.css'

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:8000'
  const host = window.location.host.replace(':5173', ':8000').replace('-5173.', '-8000.')
  return `${window.location.protocol}//${host}`
}

const API = getApiUrl()
const REFRESH_SECRET = import.meta.env.VITE_REFRESH_SECRET ?? ''
const REFRESH_INTERVAL = 5 * 60 * 1000

// Ordem de prioridade Jira
const PRIO_ORDER = { Highest: 0, Blocker: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 }
const issuePrio = i => PRIO_ORDER[i.priority?.name] ?? 2

const sortIssues = (issues) =>
  [...issues].sort((a, b) => {
    // Overdue primeiro dentro da mesma prioridade
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1
    return issuePrio(a) - issuePrio(b)
  })

const EMPTY_FILTERS = { bu: [], assignee: [], account: [], product: [], issue_type: [], status: [] }

export default function App() {
  const [data, setData]             = useState(null)
  const [error, setError]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFetch, setLastFetch]   = useState(null)
  const [currentView, setCurrentView] = useState('dashboard')
  const [bus, setBus]               = useState([])
  const [filters, setFilters]       = useState(EMPTY_FILTERS)
  const [searchQuery, setSearchQuery] = useState('')
  const [nightMode, setNightMode]       = useState(false)
  const [lightMode, setLightMode]       = useState(false)
  const [notifications, setNotifications] = useState([])
  const [backlogOpen, setBacklogOpen]     = useState(false)
  const prevKeysRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', lightMode ? 'light' : 'dark')
  }, [lightMode])

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/dashboard`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()

      // Detecta issues novas e dispara notificações (ignora o primeiro carregamento)
      const currentKeys = new Set(json.backlog.map(i => i.key))
      if (prevKeysRef.current !== null) {
        const newIssues = json.backlog.filter(i => !prevKeysRef.current.has(i.key))
        if (newIssues.length > 0) {
          const toasts = newIssues.slice(0, 5).map(i => ({
            id:       i.key + '_' + Date.now(),
            key:      i.key,
            summary:  i.summary,
            assignee: i.assignee?.display_name,
            priority: i.priority?.name,
          }))
          setNotifications(prev => [...prev, ...toasts])
          toasts.forEach(t => {
            setTimeout(() => setNotifications(prev => prev.filter(x => x.id !== t.id)), 5000)
          })
        }
      }
      prevKeysRef.current = currentKeys

      setData(json)
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

  // Load BUs on startup
  useEffect(() => {
    fetch(`${API}/api/admin/bus`)
      .then(r => r.json())
      .then(r => setBus(Array.isArray(r) ? r : []))
      .catch(() => {})
  }, [])

  // Opções de filtro derivadas dos dados
  const filterOptions = useMemo(() => {
    if (!data) return { accounts: [], products: [], assignees: [], issueTypes: [], statuses: [] }
    const allIssues = [...data.backlog, ...data.devs.flatMap(d => d.active_issues)]
    return {
      accounts:   [...new Set(allIssues.map(i => i.account).filter(Boolean))].sort(),
      products:   [...new Set(allIssues.map(i => i.product).filter(Boolean))].sort(),
      assignees:  [...new Set(data.devs.map(d => d.assignee?.display_name).filter(Boolean))].sort(),
      issueTypes: [...new Set(allIssues.map(i => i.issue_type?.name).filter(Boolean))].sort(),
      statuses:   [...new Set(allIssues.map(i => i.status?.name).filter(Boolean))].sort(),
    }
  }, [data])

  // Filtragem client-side com multi-select + busca + ordenação por prioridade
  const filteredData = useMemo(() => {
    if (!data) return data
    let devs = data.devs
    let backlog = data.backlog
    let doneIssues = data.done_issues || []

    // Expande filtro de BU para lista de assignees
    const buAssignees = filters.bu.length > 0
      ? bus.filter(b => filters.bu.includes(b.name)).flatMap(b => b.members)
      : []

    const filterIssue = (issues) => {
      let result = issues
      if (buAssignees.length) result = result.filter(i => buAssignees.includes(i.assignee?.display_name))
      else if (filters.assignee.length) result = result.filter(i => filters.assignee.includes(i.assignee?.display_name))
      if (filters.account.length)  result = result.filter(i => filters.account.includes(i.account))
      if (filters.product.length)  result = result.filter(i => filters.product.includes(i.product))
      if (filters.issue_type.length) result = result.filter(i => filters.issue_type.includes(i.issue_type?.name))
      if (filters.status.length)   result = result.filter(i => filters.status.includes(i.status?.name))
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        result = result.filter(i =>
          i.key?.toLowerCase().includes(q) ||
          i.summary?.toLowerCase().includes(q) ||
          i.assignee?.display_name?.toLowerCase().includes(q)
        )
      }
      return result
    }

    if (buAssignees.length) {
      devs = devs.filter(d => buAssignees.includes(d.assignee?.display_name))
    } else if (filters.assignee.length) {
      devs = devs.filter(d => filters.assignee.includes(d.assignee?.display_name))
    }
    if (filters.account.length) {
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(i => filters.account.includes(i.account)) }))
                 .filter(d => d.active_issues.length > 0)
    }
    if (filters.product.length) {
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(i => filters.product.includes(i.product)) }))
                 .filter(d => d.active_issues.length > 0)
    }
    if (filters.issue_type.length) {
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(i => filters.issue_type.includes(i.issue_type?.name)) }))
                 .filter(d => d.active_issues.length > 0)
    }
    if (filters.status.length) {
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(i => filters.status.includes(i.status?.name)) }))
                 .filter(d => d.active_issues.length > 0)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const match = i =>
        i.key?.toLowerCase().includes(q) ||
        i.summary?.toLowerCase().includes(q) ||
        i.assignee?.display_name?.toLowerCase().includes(q)
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(match) }))
                 .filter(d => d.active_issues.length > 0)
    }

    backlog = filterIssue(backlog)
    doneIssues = filterIssue(doneIssues)

    // Ordenar por prioridade (overdue primeiro, depois Highest → Lowest)
    devs = devs.map(d => ({ ...d, active_issues: sortIssues(d.active_issues) }))
    backlog = sortIssues(backlog)

    return { ...data, devs, backlog, done_issues: doneIssues }
  }, [data, filters, searchQuery, bus])

  const toggleFilter = (key, value) => {
    setFilters(prev => {
      const cur = prev[key] || []
      return { ...prev, [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] }
    })
  }
  const clearFilter = (key) => setFilters(prev => ({ ...prev, [key]: [] }))
  const hasAnyFilter = Object.values(filters).some(v => v.length > 0) || searchQuery

  // KPIs calculados a partir dos dados filtrados client-side (deve vir após hasAnyFilter)
  const filteredKpis = useMemo(() => {
    if (!filteredData || !hasAnyFilter) return data?.kpis
    const issues = filteredData.backlog
    return {
      total_sprint:   issues.length,
      in_progress:    issues.filter(i =>
        i.status?.category === 'indeterminate' &&
        !i.status?.name?.toLowerCase().includes('aguard')
      ).length,
      waiting:        issues.filter(i =>
        i.status?.name?.toLowerCase().includes('aguard')
      ).length,
      done_this_week: (filteredData.done_issues || []).length,
      overdue:        issues.filter(i => i.is_overdue).length,
    }
  }, [filteredData, hasAnyFilter, data])

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
    <div className="app" data-theme={lightMode ? 'light' : 'dark'}>

      {/* ── Notificações de novos Jiras ─────────────────────────── */}
      {notifications.length > 0 && (
        <div className="notif-stack">
          {notifications.map(n => (
            <div key={n.id} className="notif-card">
              <div className="notif-top">
                <span className="notif-label">Novo Jira</span>
                <span className="notif-key">{n.key}</span>
              </div>
              <p className="notif-summary">{n.summary}</p>
              {n.assignee && <span className="notif-assignee">→ {n.assignee}</span>}
            </div>
          ))}
        </div>
      )}

      <header className="app-header">
        <p className="tagline">tech, but <em>people first.</em></p>
        <div className="header-right">
          <button className={`view-btn ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>Dashboard</button>
          <button className={`view-btn ${currentView === 'management' ? 'active' : ''}`} onClick={() => setCurrentView('management')}>Gestão</button>
          <button className={`view-btn ${currentView === 'ai' ? 'active' : ''}`} onClick={() => setCurrentView('ai')}>IA Insights</button>
          <button className={`view-btn ${currentView === 'product' ? 'active' : ''}`} onClick={() => setCurrentView('product')}>Visão Produto</button>
          <button className={`view-btn ${currentView === 'kanban' ? 'active' : ''}`} onClick={() => setCurrentView('kanban')}>Kanban</button>
          <button className={`view-btn ${currentView === 'admin' ? 'active' : ''}`} onClick={() => setCurrentView('admin')}>Admin</button>
          <button className={`view-btn ${currentView === 'prioritization' ? 'active' : ''}`} onClick={() => setCurrentView('prioritization')}>Priorização</button>
          {lastFetch && (
            <span className="last-updated">
              atualizado às {lastFetch.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="theme-toggle-btn" onClick={() => setLightMode(p => !p)} title={lightMode ? 'Modo escuro' : 'Modo claro'}>
            {lightMode ? '🌙' : '☀️'}
          </button>
          <button className="night-btn" onClick={() => setNightMode(true)} title="Modo resumo">🌙</button>
          <button className={`refresh-btn ${refreshing ? 'loading' : ''}`} onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'atualizando...' : '↻ atualizar'}
          </button>
        </div>
      </header>

      {currentView === 'dashboard' && filteredData && (
        <>
          {/* KPIs + Produtos compactos */}
          <div className="kpi-product-row">
            <KpiBar kpis={filteredKpis} delta={hasAnyFilter ? null : data.kpi_delta} />
            <div className="kpi-product-divider" />
            <ProductStrip issues={filteredData.backlog} />
          </div>

          {/* Barra de filtros multi-select */}
          <div className="filter-bar">
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar issue, chave ou pessoa..."
              />
              {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>}
            </div>

            {bus.length > 0 && (
              <FilterDropdown
                label="BU"
                options={bus.map(b => b.name)}
                selected={filters.bu}
                onToggle={v => toggleFilter('bu', v)}
                onClear={() => clearFilter('bu')}
              />
            )}
            <FilterDropdown
              label="Responsável"
              options={filterOptions.assignees}
              selected={filters.assignee}
              onToggle={v => toggleFilter('assignee', v)}
              onClear={() => clearFilter('assignee')}
            />
            <FilterDropdown
              label="Account"
              options={filterOptions.accounts}
              selected={filters.account}
              onToggle={v => toggleFilter('account', v)}
              onClear={() => clearFilter('account')}
            />
            <FilterDropdown
              label="Produto"
              options={filterOptions.products}
              selected={filters.product}
              onToggle={v => toggleFilter('product', v)}
              onClear={() => clearFilter('product')}
            />
            <FilterDropdown
              label="Tipo"
              options={filterOptions.issueTypes}
              selected={filters.issue_type}
              onToggle={v => toggleFilter('issue_type', v)}
              onClear={() => clearFilter('issue_type')}
            />
            <FilterDropdown
              label="Status"
              options={filterOptions.statuses}
              selected={filters.status}
              onToggle={v => toggleFilter('status', v)}
              onClear={() => clearFilter('status')}
            />

            {hasAnyFilter && (
              <button className="clear-filters-btn" onClick={() => { setFilters(EMPTY_FILTERS); setSearchQuery('') }}>
                ✕ limpar tudo
              </button>
            )}

            {data.stale_issues?.length > 0 && (
              <StaleBanner issues={data.stale_issues} jiraBaseUrl={data.jira_base_url} />
            )}
          </div>

          <main className="app-body app-body--full">
            <DevGrid devs={filteredData.devs} jiraBaseUrl={filteredData.jira_base_url} bus={bus} />
          </main>

          {/* Backlog drawer */}
          <button className="backlog-toggle-btn" onClick={() => setBacklogOpen(v => !v)}>
            {backlogOpen ? '✕' : `Backlog (${filteredData.backlog.length})`}
          </button>
          <div className={`backlog-drawer ${backlogOpen ? 'backlog-drawer--open' : ''}`}>
            <BacklogPanel issues={filteredData.backlog} jiraBaseUrl={filteredData.jira_base_url} />
          </div>
          {backlogOpen && <div className="backlog-overlay" onClick={() => setBacklogOpen(false)} />}
        </>
      )}

      {currentView === 'management' && data && <ManagementView data={filteredData} filters={filters} />}
      {currentView === 'ai' && data && <AIInsightsView data={data} />}
      {currentView === 'product' && filteredData && <ProductView data={filteredData} />}
      {currentView === 'kanban' && data && <KanbanView data={data} />}
      {currentView === 'admin' && <AdminView assignees={filterOptions.assignees} onBusChange={setBus} />}
      {currentView === 'prioritization' && data && <PrioritizationView data={data} bus={bus} />}

      <footer className="app-footer">
        Desenvolvido por <span className="app-footer-name">Andressa Soares</span>
      </footer>
    </div>
  )
}
