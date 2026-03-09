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
        {time.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
    </div>
  )
}

export default function NightSummary({ data, lastFetch, onExit }) {
  if (!data) return null

  const { kpis, kpi_delta: delta, stale_issues } = data

  const balance = kpis.done_this_week - (delta?.done_vs_last_week
    ? kpis.done_this_week - delta.done_vs_last_week
    : kpis.done_this_week)

  const stats = [
    { label: 'Concluídos esta semana',  value: kpis.done_this_week, color: '#40EB4F'  },
    { label: 'Em progresso agora',       value: kpis.in_progress,   color: '#3DB7F4'  },
    { label: 'Em atraso',                value: kpis.overdue,       color: '#FE70BD'  },
    { label: 'Aguardando desbloqueio',   value: kpis.waiting,       color: '#F2F24B'  },
    { label: 'Paralisadas > 30 dias',    value: stale_issues?.length ?? 0, color: '#FE70BD' },
  ]

  return (
    <div className="ns-overlay">
      <button className="ns-exit" onClick={onExit} title="Voltar ao dashboard completo">
        ☀ Modo normal
      </button>

      <Clock />

      <p className="ns-tagline">tech, but <em>people first.</em></p>

      <div className="ns-grid">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="ns-stat" style={{ borderTopColor: color }}>
            <span className="ns-stat-value" style={{ color }}>{value}</span>
            <span className="ns-stat-label">{label}</span>
          </div>
        ))}
      </div>

      {delta?.done_vs_last_week !== 0 && delta?.done_vs_last_week !== undefined && (
        <p className="ns-delta">
          {delta.done_vs_last_week > 0
            ? `↑ ${delta.done_vs_last_week} entregas a mais que na semana passada`
            : `↓ ${Math.abs(delta.done_vs_last_week)} entregas a menos que na semana passada`}
        </p>
      )}

      {lastFetch && (
        <p className="ns-updated">
          atualizado às {lastFetch.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
