import { useState, useEffect, useCallback } from 'react'
import KpiBar from './components/KpiBar'
import DevGrid from './components/DevGrid'
import BacklogPanel from './components/BacklogPanel'
import './App.css'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const REFRESH_INTERVAL = 5 * 60 * 1000

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)

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
      await fetch(`${API}/api/refresh`, { method: 'POST' })
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

      {data && (
        <>
          <KpiBar kpis={data.kpis} />
          <main className="app-body">
            <DevGrid devs={data.devs} jiraBaseUrl={data.jira_base_url} />
            <BacklogPanel issues={data.backlog} jiraBaseUrl={data.jira_base_url} />
          </main>
        </>
      )}
    </div>
  )
}
