import './KpiBar.css'

const KPI_CONFIG = [
  { key: 'total_sprint',   deltaKey: 'total_sprint',      label: 'Backlog',             color: 'azul-claro',    positiveIsGood: false },
  { key: 'in_progress',    deltaKey: 'in_progress',        label: 'Em Andamento',         color: 'azul-primario', positiveIsGood: false },
  { key: 'waiting',        deltaKey: 'waiting',            label: 'Aguardando',           color: 'amarelo',       positiveIsGood: false },
  { key: 'done_this_week', deltaKey: 'done_vs_last_week',  label: 'Concluídos na Semana', color: 'verde',         positiveIsGood: true  },
  { key: 'overdue',        deltaKey: 'overdue',            label: 'Em Atraso',            color: 'rosa',          positiveIsGood: false },
]

function Delta({ value, positiveIsGood }) {
  if (!value) return null
  const good  = positiveIsGood ? value > 0 : value < 0
  const color = good ? '#40EB4F' : '#FE70BD'
  const arrow = value > 0 ? '↑' : '↓'
  return <span className="kpi-delta" style={{ color }}>{arrow}{Math.abs(value)}</span>
}

export default function KpiBar({ kpis, delta }) {
  return (
    <div className="kpi-bar">
      {KPI_CONFIG.map(({ key, deltaKey, label, color, positiveIsGood }) => (
        <div key={key} className={`kpi-card kpi-${color}`}>
          <div className="kpi-value-row">
            <span className="kpi-value">{kpis[key] ?? 0}</span>
            {delta && <Delta value={delta[deltaKey]} positiveIsGood={positiveIsGood} />}
          </div>
          <span className="kpi-label">{label}</span>
          {deltaKey === 'done_vs_last_week' && delta?.done_vs_last_week !== 0 && (
            <span className="kpi-sublabel">vs semana anterior</span>
          )}
        </div>
      ))}
    </div>
  )
}
