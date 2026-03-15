import { useMemo, useState, useEffect } from 'react'
import { track } from '../analytics'
import './ProductView.css'

const COLORS = [
  'var(--azul-claro)',
  'var(--azul-primario)',
  'var(--rosa)',
  'var(--verde)',
  'var(--amarelo)',
  '#a78bfa',
  '#fb923c',
  '#34d399',
]

const PRIOS = ['Highest', 'High', 'Medium', 'Low', 'Lowest']
const PRIO_COLORS = {
  Highest: 'var(--rosa)',
  High:    '#fb923c',
  Medium:  'var(--amarelo)',
  Low:     'var(--azul-claro)',
  Lowest:  'var(--text-muted)',
}

const PERIOD_OPTIONS = [
  { label: 'Tudo',      days: null },
  { label: '2 semanas', days: 14   },
  { label: '1 mês',     days: 30   },
  { label: '3 meses',   days: 90   },
]

const STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'e', 'o', 'a', 'os', 'as', 'um', 'uma', 'para', 'com', 'por',
  'que', 'se', 'ao', 'aos', 'ou', 'mas', 'mais', 'foi', 'ser',
  'estar', 'tem', 'ter', 'via', 'novo', 'nova', 'novos', 'novas',
  'este', 'esta', 'esse', 'essa', 'isso', 'isto', 'quando', 'como',
  'seu', 'sua', 'seus', 'suas', 'pelo', 'pela', 'pelos', 'pelas',
  'para', 'entre', 'sobre', 'após', 'onde', 'também', 'criar',
])

// --- Helpers ---

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

function buildStats(issues) {
  return issues.reduce((acc, issue) => {
    const name = issue.product || 'Sem Produto'
    if (!acc[name]) acc[name] = { name, total: 0, inProgress: 0, overdue: 0, waiting: 0 }
    acc[name].total++
    if (issue.status?.category === 'indeterminate') {
      if (issue.status?.name?.toLowerCase().includes('aguard')) acc[name].waiting++
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

function buildPriorityStats(issues) {
  const map = {}
  issues.forEach(i => {
    const p    = i.product || 'Sem Produto'
    const prio = i.priority?.name || 'Medium'
    if (!map[p]) map[p] = { name: p }
    map[p][prio] = (map[p][prio] || 0) + 1
  })
  return Object.values(map)
    .sort((a, b) => {
      const scoreA = (a.Highest || 0) * 4 + (a.High || 0) * 3
      const scoreB = (b.Highest || 0) * 4 + (b.High || 0) * 3
      return scoreB - scoreA
    })
    .slice(0, 8)
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

// --- Sub-components ---

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
          <div style={{ flex: pctProgress, background: 'var(--azul-primario)', opacity: 0.85, minWidth: pctProgress > 0 ? 2 : 0 }} />
          <div style={{ flex: pctWaiting,  background: 'var(--amarelo)',       opacity: 0.85, minWidth: pctWaiting  > 0 ? 2 : 0 }} />
          <div style={{ flex: pctOverdue,  background: 'var(--rosa)',          opacity: 0.90, minWidth: pctOverdue  > 0 ? 2 : 0 }} />
          <div style={{ flex: Math.max(0, 1 - pctProgress - pctWaiting - pctOverdue), background: 'transparent' }} />
        </div>
      </div>
      <span className="pv-hbar-total" style={{ color }}>{product.total}</span>
    </div>
  )
}

function MultiRadar({ products, maxTotal }) {
  const size = 220, cx = 110, cy = 110, R = 80
  const axes   = ['Volume', 'Andamento', 'Aguardando', 'Atraso']
  const n      = axes.length
  const angles = axes.map((_, i) => (i / n) * 2 * Math.PI - Math.PI / 2)
  const ptXY   = (angle, frac) => [cx + R * frac * Math.cos(angle), cy + R * frac * Math.sin(angle)]
  const getVals = (p) => [
    maxTotal > 0 ? p.total      / maxTotal : 0,
    p.total  > 0 ? p.inProgress / p.total  : 0,
    p.total  > 0 ? p.waiting    / p.total  : 0,
    p.total  > 0 ? p.overdue    / p.total  : 0,
  ]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map(level => (
        <polygon key={level}
          points={angles.map(a => ptXY(a, level).join(',')).join(' ')}
          fill="none" stroke="var(--border-strong)" strokeWidth="1" />
      ))}
      {angles.map((a, i) => {
        const [x2, y2] = ptXY(a, 1)
        return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="var(--border-strong)" strokeWidth="1" />
      })}
      {axes.map((label, i) => {
        const [x, y] = ptXY(angles[i], 1.28)
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fill="var(--text-muted)" fontFamily="Lato, sans-serif">{label}</text>
      })}
      {products.map((p, pi) => {
        const vals = getVals(p)
        const pts  = angles.map((a, i) => ptXY(a, vals[i]).join(',')).join(' ')
        const color = COLORS[pi % COLORS.length]
        return <polygon key={p.name} points={pts}
          fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.8" />
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

function PriorityBar({ product, maxCount }) {
  const total  = PRIOS.reduce((s, p) => s + (product[p] || 0), 0)
  const barPct = maxCount > 0 ? (total / maxCount) * 100 : 0
  return (
    <div className="pv-prio-row">
      <span className="pv-prio-label" title={product.name}>{product.name}</span>
      <div className="pv-prio-track">
        <div className="pv-prio-bar" style={{ width: `${barPct}%` }}>
          {PRIOS.map(p => {
            const count = product[p] || 0
            if (!count) return null
            return <div key={p} style={{ flex: count, background: PRIO_COLORS[p] }} title={`${p}: ${count}`} />
          })}
        </div>
      </div>
      <span className="pv-prio-total">{total}</span>
    </div>
  )
}

function MatrixTable({ label, rows, cols, matrix, maxVal }) {
  if (!rows.length || !cols.length) return <p className="pv-empty">Dados insuficientes</p>

  const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s

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
                    title={`${r} × ${c}: ${val}`}>
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

const PRIO_ORDER = { Highest: 0, Blocker: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 }

function DrillPanel({ productName, issues, jiraBaseUrl, onClose }) {
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
          <div className="pv-drill-meta">
            <span className="pv-drill-chip">{sorted.length} issues</span>
            {inProgress > 0 && <span className="pv-drill-chip pv-drill-chip--blue">{inProgress} andamento</span>}
            {overdue    > 0 && <span className="pv-drill-chip pv-drill-chip--red">{overdue} atrasadas</span>}
          </div>
        </div>
        <button className="pv-drill-close" onClick={onClose} title="Fechar drill">✕</button>
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
                <span className="pv-drill-assignee">{i.assignee?.display_name || '—'}</span>
                <span className="pv-drill-status">{i.status?.name || '—'}</span>
                {i.is_overdue && <span className="pv-drill-overdue-tag">ATRASADA</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Main component ---

export default function ProductView({ data }) {
  const [period, setPeriod] = useState(null)
  const [drillProduct, setDrillProduct] = useState(null)

  // Rastreia abertura da tela
  useEffect(() => { track('product_view_opened') }, [])

  const allIssues = useMemo(
    () => dedup([...data.backlog, ...data.devs.flatMap(d => d.active_issues)]),
    [data]
  )

  const issues = useMemo(() => filterByPeriod(allIssues, period), [allIssues, period])

  const ranked   = useMemo(
    () => Object.values(buildStats(issues)).sort((a, b) => b.total - a.total).slice(0, 8),
    [issues]
  )
  const maxTotal = ranked[0]?.total || 1

  const themes    = useMemo(() => buildThemes(issues), [issues])
  const prioStats = useMemo(() => buildPriorityStats(issues), [issues])
  const prioMaxCount = useMemo(
    () => prioStats.reduce((max, p) => Math.max(max, PRIOS.reduce((s, k) => s + (p[k] || 0), 0)), 1),
    [prioStats]
  )

  const devMatrix     = useMemo(
    () => buildMatrix(issues, 'product', i => i.assignee?.display_name),
    [issues]
  )
  const accountMatrix = useMemo(
    () => buildMatrix(issues, 'product', i => i.account),
    [issues]
  )

  // Drill: produto selecionado (padrão = mais carregado)
  const activeDrill = drillProduct ?? ranked[0]?.name ?? null
  const drillIssues = useMemo(
    () => issues.filter(i => (i.product || 'Sem Produto') === activeDrill),
    [issues, activeDrill]
  )

  return (
    <div className="pv-root">

      {/* Header */}
      <div className="pv-header">
        <h2 className="pv-title">Visão Produto</h2>
        <div className="pv-controls">
          <div className="pv-legend">
            <span className="pv-leg-item"><span className="pv-leg-dot" style={{background:'var(--azul-primario)'}}/>Andamento</span>
            <span className="pv-leg-item"><span className="pv-leg-dot" style={{background:'var(--amarelo)'}}/>Aguardando</span>
            <span className="pv-leg-item"><span className="pv-leg-dot" style={{background:'var(--rosa)'}}/>Atrasado</span>
          </div>
          <div className="pv-period-btns">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.label}
                className={`pv-period-btn ${period === opt.days ? 'active' : ''}`}
                onClick={() => { setPeriod(opt.days); track('product_period_filter', { period: opt.label }) }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 1: Volume + Radar */}
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
          <h3 className="pv-panel-title">Radar Geral</h3>
          <MultiRadar products={ranked.slice(0, 6)} maxTotal={maxTotal} />
          <div className="pv-radar-legend">
            {ranked.slice(0, 6).map((p, i) => (
              <div key={p.name} className="pv-radar-leg-item">
                <span className="pv-radar-leg-dot" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="pv-radar-leg-label">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Temas + Prioridade */}
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
          <h3 className="pv-panel-title">Prioridade por Produto</h3>
          <div className="pv-prio-legend">
            {PRIOS.map(p => (
              <span key={p} className="pv-prio-leg-item">
                <span className="pv-prio-leg-dot" style={{ background: PRIO_COLORS[p] }} />{p}
              </span>
            ))}
          </div>
          <div className="pv-bars">
            {prioStats.map(p => (
              <PriorityBar key={p.name} product={p} maxCount={prioMaxCount} />
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Matrizes */}
      <div className="pv-grid-2">
        <div className="pv-panel">
          <h3 className="pv-panel-title">Produto × Responsável</h3>
          <MatrixTable
            label="Produto ↓ / Dev →"
            rows={devMatrix.rows}
            cols={devMatrix.cols}
            matrix={devMatrix.matrix}
            maxVal={devMatrix.maxVal}
          />
        </div>

        <div className="pv-panel">
          <h3 className="pv-panel-title">Produto × Account</h3>
          <MatrixTable
            label="Produto ↓ / Account →"
            rows={accountMatrix.rows}
            cols={accountMatrix.cols}
            matrix={accountMatrix.matrix}
            maxVal={accountMatrix.maxVal}
          />
        </div>
      </div>

      {/* Row 4: Tabela */}
      <div className="pv-panel">
        <div className="pv-table-heading">
          <h3 className="pv-panel-title" style={{margin:0}}>Detalhamento</h3>
          <span className="pv-table-hint">Clique em um produto para ver as issues</span>
        </div>
        <div className="pv-table-wrap">
          <table className="pv-table">
            <thead>
              <tr>
                <th>#</th><th>Produto</th><th>Total</th>
                <th>Andamento</th><th>Aguardando</th><th>Atrasado</th><th>% Atraso</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, i) => (
                <tr key={p.name}
                    className={`pv-table-row-click${activeDrill === p.name ? ' pv-table-row-active' : ''}`}
                    onClick={() => { setDrillProduct(p.name); track('product_drill_click', { product: p.name, total: p.total, overdue: p.overdue }) }}>
                  <td><span className="pv-rank" style={{ background: COLORS[i % COLORS.length] }}>#{i+1}</span></td>
                  <td className="pv-td-name">{p.name}</td>
                  <td className="pv-td-num">{p.total}</td>
                  <td className="pv-td-num" style={{color:'var(--azul-primario)'}}>{p.inProgress}</td>
                  <td className="pv-td-num" style={{color:'var(--amarelo)'}}>{p.waiting}</td>
                  <td className="pv-td-num" style={{color:'var(--rosa)'}}>{p.overdue}</td>
                  <td className="pv-td-num">
                    <span className={`pv-pct ${p.overdue / p.total > 0.3 ? 'pv-pct--high' : ''}`}>
                      {((p.overdue / p.total) * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down */}
      {activeDrill && drillIssues.length > 0 && (
        <DrillPanel
          productName={activeDrill}
          issues={drillIssues}
          jiraBaseUrl={data.jira_base_url}
          onClose={() => setDrillProduct(null)}
        />
      )}

    </div>
  )
}
