import { useState, useEffect, useCallback } from 'react'
import KpiBar from './components/KpiBar'
import DevGrid from './components/DevGrid'
import BacklogPanel from './components/BacklogPanel'
import FiltersView from './components/FiltersView'
import AIInsightsView from './components/AIInsightsView'
import ProductView from './components/ProductView'
import KanbanView from './components/KanbanView'
import './App.css'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const REFRESH_SECRET = import.meta.env.VITE_REFRESH_SECRET ?? ''
const REFRESH_INTERVAL = 5 * 60 * 1000

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)
  const [currentView, setCurrentView] = useState('dashboard') // 'dashboard' | 'filters' | 'ai' | 'product' | 'kanban'
  const [filters, setFilters] = useState({})

  const fetchDashboard = useCallback(async (filterParams = {}) => {
    try {
      const params = new URLSearchParams(filterParams)
      const url = `${API}/api/dashboard${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetch(url)
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
      await fetchDashboard(filters)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboard(filters)
    const interval = setInterval(() => fetchDashboard(filters), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchDashboard, filters])

  const handleViewChange = (view) => {
    setCurrentView(view)
  }

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters)
    setCurrentView('dashboard')
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
            className={`view-btn ${currentView === 'filters' ? 'active' : ''}`}
            onClick={() => handleViewChange('filters')}
          >
            Filtros
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
            className={`refresh-btn ${refreshing ? 'loading' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'atualizando...' : '↻ atualizar'}
          </button>
        </div>
      </header>

      {currentView === 'dashboard' && data && (
        <>
          <KpiBar kpis={data.kpis} />
          <main className="app-body">
            <DevGrid devs={data.devs} jiraBaseUrl={data.jira_base_url} />
            <BacklogPanel issues={data.backlog} jiraBaseUrl={data.jira_base_url} />
          </main>
        </>
      )}

      {currentView === 'filters' && (
        <FiltersView onFiltersChange={handleFiltersChange} currentFilters={filters} />
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
