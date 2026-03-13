import { useState, useEffect } from 'react'
import './NightSummary.css'

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="ns-clock">
      <span className="ns-time">
        {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="ns-date">
        {time.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
    </div>
  )
}

export default function NightSummary({ data, lastFetch, onExit }) {
  if (!data) return null

  const { kpis, kpi_delta: delta, devs, stale_issues } = data

  // Devs com mais issues (top 3)
  const topDevs = devs
    .sort((a, b) => b.active_issues.length - a.active_issues.length)
    .slice(0, 3)

  // Issues em atraso (top 3)
  const overdueIssues = devs
    .flatMap(d => d.active_issues.map(i => ({ ...i, dev: d.assignee.display_name })))
    .filter(i => i.is_overdue)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 3)

  const stats = [
    { label: 'Concluído', value: kpis.done_this_week, color: '#40EB4F'  },
    { label: 'Progresso', value: kpis.in_progress, color: '#3DB7F4'  },
    { label: 'Atraso', value: kpis.overdue, color: '#FE70BD'  },
    { label: 'Aguardando', value: kpis.waiting, color: '#F2F24B'  },
  ]

  return (
    <div className="ns-overlay">
      <button className="ns-exit" onClick={onExit} aria-label="Voltar ao dashboard completo">
        ← Voltar
      </button>

      <div className="ns-container">
        {/* Coluna Esquerda */}
        <div className="ns-left">
          <Clock />
          <p className="ns-tagline">tech, but <em>people first.</em></p>

          {/* KPIs Grid 2x2 */}
          <div className="ns-grid">
            {stats.map(({ label, value, color }) => (
              <div key={label} className="ns-stat" style={{ borderTopColor: color }}>
                <span className="ns-stat-value" style={{ color }}>{value}</span>
                <span className="ns-stat-label">{label}</span>
              </div>
            ))}
          </div>

          {/* Delta Semanal */}
          {delta?.done_vs_last_week !== 0 && delta?.done_vs_last_week !== undefined && (
            <div className="ns-delta-card">
              <span className="ns-delta-arrow">{delta.done_vs_last_week > 0 ? '↑' : '↓'}</span>
              <span className="ns-delta-text">
                {Math.abs(delta.done_vs_last_week)} vs semana anterior
              </span>
            </div>
          )}
        </div>

        {/* Coluna Direita */}
        <div className="ns-right">
          {/* Top Devs */}
          {topDevs.length > 0 && (
            <div className="ns-section">
              <h3 className="ns-section-title">Top Devs</h3>
              <div className="ns-dev-list">
                {topDevs.map((dev, idx) => (
                  <div key={dev.assignee.account_id} className="ns-dev-item">
                    <span className="ns-dev-rank">#{idx + 1}</span>
                    <span className="ns-dev-name">{dev.assignee.display_name.split(' ')[0]}</span>
                    <span className="ns-dev-count">{dev.active_issues.length}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues em Atraso */}
          {overdueIssues.length > 0 && (
            <div className="ns-section">
              <h3 className="ns-section-title">⚠️ Em Atraso</h3>
              <div className="ns-issue-list">
                {overdueIssues.map((issue) => (
                  <div key={issue.key} className="ns-issue-item">
                    <span className="ns-issue-key">{issue.key}</span>
                    <span className="ns-issue-summary">{issue.summary.substring(0, 30)}...</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues Paralisadas */}
          {stale_issues?.length > 0 && (
            <div className="ns-section">
              <h3 className="ns-section-title">🔴 Paralisadas</h3>
              <span className="ns-stale-count">{stale_issues.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Timestamp */}
      {lastFetch && (
        <p className="ns-updated">
          atualizado às {lastFetch.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
