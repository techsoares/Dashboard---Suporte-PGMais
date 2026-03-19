import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import LoginView from './components/LoginView'
import SSOCallback from './components/SSOCallback'
import KpiBar from './components/KpiBar'
import DevGrid from './components/DevGrid'
import BacklogPanel from './components/BacklogPanel'
import AIInsightsView from './components/AIInsightsView'
import ProductView from './components/ProductView'
import KanbanView from './components/KanbanView'
import StaleBanner from './components/StaleBanner'
import ProductStrip from './components/ProductStrip'
import FilterDropdown from './components/FilterDropdown'
import ManagementView from './components/ManagementView'
import AdminView from './components/AdminView'
import PrioritizationView from './components/PrioritizationView'
import DashboardHome from './components/DashboardHome'
import PrioritizationWizard from './components/PrioritizationWizard'
import TimelineView from './components/TimelineView'
import AIAssistantCollapsible from './components/AIAssistantCollapsible'
import { API_BASE_URL } from './apiUrl'
import { identify, track } from './analytics'
import { PRIO_ORDER, issuePrio, isWaiting, isInProgress } from './utils/constants'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

const REFRESH_SECRET = import.meta.env.VITE_REFRESH_SECRET ?? ''
const REFRESH_INTERVAL = 5 * 60 * 1000

const sortIssues = (issues) =>
  [...issues].sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1
    return issuePrio(a) - issuePrio(b)
  })

const EMPTY_FILTERS = { bu: [], assignee: [], account: [], product: [], issue_type: [], status: [] }

export default function App() {
  const [user, setUser] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)
  const [currentView, setCurrentView] = useState('prioritization')
  const [bus, setBus] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [searchQuery, setSearchQuery] = useState('')
  const [lightMode, setLightMode] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [backlogOpen, setBacklogOpen] = useState(false)
  const [showPrioritizationWizard, setShowPrioritizationWizard] = useState(false)
  const [dashboardSubView, setDashboardSubView] = useState('grid') // grid | home
  const prevKeysRef = useRef(null)

  // Verificar se está na página de callback
  const isCallback = window.location.pathname === '/callback'

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', lightMode ? 'light' : 'dark')
  }, [lightMode])

  // Carregar usuário do localStorage
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const storedUser = localStorage.getItem('user')
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser))
        setLoading(false)
      } catch (e) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector('.search-input')?.focus()
      }
      if (e.key === 'Escape' && backlogOpen) {
        setBacklogOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [backlogOpen])

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token')
    return token ? { 'Authorization': `Bearer ${token}` } : {}
  }

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard`, {
        headers: getAuthHeaders()
      })
      if (res.status === 401) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        setUser(null)
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()

      const currentKeys = new Set(json.backlog.map(i => i.key))
      if (prevKeysRef.current !== null) {
        const newIssues = json.backlog.filter(i => !prevKeysRef.current.has(i.key))
        if (newIssues.length > 0) {
          const MAX_NOTIFICATIONS = 10
          const toasts = newIssues.slice(0, 5).map(i => ({
            id: i.key + '_' + Date.now(),
            key: i.key,
            summary: i.summary,
            assignee: i.assignee?.display_name,
            priority: i.priority?.name,
          }))
          setNotifications(prev => {
            const newNotifications = [...prev, ...toasts]
            // Mantém apenas as últimas MAX_NOTIFICATIONS
            return newNotifications.slice(-MAX_NOTIFICATIONS)
          })
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
      await fetch(`${API_BASE_URL}/api/refresh`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          ...(REFRESH_SECRET ? { 'X-Refresh-Secret': REFRESH_SECRET } : {})
        },
      })
      await fetchDashboard()
    } finally {
      setRefreshing(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    setUser(null)
    setData(null)
  }

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser)
    identify(loggedInUser.email)
    track('login', { email: loggedInUser.email, bu: loggedInUser.bu_name })
    setCurrentView('dashboard')
    setLoading(true)
    fetchDashboard()
  }

  useEffect(() => {
    if (user && !isCallback) {
      fetchDashboard()
      const interval = setInterval(fetchDashboard, REFRESH_INTERVAL)
      return () => clearInterval(interval)
    }
  }, [user, fetchDashboard, isCallback])

  // Load BUs on startup
  useEffect(() => {
    if (user) {
      fetch(`${API_BASE_URL}/api/admin/bus`, {
        headers: getAuthHeaders()
      })
        .then(r => r.json())
        .then(r => setBus(Array.isArray(r) ? r : []))
        .catch(() => {})
    }
  }, [user])

  // Opções de filtro derivadas dos dados
  const filterOptions = useMemo(() => {
    if (!data) return { accounts: [], products: [], assignees: [], issueTypes: [], statuses: [] }
    const allIssues = [...data.backlog, ...data.devs.flatMap(d => d.active_issues)]
    return {
      accounts: [...new Set(allIssues.map(i => i.account).filter(Boolean))].sort(),
      products: [...new Set(allIssues.map(i => i.product).filter(Boolean))].sort(),
      assignees: [...new Set(data.devs.map(d => d.assignee?.display_name).filter(Boolean))].sort(),
      issueTypes: [...new Set(allIssues.map(i => i.issue_type?.name).filter(Boolean))].sort(),
      statuses: [...new Set(allIssues.map(i => i.status?.name).filter(Boolean))].sort(),
    }
  }, [data])

  // Filtragem client-side
  const filteredData = useMemo(() => {
    if (!data) return null

    // Otimização: pré-computar filtros aplicáveis
    const hasBuFilter = filters.bu.length > 0
    const hasAssigneeFilter = filters.assignee.length > 0
    const hasAccountFilter = filters.account.length > 0
    const hasProductFilter = filters.product.length > 0
    const hasIssueTypeFilter = filters.issue_type.length > 0
    const hasStatusFilter = filters.status.length > 0
    const hasSearch = searchQuery.trim().length > 0

    if (!hasBuFilter && !hasAssigneeFilter && !hasAccountFilter && !hasProductFilter && !hasIssueTypeFilter && !hasStatusFilter && !hasSearch) {
      return data // Sem filtros, retorna direto
    }

    let devs = data.devs
    let backlog = data.backlog
    let doneIssues = data.done_issues || []

    const buAssignees = hasBuFilter
      ? bus.filter(b => filters.bu.includes(b.name)).flatMap(b => b.members)
      : []

    const filterIssue = (issues) => {
      let result = issues
      if (buAssignees.length) result = result.filter(i => buAssignees.includes(i.assignee?.display_name))
      else if (hasAssigneeFilter) result = result.filter(i => filters.assignee.includes(i.assignee?.display_name))
      if (hasAccountFilter) result = result.filter(i => filters.account.includes(i.account))
      if (hasProductFilter) result = result.filter(i => filters.product.includes(i.product))
      if (hasIssueTypeFilter) result = result.filter(i => filters.issue_type.includes(i.issue_type?.name))
      if (hasStatusFilter) result = result.filter(i => filters.status.includes(i.status?.name))
      if (hasSearch) {
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
    } else if (hasAssigneeFilter) {
      devs = devs.filter(d => filters.assignee.includes(d.assignee?.display_name))
    }
    if (hasAccountFilter) {
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(i => filters.account.includes(i.account)) }))
        .filter(d => d.active_issues.length > 0)
    }
    if (hasProductFilter) {
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(i => filters.product.includes(i.product)) }))
        .filter(d => d.active_issues.length > 0)
    }
    if (hasIssueTypeFilter) {
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(i => filters.issue_type.includes(i.issue_type?.name)) }))
        .filter(d => d.active_issues.length > 0)
    }
    if (hasStatusFilter) {
      devs = devs.map(d => ({ ...d, active_issues: d.active_issues.filter(i => filters.status.includes(i.status?.name)) }))
        .filter(d => d.active_issues.length > 0)
    }
    if (hasSearch) {
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

    devs = devs.map(d => ({ ...d, active_issues: sortIssues(d.active_issues) }))
    backlog = sortIssues(backlog)

    return { ...data, devs, backlog, done_issues: doneIssues }
  }, [data, filters, searchQuery, bus])

  const hasAnyFilter = Object.values(filters).some(v => v.length > 0) || searchQuery

  const filteredKpis = useMemo(() => {
    if (!filteredData || !hasAnyFilter) return data?.kpis
    const issues = filteredData.backlog
    return {
      total_sprint: issues.length,
      in_progress: issues.filter(i => isInProgress(i)).length,
      waiting: issues.filter(i => isWaiting(i)).length,
      done_this_week: (filteredData.done_issues || []).length,
      overdue: issues.filter(i => i.is_overdue).length,
    }
  }, [filteredData, hasAnyFilter, data])

  // Se está na página de callback, mostrar componente de callback
  if (isCallback) {
    return <SSOCallback />
  }

  // Se não está autenticado, mostrar tela de login
  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />
  }

  const toggleFilter = (key, value) => {
    setFilters(prev => {
      const cur = prev[key] || []
      return { ...prev, [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] }
    })
  }
  const clearFilter = (key) => setFilters(prev => ({ ...prev, [key]: [] }))

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

  return (
    <div className="app" data-theme={lightMode ? 'light' : 'dark'}>

      {notifications.length > 0 && (
        <div className="notif-stack" role="region" aria-live="polite" aria-label="Notificações de novos Jiras">
          {notifications.map(n => (
            <div key={n.id} className="notif-card" role="alert">
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
        <nav className="header-nav">
          <button className={`nav-pill ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => { setCurrentView('dashboard'); setDashboardSubView('grid') }} aria-label="Ir para Dashboard" title="Visão principal com grid de desenvolvedores e KPIs">Dashboard</button>
          
          <div className="nav-pill-group">
            <button className={`nav-pill ${['management', 'ai', 'product'].includes(currentView) ? 'active' : ''}`} aria-label="Abrir menu de análise" aria-expanded={['management', 'ai', 'product'].includes(currentView)}>Análise</button>
            <div className="nav-pill-submenu">
              <button className={`nav-pill-item ${currentView === 'management' ? 'active' : ''}`} onClick={() => setCurrentView('management')} title="Visão executiva: entregas, SLA, capacity e gargalos">Gestão</button>
              <button className={`nav-pill-item ${currentView === 'product' ? 'active' : ''}`} onClick={() => { setCurrentView('product'); track('view_product') }} title="Central de operações: volume, lead time e saúde por produto">Produto</button>
              <button className={`nav-pill-item ${currentView === 'timeline' ? 'active' : ''}`} onClick={() => setCurrentView('timeline')} title="Visualização temporal Gantt das demandas ativas">Timeline</button>
            </div>
          </div>
          
          <div className="nav-pill-group">
            <button className={`nav-pill ${['kanban', 'prioritization'].includes(currentView) ? 'active' : ''}`} aria-label="Abrir menu de visualização" aria-expanded={['kanban', 'prioritization'].includes(currentView)}>Visualização</button>
            <div className="nav-pill-submenu">
              <button className={`nav-pill-item ${currentView === 'kanban' ? 'active' : ''}`} onClick={() => setCurrentView('kanban')} title="Board Kanban com issues agrupadas por status">Kanban</button>
              <button className={`nav-pill-item ${currentView === 'prioritization' ? 'active' : ''}`} onClick={() => setCurrentView('prioritization')} title="Fila priorizada por faturamento, tipo, produção e idade">Priorização</button>
            </div>
          </div>
        </nav>
        <div className="header-right">
          {user && (
            <div className="user-info">
              <span className="user-name" title={`Usuário: ${user.name} (${user.email})`}>{user.name}</span>
              <div className="user-bu-row">
                {user.bu_name && <span className="user-bu" title={`Unidade de Negócio: ${user.bu_name}`}>{user.bu_name}</span>}
                {user.bu_type === 'gestao' && <span className="user-bu-badge" title="Perfil de gestão — acesso a visões gerenciais e multiplicador de priorização">gestão</span>}
              </div>
            </div>
          )}
          {lastFetch && (
            <span className="last-updated" aria-live="polite" aria-label={`Dados atualizados às ${lastFetch.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}>
              atualizado às {lastFetch.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {currentView === 'dashboard' && (
            <button
              className="nav-pill"
              onClick={() => setDashboardSubView(dashboardSubView === 'home' ? 'grid' : 'home')}
              title={dashboardSubView === 'home' ? 'Voltar para grid' : 'Ver dashboard contextual'}
            >
              {dashboardSubView === 'home' ? 'Grid' : 'Home'}
            </button>
          )}
          <button
            className="nav-pill"
            onClick={() => setShowPrioritizationWizard(true)}
            title="Solicitar priorização de jira"
          >
            ⚡ Priorizar
          </button>
          <button className="theme-toggle-btn" onClick={() => setLightMode(p => !p)} aria-label={lightMode ? 'Ativar modo escuro' : 'Ativar modo claro'} title={lightMode ? 'Modo escuro' : 'Modo claro'}>
            {lightMode ? '🌙' : '☀️'}
          </button>
          <button className={`refresh-btn ${refreshing ? 'loading' : ''}`} onClick={handleRefresh} disabled={refreshing} aria-label={refreshing ? 'Atualizando dados' : 'Atualizar dados agora'} title="Forçar atualização dos dados do Jira">
            {refreshing ? 'atualizando...' : '↻ atualizar'}
          </button>
          {user?.permissions?.includes('admin') && (
            <>
              <button className="admin-toggle-btn" onClick={() => setCurrentView(currentView === 'admin' ? 'dashboard' : 'admin')} aria-label="Abrir painel admin" title="Admin">⚙️</button>
            </>
          )}
          <button className="logout-btn" onClick={handleLogout} aria-label="Fazer logout" title="Sair">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="18" height="18" fill="currentColor">
              <path d="M255.15 468.625H63.787c-11.737 0-21.262-9.526-21.262-21.262V64.638c0-11.737 9.526-21.262 21.262-21.262H255.15c11.758 0 21.262-9.504 21.262-21.262S266.908.85 255.15.85H63.787C28.619.85 0 29.47 0 64.638v382.724c0 35.168 28.619 63.787 63.787 63.787H255.15c11.758 0 21.262-9.504 21.262-21.262 0-11.758-9.504-21.262-21.262-21.262z"/>
              <path d="M505.664 240.861L376.388 113.286c-8.335-8.25-21.815-8.143-30.065.213s-8.165 21.815.213 30.065l92.385 91.173H191.362c-11.758 0-21.262 9.504-21.262 21.262 0 11.758 9.504 21.263 21.262 21.263h247.559l-92.385 91.173c-8.377 8.25-8.441 21.709-.213 30.065a21.255 21.255 0 0015.139 6.336c5.401 0 10.801-2.041 14.926-6.124l129.276-127.575c4.04-3.997 6.336-9.441 6.336-15.139s-2.295-11.163-6.336-15.139z"/>
            </svg>
          </button>
        </div>
      </header>

      {currentView === 'dashboard' && filteredData && (
        <>
          {dashboardSubView === 'home' ? (
            <DashboardHome data={data} user={user} bus={bus} />
          ) : (
            <>
              <div className="kpi-product-row" role="region" aria-label="Indicadores de desempenho">
                <KpiBar kpis={filteredKpis} delta={hasAnyFilter ? null : data.kpi_delta} backlog={filteredData.backlog} doneIssues={data.done_issues} doneHistorical={data.done_issues_historical} />
                <div className="kpi-product-divider" aria-hidden="true" />
                <ProductStrip issues={filteredData.backlog} />
              </div>

              <div className="filter-bar" role="region" aria-label="Filtros e busca">
            <div className="search-wrapper">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                className="search-input"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar issue, chave ou pessoa... (Ctrl+K)"
                aria-label="Buscar issues, chaves ou pessoas"
              />
              {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Limpar busca">✕</button>}
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
              <div className="filter-status" role="status" aria-live="polite">
                <span className="filter-status-text">Dados filtrados</span>
                <button className="clear-filters-btn" onClick={() => { setFilters(EMPTY_FILTERS); setSearchQuery('') }} aria-label="Limpar todos os filtros" title="Remover todos os filtros ativos e mostrar todos os dados">
                  ✕ limpar tudo
                </button>
              </div>
            )}

                {data.stale_issues?.length > 0 && (
                  <StaleBanner issues={data.stale_issues} jiraBaseUrl={data.jira_base_url} />
                )}
              </div>

              <main className="app-body app-body--full" role="main" aria-label="Grid de desenvolvedores">
                <DevGrid devs={filteredData.devs} jiraBaseUrl={filteredData.jira_base_url} bus={bus} />
              </main>

              <button className="backlog-toggle-btn" onClick={() => setBacklogOpen(v => !v)} aria-label={backlogOpen ? 'Fechar backlog' : `Abrir backlog com ${filteredData.backlog.length} items`} aria-expanded={backlogOpen} title={backlogOpen ? 'Fechar painel de backlog' : `Abrir painel de backlog (${filteredData.backlog.length} issues)`}>
                {backlogOpen ? '✕' : `Backlog (${filteredData.backlog.length})`}
              </button>
              <div className={`backlog-drawer ${backlogOpen ? 'backlog-drawer--open' : ''}`}>
                <BacklogPanel issues={filteredData.backlog} jiraBaseUrl={filteredData.jira_base_url} />
              </div>
              {backlogOpen && <div className="backlog-overlay" onClick={() => setBacklogOpen(false)} />}
            </>
          )}
        </>
      )}

      {currentView === 'management' && data && <ErrorBoundary name="Gestão"><ManagementView data={filteredData} filters={filters} /></ErrorBoundary>}
      {currentView === 'product' && filteredData && <ErrorBoundary name="Produto"><ProductView data={filteredData} /></ErrorBoundary>}
      {currentView === 'timeline' && data && <ErrorBoundary name="Timeline"><TimelineView data={filteredData || data} filters={filters} filterOptions={filterOptions} onToggleFilter={toggleFilter} onClearFilter={clearFilter} bus={bus} /></ErrorBoundary>}
      {currentView === 'kanban' && data && <ErrorBoundary name="Kanban"><KanbanView data={data} /></ErrorBoundary>}
      {currentView === 'admin' && user?.permissions?.includes('admin') && <ErrorBoundary name="Admin"><AdminView assignees={filterOptions.assignees} onBusChange={setBus} user={user} /></ErrorBoundary>}
      {currentView === 'prioritization' && data && <ErrorBoundary name="Priorização"><PrioritizationView data={data} bus={bus} user={user} /></ErrorBoundary>}

      {showPrioritizationWizard && (
        <PrioritizationWizard
          data={data}
          user={user}
          bus={bus}
          onClose={() => setShowPrioritizationWizard(false)}
        />
      )}

      {user && data && <AIAssistantCollapsible data={data} user={user} />}

      <footer className="app-footer">
        Desenvolvido por <span className="app-footer-name">Andressa Soares</span>
      </footer>
    </div>
  )
}
