import { useMemo } from 'react'
import './KpiBar.css'

const KPI_CONFIG = [
  { key: 'total_sprint',   deltaKey: 'total_sprint',      label: 'Backlog',             color: 'azul-claro',    positiveIsGood: false, tooltip: 'Total de issues no backlog atual' },
  { key: 'in_progress',    deltaKey: 'in_progress',        label: 'Em Andamento',         color: 'azul-primario', positiveIsGood: false, tooltip: 'Issues sendo trabalhadas agora' },
  { key: 'waiting',        deltaKey: 'waiting',            label: 'Aguardando',           color: 'amarelo',       positiveIsGood: false, tooltip: 'Issues aguardando aprovação, revisão ou desbloqueio' },
  { key: 'done_this_week', deltaKey: 'done_vs_last_week',  label: 'Concluídos na Semana', color: 'verde',         positiveIsGood: true,  tooltip: 'Issues entregues esta semana' },
  { key: 'overdue',        deltaKey: 'overdue',            label: 'Em Atraso',            color: 'rosa',          positiveIsGood: false, tooltip: 'Issues com prazo de entrega vencido' },
]

const AGING_BUCKETS = [
  { label: '0-7d',   max: 7,   color: 'var(--verde)' },
  { label: '7-14d',  max: 14,  color: 'var(--azul-claro)' },
  { label: '14-30d', max: 30,  color: 'var(--amarelo)' },
  { label: '30d+',   max: Infinity, color: 'var(--rosa)' },
]

function Delta({ value, positiveIsGood }) {
  if (!value) return null
  const good  = positiveIsGood ? value > 0 : value < 0
  const color = good ? '#40EB4F' : '#FE70BD'
  const arrow = value > 0 ? '↑' : '↓'
  return <span className="kpi-delta" style={{ color }} title={`${good ? 'Melhora' : 'Piora'} de ${Math.abs(value)} em relação à semana anterior`}>{arrow}{Math.abs(value)}</span>
}

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function Sparkline({ doneIssues, doneHistorical }) {
  const weeklyData = useMemo(() => {
    const all = [...(doneHistorical || []), ...(doneIssues || [])]
    if (!all.length) return []

    const buckets = {}
    all.forEach(issue => {
      const resolved = issue.resolved_date || issue.created
      if (!resolved) return
      const weekKey = getMonday(resolved)
      buckets[weekKey] = (buckets[weekKey] || 0) + 1
    })

    const weeks = Object.keys(buckets).map(Number).sort((a, b) => a - b)
    if (weeks.length < 2) return []

    // Take last 6 weeks max
    const recent = weeks.slice(-6)
    return recent.map(w => ({ week: w, count: buckets[w] }))
  }, [doneIssues, doneHistorical])

  if (weeklyData.length < 2) return null

  const counts = weeklyData.map(w => w.count)
  const max = Math.max(...counts)
  const min = Math.min(...counts)
  const range = max - min || 1

  const width = 64
  const height = 22
  const padding = 2

  const points = weeklyData.map((w, i) => {
    const x = padding + (i / (weeklyData.length - 1)) * (width - padding * 2)
    const y = height - padding - ((w.count - min) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  // Trend: compare last vs first
  const trend = counts[counts.length - 1] - counts[0]
  const strokeColor = trend >= 0 ? 'var(--verde)' : 'var(--rosa)'

  const labels = weeklyData.map(w => {
    const d = new Date(w.week)
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}: ${w.count}`
  }).join('\n')

  return (
    <svg
      className="kpi-sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      title={`Throughput semanal:\n${labels}`}
    >
      <title>{`Throughput semanal:\n${labels}`}</title>
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {weeklyData.map((w, i) => {
        const x = padding + (i / (weeklyData.length - 1)) * (width - padding * 2)
        const y = height - padding - ((w.count - min) / range) * (height - padding * 2)
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === weeklyData.length - 1 ? 2.5 : 1.5}
            fill={i === weeklyData.length - 1 ? strokeColor : 'var(--text-muted)'}
          />
        )
      })}
    </svg>
  )
}

function AgingBar({ backlog }) {
  const aging = useMemo(() => {
    if (!backlog?.length) return null
    const now = Date.now()
    const counts = AGING_BUCKETS.map(() => 0)

    backlog.forEach(issue => {
      if (!issue.created) return
      const days = Math.floor((now - new Date(issue.created).getTime()) / 86400000)
      for (let i = 0; i < AGING_BUCKETS.length; i++) {
        if (days < AGING_BUCKETS[i].max || i === AGING_BUCKETS.length - 1) {
          counts[i]++
          break
        }
      }
    })

    const total = counts.reduce((s, c) => s + c, 0)
    if (!total) return null
    return counts.map((count, i) => ({
      ...AGING_BUCKETS[i],
      count,
      pct: Math.round((count / total) * 100),
    }))
  }, [backlog])

  if (!aging) return null

  const total = aging.reduce((s, b) => s + b.count, 0)

  return (
    <div className="kpi-aging" title="Distribuição de idade das issues abertas no backlog">
      <span className="kpi-aging-label">Aging</span>
      <div className="kpi-aging-bar">
        {aging.map(bucket => (
          bucket.count > 0 && (
            <div
              key={bucket.label}
              className="kpi-aging-segment"
              style={{
                width: `${(bucket.count / total) * 100}%`,
                background: bucket.color,
              }}
              title={`${bucket.label}: ${bucket.count} issue${bucket.count !== 1 ? 's' : ''} (${bucket.pct}%)`}
            />
          )
        ))}
      </div>
      <div className="kpi-aging-legend">
        {aging.map(bucket => (
          bucket.count > 0 && (
            <span key={bucket.label} className="kpi-aging-item" style={{ color: bucket.color }}>
              {bucket.count} <span className="kpi-aging-item-label">{bucket.label}</span>
            </span>
          )
        ))}
      </div>
    </div>
  )
}

export default function KpiBar({ kpis, delta, backlog, doneIssues, doneHistorical }) {
  return (
    <div className="kpi-bar">
      {KPI_CONFIG.map(({ key, deltaKey, label, color, positiveIsGood, tooltip }) => (
        <div key={key} className={`kpi-card kpi-${color}`} title={tooltip}>
          <div className="kpi-value-row">
            <span className="kpi-value">{kpis[key] ?? 0}</span>
            {delta && <Delta value={delta[deltaKey]} positiveIsGood={positiveIsGood} />}
          </div>
          <span className="kpi-label">{label}</span>
          {key === 'done_this_week' && (
            <Sparkline doneIssues={doneIssues} doneHistorical={doneHistorical} />
          )}
        </div>
      ))}
      <AgingBar backlog={backlog} />
    </div>
  )
}
