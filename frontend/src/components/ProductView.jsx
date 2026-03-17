import { useMemo, useState, useEffect, useCallback } from 'react'
import { track } from '../analytics'
import { PRIO_ORDER, isWaiting, isInProgress } from '../utils/constants'
import './ProductView.css'

// ═══════════════════════════════════════════════════════════════
//  DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════

const COLORS = [
  'var(--azul-claro)', 'var(--azul-primario)', 'var(--rosa)',
  'var(--verde)', 'var(--amarelo)', '#a78bfa', '#fb923c', '#34d399',
]

const STATUS_COLORS = {
  progress: 'var(--azul-primario)',
  waiting:  'var(--amarelo)',
  overdue:  'var(--rosa)',
  done:     'var(--verde)',
}

const PRIO_COLORS = {
  Highest: 'var(--rosa)',    High: '#fb923c',
  Medium:  'var(--amarelo)', Low:  'var(--azul-claro)', Lowest: 'var(--text-muted)',
}

const PERIOD_OPTIONS = [
  { label: 'Tudo',      days: null },
  { label: '2 semanas', days: 14   },
  { label: '1 mês',     days: 30   },
  { label: '3 meses',   days: 90   },
]

const HEALTH_THRESHOLDS = { healthy: 0.15, alert: 0.30 }
const BOTTLENECK_THRESHOLD = 0.30

const STOP_WORDS = new Set([
  'de','da','do','das','dos','em','no','na','nos','nas','e','o','a','os','as',
  'um','uma','para','com','por','que','se','ao','aos','ou','mas','mais','foi',
  'ser','estar','tem','ter','via','novo','nova','novos','novas','este','esta',
  'esse','essa','isso','isto','quando','como','seu','sua','seus','suas','pelo',
  'pela','pelos','pelas','entre','sobre','após','onde','também','criar',
])


// ═══════════════════════════════════════════════════════════════
//  BI ENGINE — Inteligência Operacional
// ═══════════════════════════════════════════════════════════════

function dedup(issues) {
  const seen = new Set()
  return issues.filter(i => { if (seen.has(i.key)) return false; seen.add(i.key); return true })
}

function filterByPeriod(issues, days) {
  if (!days) return issues
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return issues.filter(i => !i.created || new Date(i.created) >= cutoff)
}

function computeLeadTimes(issues) {
  const byProduct = {}
  issues.forEach(i => {
    if (!i.created) return
    const product = i.product || 'Sem Produto'
    const created = new Date(i.created)
    const now = i.resolved_date ? new Date(i.resolved_date) : new Date()
    const days = Math.max(0, (now - created) / (1000 * 60 * 60 * 24))
    if (!byProduct[product]) byProduct[product] = []
    byProduct[product].push(days)
  })

  return Object.entries(byProduct).reduce((acc, [name, times]) => {
    const sorted = [...times].sort((a, b) => a - b)
    acc[name] = {
      avg: times.reduce((s, v) => s + v, 0) / times.length,
      median: sorted[Math.floor(sorted.length / 2)] || 0,
      p90: sorted[Math.floor(sorted.length * 0.9)] || 0,
      count: times.length,
    }
    return acc
  }, {})
}

function computeThroughput(doneIssues, windowDays = 7) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)
  const recent = doneIssues.filter(i => i.resolved_date && new Date(i.resolved_date) >= cutoff)

  const byProduct = {}
  recent.forEach(i => {
    const p = i.product || 'Sem Produto'
    byProduct[p] = (byProduct[p] || 0) + 1
  })

  return { total: recent.length, perWeek: recent.length, byProduct }
}

function computeHealthScore(stats) {
  const overduePct = stats.total > 0 ? stats.overdue / stats.total : 0
  const waitingPct = stats.total > 0 ? stats.waiting / stats.total : 0
  const risk = overduePct * 0.7 + waitingPct * 0.3

  if (risk <= HEALTH_THRESHOLDS.healthy) return { level: 'healthy', label: 'Saudável', risk }
  if (risk <= HEALTH_THRESHOLDS.alert)   return { level: 'alert',   label: 'Alerta',   risk }
  return { level: 'critical', label: 'Crítico', risk }
}

function detectBottlenecks(issues) {
  const byAssignee = {}
  const byAccount = {}

  issues.forEach(i => {
    const assignee = i.assignee?.display_name || 'Não atribuído'
    const account = i.account || 'Sem Account'

    if (!byAssignee[assignee]) byAssignee[assignee] = { total: 0, overdue: 0 }
    byAssignee[assignee].total++
    if (i.is_overdue) byAssignee[assignee].overdue++

    if (!byAccount[account]) byAccount[account] = { total: 0, overdue: 0 }
    byAccount[account].total++
    if (i.is_overdue) byAccount[account].overdue++
  })

  const bottlenecks = []

  Object.entries(byAssignee).forEach(([name, stats]) => {
    if (stats.total >= 2 && stats.overdue / stats.total > BOTTLENECK_THRESHOLD) {
      bottlenecks.push({
        type: 'assignee',
        name,
        overdue: stats.overdue,
        total: stats.total,
        pct: stats.overdue / stats.total,
      })
    }
  })

  Object.entries(byAccount).forEach(([name, stats]) => {
    if (stats.total >= 2 && stats.overdue / stats.total > BOTTLENECK_THRESHOLD) {
      bottlenecks.push({
        type: 'account',
        name,
        overdue: stats.overdue,
        total: stats.total,
        pct: stats.overdue / stats.total,
      })
    }
  })

  return bottlenecks.sort((a, b) => b.pct - a.pct).slice(0, 5)
}

function buildStats(issues) {
  return issues.reduce((acc, issue) => {
    const name = issue.product || 'Sem Produto'
    if (!acc[name]) acc[name] = { name, total: 0, inProgress: 0, overdue: 0, waiting: 0, done: 0 }
    acc[name].total++
    if (issue.status?.category === 'done') {
      acc[name].done++
    } else if (issue.status?.category === 'indeterminate') {
      if (isWaiting(issue)) acc[name].waiting++
      else acc[name].inProgress++
    }
    if (issue.is_overdue) acc[name].overdue++
    return acc
  }, {})
}

function buildThemes(issues) {
  const freq = {}
  issues.forEach(i => {
    const words = (i.summary || '').toLowerCase()
      .replace(/[^a-záéíóúãõâêîôûàèìòùç\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  })
  return Object.entries(freq)
    .filter(([, c]) => c > 1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
}


function buildMatrix(issues, rowField, colGetter) {
  const rowMap    = {}
  const colTotals = {}

  issues.forEach(i => {
    const row = i[rowField] || 'Sem Produto'
    const col = colGetter(i) || 'N/A'
    colTotals[col] = (colTotals[col] || 0) + 1
    if (!rowMap[row]) rowMap[row] = {}
    rowMap[row][col] = (rowMap[row][col] || 0) + 1
  })

  const topRows = Object.entries(rowMap)
    .map(([name, cols]) => ({ name, total: Object.values(cols).reduce((s, v) => s + v, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map(r => r.name)

  const topCols = Object.entries(colTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 7)
    .map(([k]) => k)

  let maxVal = 0
  topRows.forEach(r => topCols.forEach(c => {
    const v = rowMap[r]?.[c] || 0
    if (v > maxVal) maxVal = v
  }))

  return { rows: topRows, cols: topCols, matrix: rowMap, maxVal }
}


// ═══════════════════════════════════════════════════════════════
//  MODULAR COMPONENTS
// ═══════════════════════════════════════════════════════════════

function StatCard({ label, value, unit, accent, subtitle, icon }) {
  return (
    <div className={`pv-stat-card ${accent ? `pv-stat-card--${accent}` : ''}`}>
      <div className="pv-stat-card__header">
        {icon && <span className="pv-stat-card__icon">{icon}</span>}
        <span className="pv-stat-card__label">{label}</span>
      </div>
      <div className="pv-stat-card__body">
        <span className="pv-stat-card__value">{value}</span>
        {unit && <span className="pv-stat-card__unit">{unit}</span>}
      </div>
      {subtitle && <span className="pv-stat-card__subtitle">{subtitle}</span>}
    </div>
  )
}

function HealthBadge({ health }) {
  return (
    <div className={`pv-health-badge pv-health-badge--${health.level}`} role="status" aria-label={`Saúde operacional: ${health.label}`}>
      <span className="pv-health-badge__dot" />
      <span className="pv-health-badge__label">{health.label}</span>
      <span className="pv-health-badge__pct">{(health.risk * 100).toFixed(0)}% risco</span>
    </div>
  )
}

function BottleneckAlert({ bottlenecks }) {
  if (!bottlenecks.length) return null

  return (
    <div className="pv-bottleneck-panel" role="alert">
      <div className="pv-bottleneck-header">
        <span className="pv-bottleneck-icon">&#9888;</span>
        <span className="pv-bottleneck-title">Gargalos Identificados</span>
      </div>
      <div className="pv-bottleneck-list">
        {bottlenecks.map((b, i) => (
          <div key={i} className="pv-bottleneck-item">
            <span className="pv-bottleneck-type">{b.type === 'assignee' ? 'Responsável' : 'Account'}</span>
            <span className="pv-bottleneck-name">{b.name}</span>
            <span className="pv-bottleneck-stats">{b.overdue}/{b.total} atrasadas ({(b.pct * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HBar({ product, maxTotal, color }) {
  const pctBar      = maxTotal > 0 ? product.total / maxTotal : 0
  const pctProgress = product.total > 0 ? product.inProgress / product.total : 0
  const pctWaiting  = product.total > 0 ? product.waiting    / product.total : 0
  const pctOverdue  = product.total > 0 ? product.overdue    / product.total : 0

  return (
    <div className="pv-hbar-row">
      <span className="pv-hbar-label" title={product.name}>{product.name}</span>
      <div className="pv-hbar-track">
        <div className="pv-hbar-bg" style={{ width: `${pctBar * 100}%`, background: color, opacity: 0.15 }} />
        <div className="pv-hbar-segs" style={{ width: `${pctBar * 100}%` }}>
          <div style={{ flex: pctProgress, background: STATUS_COLORS.progress, opacity: 0.85, minWidth: pctProgress > 0 ? 2 : 0 }} />
          <div style={{ flex: pctWaiting,  background: STATUS_COLORS.waiting,  opacity: 0.85, minWidth: pctWaiting  > 0 ? 2 : 0 }} />
          <div style={{ flex: pctOverdue,  background: STATUS_COLORS.overdue,  opacity: 0.90, minWidth: pctOverdue  > 0 ? 2 : 0 }} />
          <div style={{ flex: Math.max(0, 1 - pctProgress - pctWaiting - pctOverdue), background: 'transparent' }} />
        </div>
      </div>
      <span className="pv-hbar-total" style={{ color }}>{product.total}</span>
    </div>
  )
}

function IdealVsRealRadar({ products, maxTotal, idealProfile }) {
  const size = 240, cx = 120, cy = 120, R = 85
  const axes   = ['Volume', 'Andamento', 'Aguardando', 'Atraso']
  const n      = axes.length
  const angles = axes.map((_, i) => (i / n) * 2 * Math.PI - Math.PI / 2)
  const ptXY   = (angle, frac) => [cx + R * frac * Math.cos(angle), cy + R * frac * Math.sin(angle)]

  const realVals = (p) => [
    maxTotal > 0 ? p.total      / maxTotal : 0,
    p.total  > 0 ? p.inProgress / p.total  : 0,
    p.total  > 0 ? p.waiting    / p.total  : 0,
    p.total  > 0 ? p.overdue    / p.total  : 0,
  ]

  const idealPts = angles.map((a, i) => ptXY(a, idealProfile[i]).join(',')).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Gráfico radar: Ideal vs Real">
      {[0.25, 0.5, 0.75, 1].map(level => (
        <polygon key={level}
          points={angles.map(a => ptXY(a, level).join(',')).join(' ')}
          fill="none" stroke="var(--border-strong)" strokeWidth="0.5" strokeDasharray={level < 1 ? '3,3' : 'none'} />
      ))}
      {angles.map((a, i) => {
        const [x2, y2] = ptXY(a, 1)
        return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="var(--border-strong)" strokeWidth="0.5" />
      })}
      {axes.map((label, i) => {
        const [x, y] = ptXY(angles[i], 1.25)
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
          fontSize="9.5" fill="var(--text-muted)" fontFamily="Lato, sans-serif" fontWeight="600">{label}</text>
      })}

      {/* Ideal zone */}
      <polygon points={idealPts}
        fill="var(--verde)" fillOpacity="0.08" stroke="var(--verde)" strokeWidth="1.5" strokeDasharray="6,3" />

      {/* Real products — only top 4 for clarity */}
      {products.slice(0, 4).map((p, pi) => {
        const vals = realVals(p)
        const pts  = angles.map((a, i) => ptXY(a, vals[i]).join(',')).join(' ')
        const color = COLORS[pi % COLORS.length]
        const isOutlier = vals[3] > BOTTLENECK_THRESHOLD
        return <polygon key={p.name} points={pts}
          fill={color} fillOpacity={isOutlier ? '0.30' : '0.12'}
          stroke={color} strokeWidth={isOutlier ? '2.5' : '1.5'} />
      })}
    </svg>
  )
}

function ThemeBar({ word, count, maxCount }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  return (
    <div className="pv-theme-row">
      <span className="pv-theme-word">{word}</span>
      <div className="pv-theme-track">
        <div className="pv-theme-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="pv-theme-count">{count}</span>
    </div>
  )
}


function MatrixTable({ label, rows, cols, matrix, maxVal }) {
  if (!rows.length || !cols.length) return <p className="pv-empty">Dados insuficientes</p>
  const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + '\u2026' : s

  return (
    <div className="pv-matrix-scroll">
      <table className="pv-matrix-table">
        <thead>
          <tr>
            <th className="pv-matrix-corner">{label}</th>
            {cols.map(c => <th key={c} className="pv-matrix-col-head" title={c}>{trunc(c, 14)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r}>
              <td className="pv-matrix-row-head" title={r}>{trunc(r, 20)}</td>
              {cols.map(c => {
                const val       = matrix[r]?.[c] || 0
                const intensity = maxVal > 0 ? val / maxVal : 0
                return (
                  <td key={c} className="pv-matrix-cell"
                    style={{ '--intensity': intensity }}
                    title={`${r} \u00d7 ${c}: ${val}`}>
                    {val || ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LeadTimeTable({ leadTimes, ranked }) {
  const entries = ranked
    .map(p => ({ name: p.name, ...(leadTimes[p.name] || { avg: 0, median: 0, p90: 0, count: 0 }) }))
    .filter(e => e.count > 0)

  if (!entries.length) return <p className="pv-empty">Dados insuficientes para Lead Time</p>

  const maxAvg = Math.max(...entries.map(e => e.avg), 1)

  return (
    <div className="pv-leadtime-list">
      {entries.map(e => {
        const pct = (e.avg / maxAvg) * 100
        const isHigh = e.avg > 14
        return (
          <div key={e.name} className="pv-leadtime-row">
            <span className="pv-leadtime-name" title={e.name}>{e.name}</span>
            <div className="pv-leadtime-bar-track">
              <div className={`pv-leadtime-bar-fill ${isHigh ? 'pv-leadtime-bar-fill--high' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="pv-leadtime-metrics">
              <span className={`pv-leadtime-avg ${isHigh ? 'pv-leadtime-avg--high' : ''}`}>{e.avg.toFixed(1)}d</span>
              <span className="pv-leadtime-p90" title="Percentil 90">P90: {e.p90.toFixed(1)}d</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DrillPanel({ productName, issues, jiraBaseUrl, onClose, health }) {
  const sorted = [...issues].sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1
    return (PRIO_ORDER[a.priority?.name] ?? 2) - (PRIO_ORDER[b.priority?.name] ?? 2)
  })

  const overdue    = sorted.filter(i => i.is_overdue).length
  const inProgress = sorted.filter(i => i.status?.category === 'indeterminate').length

  return (
    <div className="pv-drill-panel">
      <div className="pv-drill-header">
        <div className="pv-drill-title-row">
          <h3 className="pv-drill-title">{productName}</h3>
          {health && <HealthBadge health={health} />}
          <div className="pv-drill-meta">
            <span className="pv-drill-chip">{sorted.length} issues</span>
            {inProgress > 0 && <span className="pv-drill-chip pv-drill-chip--progress">{inProgress} andamento</span>}
            {overdue    > 0 && <span className="pv-drill-chip pv-drill-chip--overdue">{overdue} atrasadas</span>}
          </div>
        </div>
        <button className="pv-drill-close" onClick={onClose} title="Fechar drill" aria-label="Fechar painel de detalhes">&#10005;</button>
      </div>

      <div className="pv-drill-list">
        {sorted.map(i => {
          const pcolor = PRIO_COLORS[i.priority?.name] || 'var(--text-muted)'
          const url    = jiraBaseUrl && i.key ? `${jiraBaseUrl}/browse/${i.key}` : null
          return (
            <div key={i.key} className={`pv-drill-row${i.is_overdue ? ' pv-drill-row--overdue' : ''}`}>
              <div className="pv-drill-left">
                <span className="pv-drill-prio-dot" style={{ background: pcolor }} title={i.priority?.name} />
                {url
                  ? <a href={url} target="_blank" rel="noopener noreferrer" className="pv-drill-key">{i.key}</a>
                  : <span className="pv-drill-key">{i.key}</span>
                }
                <span className="pv-drill-summary" title={i.summary}>{i.summary}</span>
              </div>
              <div className="pv-drill-right">
                <span className="pv-drill-assignee">{i.assignee?.display_name || '\u2014'}</span>
                <span className={`pv-drill-status ${i.is_overdue ? 'pv-drill-status--overdue' : isWaiting(i) ? 'pv-drill-status--waiting' : ''}`}>
                  {i.status?.name || '\u2014'}
                </span>
                {i.is_overdue && <span className="pv-drill-overdue-tag">ATRASADA</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
//  MAIN — ProductView (Operations Command Center)
// ═══════════════════════════════════════════════════════════════

export default function ProductView({ data }) {
  const [period, setPeriod] = useState(null)
  const [drillProduct, setDrillProduct] = useState(null)
  const [detailsExpanded, setDetailsExpanded] = useState(false)

  useEffect(() => { track('product_view_opened') }, [])

  // --- Data pipeline ---
  const allIssues = useMemo(
    () => dedup([...data.backlog, ...data.devs.flatMap(d => d.active_issues)]),
    [data]
  )
  const doneIssues = useMemo(() => data.done_issues || [], [data])

  const issues = useMemo(() => filterByPeriod(allIssues, period), [allIssues, period])

  // --- BI Metrics ---
  const ranked = useMemo(
    () => Object.values(buildStats(issues)).sort((a, b) => b.total - a.total).slice(0, 8),
    [issues]
  )
  const maxTotal = ranked[0]?.total || 1

  const globalStats = useMemo(() => ({
    total: issues.length,
    inProgress: issues.filter(i => isInProgress(i)).length,
    waiting: issues.filter(i => isWaiting(i)).length,
    overdue: issues.filter(i => i.is_overdue).length,
  }), [issues])

  const globalHealth = useMemo(() => computeHealthScore(globalStats), [globalStats])

  const leadTimes = useMemo(() => computeLeadTimes(issues), [issues])
  const globalLeadTime = useMemo(() => {
    const vals = Object.values(leadTimes)
    if (!vals.length) return 0
    return vals.reduce((s, v) => s + v.avg, 0) / vals.length
  }, [leadTimes])

  const throughput = useMemo(() => computeThroughput(doneIssues), [doneIssues])

  const bottlenecks = useMemo(() => detectBottlenecks(issues), [issues])

  const themes    = useMemo(() => buildThemes(issues), [issues])
  const devMatrix     = useMemo(() => buildMatrix(issues, 'product', i => i.assignee?.display_name), [issues])
  const accountMatrix = useMemo(() => buildMatrix(issues, 'product', i => i.account), [issues])

  // Ideal radar profile: high volume, high progress, low waiting, zero overdue
  const idealProfile = useMemo(() => [0.8, 0.7, 0.1, 0.0], [])

  // Drill state
  const activeDrill = drillProduct ?? ranked[0]?.name ?? null
  const drillIssues = useMemo(
    () => issues.filter(i => (i.product || 'Sem Produto') === activeDrill),
    [issues, activeDrill]
  )
  const drillStats = useMemo(() => {
    const stats = ranked.find(r => r.name === activeDrill)
    return stats ? computeHealthScore(stats) : null
  }, [ranked, activeDrill])

  // Product health map for table
  const productHealthMap = useMemo(() => {
    const map = {}
    ranked.forEach(p => { map[p.name] = computeHealthScore(p) })
    return map
  }, [ranked])

  const handleDrillClick = useCallback((name) => {
    setDrillProduct(name)
    setDetailsExpanded(true)
    track('product_drill_click', { product: name })
  }, [])

  return (
    <div className="pv-root">

      {/* ─── Header ─── */}
      <div className="pv-header">
        <div className="pv-header__left">
          <h2 className="pv-title">Central de Operações — Produto</h2>
          <HealthBadge health={globalHealth} />
        </div>
        <div className="pv-controls">
          <div className="pv-legend">
            <span className="pv-leg-item"><span className="pv-leg-dot" style={{ background: STATUS_COLORS.progress }} />Andamento</span>
            <span className="pv-leg-item"><span className="pv-leg-dot" style={{ background: STATUS_COLORS.waiting }} />Aguardando</span>
            <span className="pv-leg-item"><span className="pv-leg-dot" style={{ background: STATUS_COLORS.overdue }} />Atrasado</span>
            <span className="pv-leg-item"><span className="pv-leg-dot" style={{ background: 'var(--verde)' }} />Ideal</span>
          </div>
          <div className="pv-period-btns" role="radiogroup" aria-label="Filtro de período">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.label}
                className={`pv-period-btn ${period === opt.days ? 'active' : ''}`}
                role="radio" aria-checked={period === opt.days}
                onClick={() => { setPeriod(opt.days); track('product_period_filter', { period: opt.label }) }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── KPI Strip ─── */}
      <div className="pv-kpi-strip" role="region" aria-label="Indicadores operacionais">
        <StatCard label="Total Issues" value={globalStats.total} icon="&#9670;" accent="neutral" />
        <StatCard label="Em Andamento" value={globalStats.inProgress} icon="&#9654;" accent="progress" />
        <StatCard label="Aguardando" value={globalStats.waiting} icon="&#9208;" accent="waiting" />
        <StatCard label="Atrasadas" value={globalStats.overdue} icon="&#9888;" accent="overdue"
          subtitle={globalStats.total > 0 ? `${((globalStats.overdue / globalStats.total) * 100).toFixed(0)}% do total` : undefined} />
        <StatCard label="Lead Time Médio" value={globalLeadTime.toFixed(1)} unit="dias" icon="&#8986;" accent="neutral"
          subtitle="Criação → Resolução" />
        <StatCard label="Throughput" value={throughput.perWeek} unit="/sem" icon="&#9889;" accent="done"
          subtitle={`${doneIssues.length} concluídas total`} />
      </div>

      {/* ─── Bottleneck Alerts ─── */}
      <BottleneckAlert bottlenecks={bottlenecks} />

      {/* ─── Row 1: Volume + Radar ─── */}
      <div className="pv-grid-2">
        <div className="pv-panel">
          <h3 className="pv-panel-title">Comparativo de Volume</h3>
          <div className="pv-bars">
            {ranked.map((p, i) => (
              <HBar key={p.name} product={p} maxTotal={maxTotal} color={COLORS[i % COLORS.length]} />
            ))}
          </div>
        </div>

        <div className="pv-panel pv-radar-panel">
          <h3 className="pv-panel-title">Radar — Ideal vs Real</h3>
          <IdealVsRealRadar products={ranked} maxTotal={maxTotal} idealProfile={idealProfile} />
          <div className="pv-radar-legend">
            <div className="pv-radar-leg-item">
              <span className="pv-radar-leg-dot" style={{ background: 'var(--verde)', border: '1px dashed var(--verde)' }} />
              <span className="pv-radar-leg-label pv-radar-leg-label--ideal">Perfil Ideal</span>
            </div>
            {ranked.slice(0, 4).map((p, i) => {
              const isOutlier = p.total > 0 && p.overdue / p.total > BOTTLENECK_THRESHOLD
              return (
                <div key={p.name} className={`pv-radar-leg-item ${isOutlier ? 'pv-radar-leg-item--outlier' : ''}`}>
                  <span className="pv-radar-leg-dot" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="pv-radar-leg-label">{p.name}</span>
                  {isOutlier && <span className="pv-radar-outlier-badge">outlier</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── Row 2: Lead Time ─── */}
      <div className="pv-panel">
        <h3 className="pv-panel-title">Lead Time por Produto <span className="pv-panel-hint">média em dias</span></h3>
        <LeadTimeTable leadTimes={leadTimes} ranked={ranked} />
      </div>

      {/* ─── Row 3: Temas + Matrizes ─── */}
      <div className="pv-grid-2">
        <div className="pv-panel">
          <h3 className="pv-panel-title">Temas mais Frequentes</h3>
          {themes.length === 0
            ? <p className="pv-empty">Nenhum tema recorrente encontrado</p>
            : themes.map(([word, count]) => (
                <ThemeBar key={word} word={word} count={count} maxCount={themes[0][1]} />
              ))
          }
        </div>

        <div className="pv-panel">
          <h3 className="pv-panel-title">Produto &#215; Responsável</h3>
          <MatrixTable
            label="Produto ↓ / Dev →"
            rows={devMatrix.rows}
            cols={devMatrix.cols}
            matrix={devMatrix.matrix}
            maxVal={devMatrix.maxVal}
          />
        </div>
      </div>

      {/* ─── Matrix Account ─── */}
      <div className="pv-panel">
        <h3 className="pv-panel-title">Produto &#215; Account</h3>
        <MatrixTable
          label="Produto ↓ / Account →"
          rows={accountMatrix.rows}
          cols={accountMatrix.cols}
          matrix={accountMatrix.matrix}
          maxVal={accountMatrix.maxVal}
        />
      </div>

      {/* ─── Progressive Disclosure: Detalhamento ─── */}
      <div className="pv-panel pv-detail-section">
        <button
          className="pv-detail-toggle"
          onClick={() => setDetailsExpanded(v => !v)}
          aria-expanded={detailsExpanded}
          aria-controls="pv-detail-content"
        >
          <div className="pv-detail-toggle__left">
            <h3 className="pv-panel-title" style={{ margin: 0 }}>Detalhamento por Produto</h3>
            <span className="pv-detail-toggle__hint">
              {detailsExpanded ? 'Clique para recolher' : 'Clique para expandir diagnóstico completo'}
            </span>
          </div>
          <div className="pv-detail-toggle__right">
            {/* Health summary pills */}
            {!detailsExpanded && ranked.length > 0 && (
              <div className="pv-health-summary-pills">
                {(() => {
                  const counts = { healthy: 0, alert: 0, critical: 0 }
                  ranked.forEach(p => { counts[productHealthMap[p.name]?.level || 'healthy']++ })
                  return (
                    <>
                      {counts.healthy > 0  && <span className="pv-health-pill pv-health-pill--healthy">{counts.healthy} saudável</span>}
                      {counts.alert > 0    && <span className="pv-health-pill pv-health-pill--alert">{counts.alert} alerta</span>}
                      {counts.critical > 0 && <span className="pv-health-pill pv-health-pill--critical">{counts.critical} crítico</span>}
                    </>
                  )
                })()}
              </div>
            )}
            <span className={`pv-detail-chevron ${detailsExpanded ? 'pv-detail-chevron--open' : ''}`}>&#9660;</span>
          </div>
        </button>

        {detailsExpanded && (
          <div id="pv-detail-content" className="pv-detail-content">
            <div className="pv-table-wrap">
              <table className="pv-table">
                <thead>
                  <tr>
                    <th>#</th><th>Produto</th><th>Saúde</th><th>Total</th>
                    <th>Andamento</th><th>Aguardando</th><th>Atrasado</th><th>% Atraso</th><th>Lead Time</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((p, i) => {
                    const health = productHealthMap[p.name]
                    const lt = leadTimes[p.name]
                    const overduePct = p.total > 0 ? p.overdue / p.total : 0
                    const isBottleneck = overduePct > BOTTLENECK_THRESHOLD

                    return (
                      <tr key={p.name}
                          className={`pv-table-row-click${activeDrill === p.name ? ' pv-table-row-active' : ''} ${isBottleneck ? 'pv-table-row--bottleneck' : ''}`}
                          onClick={() => handleDrillClick(p.name)}>
                        <td><span className="pv-rank" style={{ background: COLORS[i % COLORS.length] }}>#{i+1}</span></td>
                        <td className="pv-td-name">{p.name}</td>
                        <td>
                          {health && (
                            <span className={`pv-health-dot pv-health-dot--${health.level}`} title={health.label}>
                              {health.label}
                            </span>
                          )}
                        </td>
                        <td className="pv-td-num">{p.total}</td>
                        <td className="pv-td-num pv-td--progress">{p.inProgress}</td>
                        <td className="pv-td-num pv-td--waiting">{p.waiting}</td>
                        <td className="pv-td-num pv-td--overdue">{p.overdue}</td>
                        <td className="pv-td-num">
                          <span className={`pv-pct ${isBottleneck ? 'pv-pct--high' : ''}`}>
                            {(overduePct * 100).toFixed(0)}%
                          </span>
                          {isBottleneck && <span className="pv-bottleneck-tag" title="Gargalo identificado">gargalo</span>}
                        </td>
                        <td className="pv-td-num pv-td--leadtime">{lt ? `${lt.avg.toFixed(1)}d` : '\u2014'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Drill-down */}
            {activeDrill && drillIssues.length > 0 && (
              <DrillPanel
                productName={activeDrill}
                issues={drillIssues}
                jiraBaseUrl={data.jira_base_url}
                onClose={() => setDrillProduct(null)}
                health={drillStats}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
