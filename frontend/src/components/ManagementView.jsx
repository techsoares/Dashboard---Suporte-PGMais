import { useState, useEffect, useMemo, useCallback } from 'react'
import './ManagementView.css'

import { API_BASE_URL } from '../apiUrl'

// ── Constants ──────────────────────────────────────────────────────────────
const PERIODS = [
  { label: 'Hoje',           period: 'today'    },
  { label: 'Esta semana',    period: 'week'     },
  { label: 'Este mês',       period: 'month'    },
  { label: 'Este trimestre', period: 'quarter'  },
  { label: 'Este semestre',  period: 'semester' },
]

const DEV_COLORS = ['#3DB7F4','#40EB4F','#FE70BD','#F2F24B','#FF8C42','#9B59B6','#E74C3C','#1ABC9C']

const slaColor  = sla  => sla  >= 85 ? 'var(--verde)' : sla  >= 65 ? 'var(--amarelo)' : 'var(--rosa)'
const cycleColor = d   => d    <= 3  ? 'var(--verde)' : d    <= 7  ? 'var(--amarelo)' : 'var(--rosa)'
const fmtDate   = str  => {
  if (!str) return '—'
  const d = str.slice(0, 10).split('-')
  return `${d[2]}/${d[1]}/${d[0]}`
}

// ── WeeklyComparisonChart ──────────────────────────────────────────────────
function WeeklyComparisonChart({ mgmtData }) {
  const allDevs    = mgmtData?.by_dev_weekly ?? []
  const weekLabels = (mgmtData?.weeks ?? []).map(w => w.week_label)
  const n          = weekLabels.length

  const [selected, setSelected] = useState(() => allDevs.slice(0, 4).map(d => d.name))
  const [tooltip,  setTooltip]  = useState(null)

  // Re-sync selection when data changes (period switch)
  useEffect(() => {
    setSelected(allDevs.slice(0, 4).map(d => d.name))
  }, [mgmtData])

  const toggle  = name => setSelected(prev =>
    prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
  )
  const showTip = (e, header, rows) => setTooltip({ x: e.clientX, y: e.clientY, header, rows })
  const hideTip = () => setTooltip(null)

  const filtered = allDevs.filter(d => selected.includes(d.name))
  const counts   = filtered.flatMap(d => d.weekly_counts ?? [])
  const maxVal   = Math.max(...counts, 1)

  if (!n || !allDevs.length) {
    return <div className="mgmt-chart-panel"><p className="mgmt-empty">Sem dados de entregas semanais.</p></div>
  }

  const SVG_WIDTH = 480, SVG_HEIGHT = 110
  const PADDING_LEFT = 28, PADDING_RIGHT = 12, PADDING_TOP = 10, PADDING_BOTTOM = 28
  const chartWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT
  const chartHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const xPos = weekIndex => n > 1 ? PADDING_LEFT + (weekIndex / (n - 1)) * chartWidth : PADDING_LEFT + chartWidth / 2
  const yPos = value => PADDING_TOP + chartHeight - (value / maxVal) * chartHeight

  return (
    <div className="mgmt-chart-panel">
      <div className="mgmt-chart-dev-filter">
        {allDevs.slice(0, 8).map((d, i) => {
          const color  = DEV_COLORS[i % DEV_COLORS.length]
          const active = selected.includes(d.name)
          return (
            <button
              key={d.name}
              className={`mgmt-chart-dev-pill ${active ? 'active' : ''}`}
              style={active ? { borderColor: color, color, background: `${color}18` } : {}}
              onClick={() => toggle(d.name)}
            >
              {d.name.split(' ')[0]}
            </button>
          )
        })}
      </div>

      {filtered.length === 0
        ? <p className="mgmt-empty">Selecione ao menos um responsável.</p>
        : (
          <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="mgmt-line-svg">
            {[0, 0.5, 1].map(gridLevel => (
              <line key={gridLevel} x1={PADDING_LEFT} y1={yPos(maxVal * gridLevel)} x2={PADDING_LEFT + chartWidth} y2={yPos(maxVal * gridLevel)}
                stroke="var(--border)" strokeWidth={0.5} strokeDasharray={gridLevel > 0 ? '4,3' : ''} />
            ))}
            {weekLabels.map((label, weekIdx) => (
              <text key={weekIdx} x={xPos(weekIdx)} y={SVG_HEIGHT - 6} textAnchor="middle" className="mgmt-chart-label">{label}</text>
            ))}
            {filtered.map(dev => {
              const colorIdx = allDevs.findIndex(d => d.name === dev.name)
              const color    = DEV_COLORS[colorIdx % DEV_COLORS.length]
              const pts      = dev.weekly_counts ?? []
              if (n === 1) return (
                <g key={dev.name}>
                  <circle cx={xPos(0)} cy={yPos(pts[0] ?? 0)} r={5} fill={color} opacity={0.9} />
                  <circle cx={xPos(0)} cy={yPos(pts[0] ?? 0)} r={12} fill="transparent" style={{ cursor: 'pointer' }}
                    onMouseEnter={e => showTip(e, dev.name, [`Semana: ${weekLabels[0]}`, `Entregas: ${pts[0] ?? 0}`])}
                    onMouseLeave={hideTip}
                  />
                </g>
              )
              return (
                <g key={dev.name}>
                  <polyline
                    points={pts.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')}
                    fill="none" stroke="transparent" strokeWidth={10} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => showTip(e, dev.name, [`Total: ${pts.reduce((a, b) => a + b, 0)}`])}
                    onMouseLeave={hideTip}
                  />
                  <polyline
                    points={pts.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')}
                    fill="none" stroke={color} strokeWidth={1.8}
                    strokeLinejoin="round" strokeLinecap="round" opacity={0.9}
                  />
                  {pts.map((v, i) => (
                    <g key={i}>
                      <circle cx={xPos(i)} cy={yPos(v)} r={2.5} fill={color} />
                      <circle cx={xPos(i)} cy={yPos(v)} r={10} fill="transparent" style={{ cursor: 'pointer' }}
                        onMouseEnter={e => showTip(e, dev.name, [`Semana: ${weekLabels[i]}`, `Entregas: ${v}`])}
                        onMouseLeave={hideTip}
                      />
                    </g>
                  ))}
                </g>
              )
            })}
          </svg>
        )
      }

      {tooltip && (
        <div className="mgmt-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}>
          <div className="mgmt-tooltip-title">{tooltip.header}</div>
          {tooltip.rows.map((r, i) => <div key={i} className="mgmt-tooltip-row">{r}</div>)}
        </div>
      )}
    </div>
  )
}

// ── DevRadarChart ──────────────────────────────────────────────────────────
const RADAR_AXES = [
  { label: 'Volume',   key: 'volume'    },
  { label: 'Prazo',    key: 'sla'       },
  { label: 'Ciclo',    key: 'inv_cycle' },
  { label: 'Fila',     key: 'inv_bklog' },
  { label: 'Execução', key: 'inv_prog'  },
]
const N_AXES = RADAR_AXES.length

function DevRadarChart({ byDev }) {
  const [selected, setSelected] = useState(() => (byDev ?? []).slice(0, 4).map(d => d.name))
  const [tooltip,  setTooltip]  = useState(null)

  useEffect(() => {
    setSelected((byDev ?? []).slice(0, 4).map(d => d.name))
  }, [byDev])

  if (!byDev?.length) {
    return <div className="mgmt-chart-panel"><p className="mgmt-empty">Sem dados de desenvolvedores.</p></div>
  }

  const toggle  = name => setSelected(prev =>
    prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
  )
  const showTip = (e, dev) => {
    const sla = dev.done_count > 0 ? Math.round(dev.on_time / dev.done_count * 100) : 0
    setTooltip({
      x: e.clientX, y: e.clientY,
      header: dev.name,
      rows: [
        `Entregas: ${dev.done_count}`,
        `SLA: ${sla}%`,
        `Ciclo médio: ${dev.avg_cycle_days > 0 ? dev.avg_cycle_days + 'd' : '—'}`,
        `Fila: ${dev.avg_backlog_days > 0 ? dev.avg_backlog_days + 'd' : '—'}`,
        `Execução: ${dev.avg_in_progress_days > 0 ? dev.avg_in_progress_days + 'd' : '—'}`,
      ],
    })
  }
  const hideTip = () => setTooltip(null)

  const CX = 145, CY = 95, R = 62
  const maxDone    = Math.max(...byDev.map(d => d.done_count), 1)
  const maxCycle   = Math.max(...byDev.map(d => d.avg_cycle_days), 0.1)
  const maxBacklog = Math.max(...byDev.map(d => d.avg_backlog_days), 0.1)
  const maxProg    = Math.max(...byDev.map(d => d.avg_in_progress_days), 0.1)

  const scores = dev => {
    const sla = dev.done_count > 0 ? dev.on_time / dev.done_count : 0
    return [
      dev.done_count / maxDone,
      sla,
      dev.avg_cycle_days   > 0 ? 1 - dev.avg_cycle_days   / maxCycle   : 1,
      dev.avg_backlog_days > 0 ? 1 - dev.avg_backlog_days / maxBacklog : 1,
      dev.avg_in_progress_days > 0 ? 1 - dev.avg_in_progress_days / maxProg : 1,
    ]
  }

  const angle = i => -Math.PI / 2 + (2 * Math.PI * i) / N_AXES
  const pt    = (i, scale) => ({
    x: CX + R * scale * Math.cos(angle(i)),
    y: CY + R * scale * Math.sin(angle(i)),
  })
  const poly  = vals => vals.map((v, i) => { const p = pt(i, Math.max(0, v)); return `${p.x},${p.y}` }).join(' ')

  return (
    <div className="mgmt-chart-panel">
      <div className="mgmt-chart-dev-filter">
        {byDev.slice(0, 8).map((d, i) => {
          const color  = DEV_COLORS[i % DEV_COLORS.length]
          const active = selected.includes(d.name)
          return (
            <button
              key={d.name}
              className={`mgmt-chart-dev-pill ${active ? 'active' : ''}`}
              style={active ? { borderColor: color, color, background: `${color}18` } : {}}
              onClick={() => toggle(d.name)}
            >
              {d.name.split(' ')[0]}
            </button>
          )
        })}
      </div>

      <svg viewBox="0 0 290 196" className="mgmt-radar-svg">
        {[0.25, 0.5, 0.75, 1].map(lvl => (
          <polygon key={lvl}
            points={Array.from({ length: N_AXES }, (_, i) => { const p = pt(i, lvl); return `${p.x},${p.y}` }).join(' ')}
            fill="none" stroke="var(--border)" strokeWidth={lvl === 1 ? 0.8 : 0.4} opacity={lvl === 1 ? 0.9 : 0.4}
          />
        ))}
        {Array.from({ length: N_AXES }, (_, i) => {
          const p = pt(i, 1)
          return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth={0.5} />
        })}
        {Array.from({ length: N_AXES }, (_, i) => {
          const p = pt(i, 1.28)
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              className="mgmt-chart-label" style={{ fontSize: '9px' }}>
              {RADAR_AXES[i].label}
            </text>
          )
        })}
        {byDev.filter(d => selected.includes(d.name)).map(dev => {
          const colorIdx = byDev.findIndex(d => d.name === dev.name)
          const color    = DEV_COLORS[colorIdx % DEV_COLORS.length]
          return (
            <polygon key={dev.name} points={poly(scores(dev))}
              fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1.6} strokeOpacity={0.88}
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => showTip(e, dev)}
              onMouseLeave={hideTip}
            />
          )
        })}
      </svg>

      {tooltip && (
        <div className="mgmt-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}>
          <div className="mgmt-tooltip-title">{tooltip.header}</div>
          {tooltip.rows.map((r, i) => <div key={i} className="mgmt-tooltip-row">{r}</div>)}
        </div>
      )}
    </div>
  )
}

// ── DrillDownTable ─────────────────────────────────────────────────────────
function DrillDownTable({ issues, periodLabel }) {
  const [expanded, setExpanded] = useState(false)
  const [search,   setSearch]   = useState('')
  const PAGE = 20

  const filtered = useMemo(() => {
    if (!search.trim()) return issues ?? []
    const searchTerm = search.trim().toLowerCase()
    return (issues ?? []).filter(issue =>
      issue.key?.toLowerCase().includes(searchTerm) ||
      issue.summary?.toLowerCase().includes(searchTerm) ||
      issue.assignee?.display_name?.toLowerCase().includes(searchTerm) ||
      issue.product?.toLowerCase().includes(searchTerm)
    )
  }, [issues, search])

  const visible = expanded ? filtered : filtered.slice(0, PAGE)

  const wasOnTime = issue => {
    if (!issue.due_date || !issue.resolved_date) return true
    return issue.resolved_date.slice(0, 10) <= issue.due_date
  }

  return (
    <div className="mgmt-card">
      <div className="mgmt-drill-header-row">
        <div className="mgmt-card-title">Entregas — {periodLabel}</div>
        {(issues?.length ?? 0) > 0 && (
          <span className="mgmt-drill-total">{issues.length} entregues</span>
        )}
      </div>

      {(issues?.length ?? 0) === 0 ? (
        <p className="mgmt-empty">Nenhuma entrega registrada no período.</p>
      ) : (
        <>
          {issues.length > 5 && (
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar por chave, título, responsável ou produto..."
              style={{
                background: 'var(--surface-alt)', border: '1px solid var(--border-strong)',
                borderRadius: '7px', padding: '6px 12px', fontSize: '0.82rem',
                color: 'var(--text)', fontFamily: 'Lato, sans-serif', outline: 'none',
                width: '100%', boxSizing: 'border-box',
              }}
            />
          )}

          {filtered.length === 0 ? (
            <p className="mgmt-empty">Nenhuma entrega corresponde ao filtro.</p>
          ) : (
            <>
              <div className="mgmt-drill-table">
                <div className="mgmt-drill-cols mgmt-drill-cols--header">
                  <span>Chave</span>
                  <span className="mgmt-drill-col-summary">Título</span>
                  <span>Tipo</span>
                  <span>Responsável</span>
                  <span>Produto</span>
                  <span>Entregue em</span>
                  <span>SLA</span>
                </div>
                {visible.map(issue => (
                  <a
                    key={issue.key}
                    href={issue.jira_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mgmt-drill-cols mgmt-drill-cols--row"
                  >
                    <span className="mgmt-drill-key">{issue.key}</span>
                    <span className="mgmt-drill-col-summary mgmt-drill-summary">{issue.summary}</span>
                    <span className="mgmt-drill-type">{issue.issue_type?.name ?? '—'}</span>
                    <span className="mgmt-drill-who">{issue.assignee?.display_name ?? '—'}</span>
                    <span className="mgmt-drill-product">{issue.product ?? '—'}</span>
                    <span className="mgmt-drill-date">{fmtDate(issue.resolved_date)}</span>
                    <span className={`mgmt-drill-sla ${wasOnTime(issue) ? 'ok' : 'late'}`}>
                      {wasOnTime(issue) ? '✓ Prazo' : '✗ Atraso'}
                    </span>
                  </a>
                ))}
              </div>
              {filtered.length > PAGE && (
                <button className="mgmt-drill-more" onClick={() => setExpanded(v => !v)}>
                  {expanded ? 'Ver menos' : `Ver mais ${filtered.length - PAGE} entregas`}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function ManagementView({ data, filters }) {
  const [period,   setPeriod]   = useState(PERIODS[2])   // default: Este mês
  const [mgmtData, setMgmtData] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // ── Fetch management data whenever period changes ───────────────────────
  const fetchMgmt = useCallback((periodKey, signal) => {
    setLoading(true)
    setError('')
    setMgmtData(null)

    fetch(`${API_BASE_URL}/api/management?period=${periodKey}`, { signal, headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } })
      .then(res => {
        if (!res.ok) return res.json().then(j => Promise.reject(j.detail ?? `HTTP ${res.status}`))
        return res.json()
      })
      .then(d => {
        setMgmtData(d)
        setLoading(false)
      })
      .catch(err => {
        if (err?.name === 'AbortError') return
        setError(typeof err === 'string' ? err : 'Não foi possível carregar os dados históricos.')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchMgmt(period.period, controller.signal)
    return () => controller.abort()
  }, [period.period, fetchMgmt])

  // ── Risk items: from live dashboard data ────────────────────────────────
  const riskItems = useMemo(() => {
    const overdue = (data?.backlog ?? [])
      .filter(issue => issue.is_overdue)
      .sort((issueA, issueB) => (issueA.due_date ?? '') < (issueB.due_date ?? '') ? -1 : 1)
      .slice(0, 8)
    const stale = (data?.stale_issues ?? []).slice(0, 6)
    return { overdue, stale }
  }, [data])

  // ── Trend: last week vs previous ────────────────────────────────────────
  const trend = useMemo(() => {
    const weeks = mgmtData?.weeks ?? []
    if (weeks.length < 2) return null
    const last = weeks[weeks.length - 1]
    const prev = weeks[weeks.length - 2]
    return { diff: last.done_count - prev.done_count }
  }, [mgmtData])

  // ── Apply global filters to done_issues (client-side) ───────────────────
  const filteredDoneIssues = useMemo(() => {
    const issues = mgmtData?.done_issues ?? []
    if (!filters) return issues
    let result = issues
    if (filters.assignee?.length)    result = result.filter(issue => filters.assignee.includes(issue.assignee?.display_name))
    if (filters.account?.length)     result = result.filter(issue => filters.account.includes(issue.account))
    if (filters.product?.length)     result = result.filter(issue => filters.product.includes(issue.product))
    if (filters.issue_type?.length)  result = result.filter(issue => filters.issue_type.includes(issue.issue_type?.name))
    if (filters.status?.length)      result = result.filter(issue => filters.status.includes(issue.status?.name))
    return result
  }, [mgmtData, filters])

  const hasActiveFilters = filters && Object.values(filters).some(v => v.length > 0)

  const maxProd = mgmtData?.by_product?.[0]?.done_count ?? 1

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mgmt-root">

      {/* Header */}
      <div className="mgmt-header">
        <div>
          <h2 className="mgmt-title">Gestão Executiva</h2>
          <p className="mgmt-subtitle">Visão histórica de entregas, SLA e capacity do time</p>
        </div>
        <div className="mgmt-period-picker">
          {PERIODS.map(p => (
            <button
              key={p.period}
              className={`mgmt-period-btn ${period.period === p.period ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mgmt-loading">
          <div className="spinner" />
          <span>Carregando histórico do Jira...</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <div className="mgmt-error">{error}</div>
          <button
            onClick={() => fetchMgmt(period.period, new AbortController().signal)}
            style={{
              alignSelf: 'flex-start', padding: '6px 18px',
              background: 'var(--azul-primario)', color: '#fff',
              border: 'none', borderRadius: '8px',
              fontFamily: 'Lato, sans-serif', fontSize: '0.85rem',
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Data — only shown after successful load */}
      {!loading && mgmtData && (
        <>
          {/* KPIs */}
          <div className="mgmt-kpi-row">
            <div className="mgmt-kpi-card">
              <span className="mgmt-kpi-label">Entregues — {period.label}</span>
              <span className="mgmt-kpi-value">{mgmtData.total_done}</span>
              {trend && (
                <span className={`mgmt-kpi-trend ${trend.diff >= 0 ? 'up' : 'down'}`}>
                  {trend.diff >= 0 ? '↑' : '↓'} {Math.abs(trend.diff)} vs semana anterior
                </span>
              )}
            </div>

            <div className="mgmt-kpi-card">
              <span className="mgmt-kpi-label">Taxa SLA</span>
              <span className="mgmt-kpi-value" style={{ color: slaColor(mgmtData.sla_rate) }}>
                {mgmtData.sla_rate}%
              </span>
              <span className="mgmt-kpi-sub">
                {mgmtData.sla_rate >= 85 ? 'Excelente' : mgmtData.sla_rate >= 65 ? 'Atenção' : 'Crítico — revisar SLAs'}
              </span>
            </div>

            <div className="mgmt-kpi-card">
              <span className="mgmt-kpi-label">Ciclo Médio</span>
              <span className="mgmt-kpi-value" style={{ color: cycleColor(mgmtData.avg_cycle_days) }}>
                {mgmtData.avg_cycle_days}d
              </span>
              <span className="mgmt-kpi-sub">criação → entrega</span>
            </div>

            <div className="mgmt-kpi-card mgmt-kpi-card--risk">
              <span className="mgmt-kpi-label">Volume em Risco</span>
              <span className="mgmt-kpi-value" style={{ color: 'var(--rosa)' }}>
                {riskItems.overdue.length + riskItems.stale.length}
              </span>
              <span className="mgmt-kpi-sub">
                {riskItems.overdue.length} atrasados · {riskItems.stale.length} paralisados
              </span>
            </div>
          </div>

          {/* Filtros ativos */}
          {hasActiveFilters && (
            <div className="mgmt-filter-banner">
              <span className="mgmt-filter-banner-icon">⚡</span>
              Filtros ativos — exibindo {filteredDoneIssues.length} de {mgmtData.total_done} entregas. Os gráficos e KPIs acima refletem o período completo.
            </div>
          )}

          {/* Drill-down */}
          <DrillDownTable issues={filteredDoneIssues} periodLabel={period.label} />

          {/* Gráficos semanais */}
          <div className="mgmt-row-2">
            <div className="mgmt-card">
              <div className="mgmt-card-title">Entregas por Semana — por Responsável</div>
              <WeeklyComparisonChart mgmtData={mgmtData} />
            </div>
            <div className="mgmt-card">
              <div className="mgmt-card-title">Radar de Desempenho — por Responsável</div>
              <DevRadarChart byDev={mgmtData.by_dev ?? []} />
            </div>
          </div>

          {/* Análise de processo */}
          <div className="mgmt-row-process">
            <div className="mgmt-card">
              <div className="mgmt-card-title">Gargalo de Processo — Time</div>
              <div className="mgmt-bottleneck-row">
                {[
                  { label: 'Fila / Backlog', days: mgmtData.team_avg_backlog_days,      color: 'var(--text-muted)'  },
                  { label: 'Aguardando',     days: mgmtData.team_avg_waiting_days,      color: 'var(--amarelo)'    },
                  { label: 'Em andamento',   days: mgmtData.team_avg_in_progress_days,  color: 'var(--azul-claro)' },
                ].map(({ label, days, color }) => {
                  const maxDays = Math.max(
                    mgmtData.team_avg_backlog_days,
                    mgmtData.team_avg_waiting_days,
                    mgmtData.team_avg_in_progress_days,
                    0.1,
                  )
                  const isBottleneck = days === maxDays && days > 0
                  return (
                    <div key={label} className={`mgmt-bottleneck-card ${isBottleneck ? 'mgmt-bottleneck-card--highlight' : ''}`}>
                      <span className="mgmt-bottleneck-label">{label}</span>
                      <span className="mgmt-bottleneck-value" style={{ color: isBottleneck ? 'var(--rosa)' : color }}>
                        {days > 0 ? `${days}d` : '—'}
                      </span>
                      {isBottleneck && days > 0 && <span className="mgmt-bottleneck-badge">⚠ Gargalo</span>}
                      <div className="mgmt-bottleneck-bar-wrap">
                        <div
                          className="mgmt-bottleneck-bar"
                          style={{ width: `${(days / maxDays) * 100}%`, background: isBottleneck ? 'var(--rosa)' : color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mgmt-card">
              <div className="mgmt-card-title">Mix de Jiras Concluídos</div>
              <div className="mgmt-type-list">
                {(mgmtData.by_type ?? []).map(t => {
                  const maxType = mgmtData.by_type?.[0]?.count ?? 1
                  const sla     = t.count > 0 ? Math.round(t.on_time / t.count * 100) : 0
                  return (
                    <div key={t.type_name} className="mgmt-type-row">
                      <span className="mgmt-type-name">{t.type_name}</span>
                      <div className="mgmt-type-bar-wrap">
                        <div className="mgmt-type-bar" style={{ width: `${(t.count / maxType) * 100}%` }} />
                      </div>
                      <span className="mgmt-type-count">{t.count}</span>
                      <span className="mgmt-type-sla" style={{ color: slaColor(sla) }}>{sla}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Tempo por fase por dev */}
          {(mgmtData.by_dev?.length ?? 0) > 0 && (
            <div className="mgmt-card">
              <div className="mgmt-card-title">Tempo Médio por Fase — Por Pessoa</div>
              <div className="mgmt-phase-table">
                <div className="mgmt-phase-header">
                  <span className="mgmt-phase-col-name">Desenvolvedor</span>
                  <span className="mgmt-phase-col-label">Fila</span>
                  <span className="mgmt-phase-col-label">Aguardando</span>
                  <span className="mgmt-phase-col-label">Em andamento</span>
                  <span className="mgmt-phase-col-label">Ciclo total</span>
                  <span className="mgmt-phase-col-label">SLA</span>
                </div>
                {mgmtData.by_dev.slice(0, 12).map(d => {
                  const sla    = d.done_count > 0 ? Math.round(d.on_time / d.done_count * 100) : 0
                  const phases = [d.avg_backlog_days, d.avg_waiting_days, d.avg_in_progress_days]
                  const maxP   = Math.max(...phases, 0.1)
                  const botIdx = phases.indexOf(Math.max(...phases))
                  return (
                    <div key={d.name} className="mgmt-phase-row">
                      <span className="mgmt-phase-col-name mgmt-phase-dev-name">{d.name}</span>
                      {phases.map((v, i) => (
                        <div key={i} className="mgmt-phase-col-bar">
                          <span className="mgmt-phase-days"
                            style={{ color: i === botIdx && v > 0 ? 'var(--rosa)' : 'var(--text)' }}>
                            {v > 0 ? `${v}d` : '—'}
                          </span>
                          <div className="mgmt-phase-mini-bar-wrap">
                            <div className="mgmt-phase-mini-bar" style={{
                              width: `${(v / maxP) * 100}%`,
                              background: ['var(--surface-alt)','var(--amarelo)','var(--azul-claro)'][i],
                              opacity: i === botIdx && v > 0 ? 1 : 0.55,
                            }} />
                          </div>
                        </div>
                      ))}
                      <span className="mgmt-phase-cycle" style={{ color: cycleColor(d.avg_cycle_days) }}>
                        {d.avg_cycle_days > 0 ? `${d.avg_cycle_days}d` : '—'}
                      </span>
                      <span className="mgmt-phase-sla" style={{ color: slaColor(sla) }}>{sla}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Produtos + Risco */}
          <div className="mgmt-row-3">
            <div className="mgmt-card">
              <div className="mgmt-card-title">Entregas por Produto</div>
              <div className="mgmt-prod-list">
                {(mgmtData.by_product ?? []).slice(0, 8).map(p => {
                  const sla = p.done_count > 0 ? Math.round(p.on_time / p.done_count * 100) : 0
                  return (
                    <div key={p.product} className="mgmt-prod-row">
                      <span className="mgmt-prod-name">{p.product}</span>
                      <div className="mgmt-prod-bar-wrap">
                        <div className="mgmt-prod-bar" style={{ width: `${(p.done_count / maxProd) * 100}%` }} />
                      </div>
                      <div className="mgmt-prod-stats">
                        <span className="mgmt-prod-count">{p.done_count}</span>
                        <span className="mgmt-prod-sla" style={{ color: slaColor(sla) }}>{sla}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mgmt-card mgmt-card--risk">
              <div className="mgmt-card-title">Radar de Risco Atual</div>
              {riskItems.overdue.length > 0 && (
                <div className="mgmt-risk-section">
                  <span className="mgmt-risk-label">Atrasados ({riskItems.overdue.length})</span>
                  {riskItems.overdue.map(i => (
                    <a key={i.key} href={i.jira_url} target="_blank" rel="noopener noreferrer"
                      className="mgmt-risk-item mgmt-risk-item--overdue">
                      <span className="mgmt-risk-key">{i.key}</span>
                      <span className="mgmt-risk-summary">{i.summary}</span>
                      <span className="mgmt-risk-who">{i.assignee?.display_name ?? '—'}</span>
                    </a>
                  ))}
                </div>
              )}
              {riskItems.stale.length > 0 && (
                <div className="mgmt-risk-section">
                  <span className="mgmt-risk-label">Paralisados +30 dias ({riskItems.stale.length})</span>
                  {riskItems.stale.map(i => (
                    <a key={i.key} href={i.jira_url} target="_blank" rel="noopener noreferrer"
                      className="mgmt-risk-item mgmt-risk-item--stale">
                      <span className="mgmt-risk-key">{i.key}</span>
                      <span className="mgmt-risk-summary">{i.summary}</span>
                      <span className="mgmt-risk-who">{i.assignee?.display_name ?? '—'}</span>
                    </a>
                  ))}
                </div>
              )}
              {riskItems.overdue.length === 0 && riskItems.stale.length === 0 && (
                <p className="mgmt-empty" style={{ color: 'var(--verde)' }}>
                  Nenhum item em risco crítico. Backlog saudável.
                </p>
              )}
            </div>
          </div>

          {/* AI Chat removido — assistente IA flutuante já disponível em todas as telas */}
        </>
      )}
    </div>
  )
}
