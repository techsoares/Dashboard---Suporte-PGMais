import './KpiBar.css'

const KPI_CONFIG = [
  { key: 'total_sprint',   deltaKey: 'total_sprint',      label: 'Backlog',             color: 'azul-claro',    positiveIsGood: false, tooltip: 'Total de issues no backlog atual' },
  { key: 'in_progress',    deltaKey: 'in_progress',        label: 'Em Andamento',         color: 'azul-primario', positiveIsGood: false, tooltip: 'Issues sendo trabalhadas agora' },
  { key: 'waiting',        deltaKey: 'waiting',            label: 'Aguardando',           color: 'amarelo',       positiveIsGood: false, tooltip: 'Issues aguardando aprovação, revisão ou desbloqueio' },
  { key: 'done_this_week', deltaKey: 'done_vs_last_week',  label: 'Concluídos na Semana', color: 'verde',         positiveIsGood: true,  tooltip: 'Issues entregues esta semana' },
  { key: 'overdue',        deltaKey: 'overdue',            label: 'Em Atraso',            color: 'rosa',          positiveIsGood: false, tooltip: 'Issues com prazo de entrega vencido' },
]

function Delta({ value, positiveIsGood }) {
  if (!value) return null
  const good  = positiveIsGood ? value > 0 : value < 0
  const color = good ? '#40EB4F' : '#FE70BD'
  const arrow = value > 0 ? '↑' : '↓'
  return <span className="kpi-delta" style={{ color }} title={`${good ? 'Melhora' : 'Piora'} de ${Math.abs(value)} em relação à semana anterior`}>{arrow}{Math.abs(value)}</span>
}

export default function KpiBar({ kpis, delta }) {
  return (
    <div className="kpi-bar">
      {KPI_CONFIG.map(({ key, deltaKey, label, color, positiveIsGood, tooltip }) => (
        <div key={key} className={`kpi-card kpi-${color}`} title={tooltip}>
          <div className="kpi-value-row">
            <span className="kpi-value">{kpis[key] ?? 0}</span>
            {delta && <Delta value={delta[deltaKey]} positiveIsGood={positiveIsGood} />}
          </div>
          <span className="kpi-label">{label}</span>
          {deltaKey === 'done_vs_last_week' && delta?.done_vs_last_week !== 0 && (
            <span className="kpi-sublabel" title="Comparação com a semana passada">vs semana anterior</span>
          )}
        </div>
      ))}
    </div>
  )
}
