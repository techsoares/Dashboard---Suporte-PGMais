import './KpiBar.css'

const KPI_CONFIG = [
  { key: 'total_sprint',   label: 'Backlog',             color: 'azul-claro'   },
  { key: 'in_progress',    label: 'Em Andamento',         color: 'azul-primario' },
  { key: 'waiting',        label: 'Aguardando',           color: 'amarelo'      },
  { key: 'done_this_week', label: 'Concluídos na Semana', color: 'verde'        },
  { key: 'overdue',        label: 'Em Atraso',            color: 'rosa'         },
]

export default function KpiBar({ kpis }) {
  return (
    <div className="kpi-bar">
      {KPI_CONFIG.map(({ key, label, color }) => (
        <div key={key} className={`kpi-card kpi-${color}`}>
          <span className="kpi-value">{kpis[key] ?? 0}</span>
          <span className="kpi-label">{label}</span>
        </div>
      ))}
    </div>
  )
}
