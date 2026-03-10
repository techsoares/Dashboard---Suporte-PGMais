import { useState, useEffect, useMemo, useRef } from 'react'
import './ManagementView.css'

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:8000'
  const host = window.location.host.replace(':5173', ':8000').replace('-5173.', '-8000.')
  return `${window.location.protocol}//${host}`
}
const API = getApiUrl()

const DEV_COLORS = ['#3DB7F4', '#40EB4F', '#FE70BD', '#F2F24B', '#FF8C42', '#9B59B6', '#E74C3C', '#1ABC9C']

// ── Gráfico de linhas: entregas por semana por responsável ───────────────────
function WeeklyComparisonChart({ mgmtData }) {
  const allDevs    = mgmtData.by_dev_weekly || []
  const weekLabels = (mgmtData.weeks || []).map(w => w.week_label)
  const n          = weekLabels.length

  const [selected, setSelected] = useState(() => allDevs.slice(0, 4).map(d => d.name))
  const [tooltip,  setTooltip]  = useState(null)

  const toggle   = name => setSelected(prev =>
    prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
  )
  const showTip  = (e, header, rows) => setTooltip({ x: e.clientX, y: e.clientY, header, rows })
  const hideTip  = () => setTooltip(null)

  const filtered = allDevs.filter(d => selected.includes(d.name))
  const maxVal   = Math.max(...filtered.flatMap(d => d.weekly_counts || []), 1)

  const W = 480, H = 110
  const pL = 28, pR = 12, pT = 10, pB = 28
  const cW = W - pL - pR, cH = H - pT - pB

  const xPos = i => n > 1 ? pL + (i / (n - 1)) * cW : pL + cW / 2
  const yPos = v => pT + cH - (v / maxVal) * cH

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
        ? <p className="mgmt-empty">Selecione ao menos um responsável</p>
        : (
          <svg viewBox={`0 0 ${W} ${H}`} className="mgmt-line-svg">
            {[0, 0.5, 1].map(t => (
              <line key={t} x1={pL} y1={yPos(maxVal * t)} x2={pL + cW} y2={yPos(maxVal * t)}
                stroke="var(--border)" strokeWidth={0.5} strokeDasharray={t > 0 ? '4,3' : ''} />
            ))}
            {weekLabels.map((_, i) => (
              <line key={i} x1={xPos(i)} y1={pT} x2={xPos(i)} y2={pT + cH}
                stroke="var(--border)" strokeWidth={0.3} />
            ))}
            {weekLabels.map((lbl, i) => (
              <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" className="mgmt-chart-label">{lbl}</text>
            ))}
            {filtered.map(dev => {
              const colorIdx = allDevs.findIndex(d => d.name === dev.name)
              const color    = DEV_COLORS[colorIdx % DEV_COLORS.length]
              const counts   = dev.weekly_counts || []
              if (n === 1) return (
                <g key={dev.name}>
                  <circle cx={xPos(0)} cy={yPos(counts[0] || 0)} r={5} fill={color} opacity={0.9} />
                  <circle cx={xPos(0)} cy={yPos(counts[0] || 0)} r={12} fill="transparent" style={{ cursor: 'pointer' }}
                    onMouseEnter={e => showTip(e, dev.name, [`Semana: ${weekLabels[0]}`, `Entregas: ${counts[0] || 0}`])}
                    onMouseLeave={hideTip}
                  />
                </g>
              )
              return (
                <g key={dev.name}>
                  {/* linha invisível para hover na linha toda */}
                  <polyline
                    points={counts.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')}
                    fill="none" stroke="transparent" strokeWidth={10} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => showTip(e, dev.name, [`Total no período: ${counts.reduce((a, b) => a + b, 0)}`])}
                    onMouseLeave={hideTip}
                  />
                  <polyline
                    points={counts.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')}
                    fill="none" stroke={color} strokeWidth={1.8}
                    strokeLinejoin="round" strokeLinecap="round" opacity={0.9}
                  />
                  {counts.map((v, i) => (
                    <g key={i}>
                      <circle cx={xPos(i)} cy={yPos(v)} r={2.5} fill={color} />
                      {/* hit area maior para o tooltip por ponto */}
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

// ── Radar de desempenho por responsável ─────────────────────────────────────
const RADAR_AXES = [
  { label: 'Volume',       key: 'volume'    },
  { label: 'Prazo',        key: 'sla'       },
  { label: 'Ciclo',        key: 'inv_cycle' },
  { label: 'Fila',         key: 'inv_bklog' },
  { label: 'Execução',     key: 'inv_prog'  },
]
const N_AXES = RADAR_AXES.length

function DevRadarChart({ byDev }) {
  const [selected, setSelected] = useState(() => byDev.slice(0, 4).map(d => d.name))
  const [tooltip,  setTooltip]  = useState(null)

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
        `SLA (prazo): ${sla}%`,
        `Ciclo médio: ${dev.avg_cycle_days > 0 ? dev.avg_cycle_days + 'd' : '—'}`,
        `Tempo em fila: ${dev.avg_backlog_days > 0 ? dev.avg_backlog_days + 'd' : '—'}`,
        `Tempo em execução: ${dev.avg_in_progress_days > 0 ? dev.avg_in_progress_days + 'd' : '—'}`,
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

// ── AI Chat dentro do ManagementView ──────────────────────────────────────
function MgmtAIChat({ mgmtData, dashData }) {
  const [question, setQuestion] = useState('')
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const chatEndRef = useRef(null)
  const inputRef   = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  const buildMgmtContext = () => {
    if (!mgmtData) return ''
    const lines = [
      `=== HISTÓRICO DE ENTREGAS (últimas ${mgmtData.period_weeks} semanas) ===`,
      `Total entregues: ${mgmtData.total_done}`,
      `Taxa SLA (no prazo): ${mgmtData.sla_rate}%`,
      `Ciclo médio: ${mgmtData.avg_cycle_days} dias`,
      '',
      '--- ENTREGAS POR SEMANA ---',
    ]
    for (const w of mgmtData.weeks) {
      lines.push(`${w.week_label}: ${w.done_count} entregues (${w.on_time} no prazo, ${w.late} com atraso, ciclo médio ${w.avg_cycle_days}d)`)
    }
    lines.push('', '--- TOP ENTREGADORES ---')
    for (const d of mgmtData.by_dev) {
      lines.push(`${d.name}: ${d.done_count} entregues, ${d.on_time} no prazo, ciclo médio ${d.avg_cycle_days}d`)
    }
    lines.push('', '--- ENTREGAS POR PRODUTO ---')
    for (const p of mgmtData.by_product) {
      lines.push(`${p.product}: ${p.done_count} entregues, ${p.on_time} no prazo`)
    }
    if (dashData) {
      const active = dashData.backlog || []
      lines.push('', '--- BACKLOG ATIVO ATUAL ---',
        `Total ativo: ${active.length}`,
        `Atrasados: ${active.filter(i => i.is_overdue).length}`,
        `Paralisados: ${(dashData.stale_issues || []).length}`,
      )
    }
    return lines.join('\n')
  }

  const askAI = async (q) => {
    const text = (q ?? question).trim()
    if (!text || loading) return
    setError('')
    setLoading(true)

    const recentHistory = history.slice(-3).map(h =>
      `Pergunta anterior: ${h.question}\nResposta anterior: ${h.answer}`
    ).join('\n\n')

    const ctx = buildMgmtContext() + (recentHistory ? `\n\n--- HISTÓRICO DA CONVERSA ---\n${recentHistory}` : '')

    try {
      const res = await fetch(`${API}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, context: ctx }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.detail || 'Erro ao consultar a IA.')
      } else {
        setHistory(prev => [...prev, { question: text, answer: json.answer }])
        setQuestion('')
        inputRef.current?.focus()
      }
    } catch {
      setError('Não foi possível conectar ao servidor.')
    } finally {
      setLoading(false)
    }
  }

  const SUGGESTIONS = [
    'Como está a tendência de entregas nas últimas semanas?',
    'Nossa taxa SLA está boa? O que está puxando para baixo?',
    'Quem está entregando mais e quem precisa de atenção?',
    'O ciclo médio de entrega está melhorando ou piorando?',
    'Quais produtos têm mais atrasos históricos?',
  ]

  return (
    <div className="mgmt-ai-panel">
      <div className="mgmt-ai-header">
        <span className="mgmt-ai-title">IA com visão histórica</span>
        <span className="mgmt-ai-badge">✦ Claude Sonnet 4.6</span>
      </div>

      {(history.length > 0 || loading) && (
        <div className="mgmt-ai-history">
          {history.map((item, idx) => (
            <div key={idx} className="mgmt-ai-exchange">
              <div className="mgmt-ai-bubble mgmt-ai-bubble--user">
                <span className="mgmt-ai-who">Você</span>
                {item.question}
              </div>
              <div className="mgmt-ai-bubble mgmt-ai-bubble--ai">
                <span className="mgmt-ai-who">✦ IA</span>
                <span className="mgmt-ai-answer">
                  {item.answer.split('\n').map((line, i) =>
                    line.trim() === ''
                      ? <br key={i} />
                      : <span key={i} style={{ display: 'block', lineHeight: '1.6' }}>{line}</span>
                  )}
                </span>
              </div>
            </div>
          ))}
          {loading && (
            <div className="mgmt-ai-exchange">
              <div className="mgmt-ai-bubble mgmt-ai-bubble--user">
                <span className="mgmt-ai-who">Você</span>
                {question}
              </div>
              <div className="mgmt-ai-bubble mgmt-ai-bubble--ai">
                <span className="mgmt-ai-who">✦ IA</span>
                <span className="ai-dots"><span /><span /><span /></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      <div className="mgmt-ai-input-row">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askAI()}
          placeholder="Pergunte sobre o histórico de entregas, tendências, SLA..."
          disabled={loading}
        />
        <button
          className="mgmt-ai-send-btn"
          onClick={() => askAI()}
          disabled={loading || !question.trim()}
        >
          {loading ? <span className="ai-send-spinner" /> : 'Enviar'}
        </button>
      </div>

      {error && <div className="mgmt-ai-error">⚠ {error}</div>}

      {history.length === 0 && !loading && (
        <div className="mgmt-ai-suggestions">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => { setQuestion(s); askAI(s) }}>{s}</button>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <button className="mgmt-ai-clear" onClick={() => { setHistory([]); setError('') }}>
          ↺ Nova conversa
        </button>
      )}
    </div>
  )
}

const PERIODS = [
  { label: 'Hoje',           period: 'today'    },
  { label: 'Esta semana',    period: 'week'     },
  { label: 'Este mês',       period: 'month'    },
  { label: 'Este trimestre', period: 'quarter'  },
  { label: 'Este semestre',  period: 'semester' },
]

// ── Tabela de drill-down das entregas ─────────────────────────────────────
function DrillDownTable({ issues, periodLabel }) {
  const [expanded, setExpanded] = useState(false)
  const PAGE = 20
  const visible = expanded ? issues : issues.slice(0, PAGE)

  const wasOnTime = issue => {
    if (!issue.due_date) return true
    if (!issue.resolved_date) return true
    return issue.resolved_date.slice(0, 10) <= issue.due_date
  }

  const fmtDate = str => {
    if (!str) return '—'
    const d = str.slice(0, 10).split('-')
    return `${d[2]}/${d[1]}/${d[0]}`
  }

  if (!issues || issues.length === 0) {
    return (
      <div className="mgmt-card">
        <div className="mgmt-card-title">Entregas — {periodLabel}</div>
        <p className="mgmt-empty">Nenhuma entrega registrada no período.</p>
      </div>
    )
  }

  return (
    <div className="mgmt-card">
      <div className="mgmt-drill-header-row">
        <div className="mgmt-card-title">Entregas — {periodLabel}</div>
        <span className="mgmt-drill-total">{issues.length} entregues</span>
      </div>
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
            rel="noreferrer"
            className="mgmt-drill-cols mgmt-drill-cols--row"
          >
            <span className="mgmt-drill-key">{issue.key}</span>
            <span className="mgmt-drill-col-summary mgmt-drill-summary">{issue.summary}</span>
            <span className="mgmt-drill-type">{issue.issue_type?.name || '—'}</span>
            <span className="mgmt-drill-who">{issue.assignee?.display_name || '—'}</span>
            <span className="mgmt-drill-product">{issue.product || '—'}</span>
            <span className="mgmt-drill-date">{fmtDate(issue.resolved_date)}</span>
            <span className={`mgmt-drill-sla ${wasOnTime(issue) ? 'ok' : 'late'}`}>
              {wasOnTime(issue) ? '✓ Prazo' : '✗ Atraso'}
            </span>
          </a>
        ))}
      </div>
      {issues.length > PAGE && (
        <button className="mgmt-drill-more" onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Ver menos' : `Ver mais ${issues.length - PAGE} entregas`}
        </button>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function ManagementView({ data }) {
  const [period,   setPeriod]   = useState(PERIODS[2])  // default: Este mês

  const [mgmtData, setMgmtData] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`${API}/api/management?period=${period.period}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setMgmtData(d); setLoading(false) })
      .catch(() => { setError('Erro ao carregar dados históricos.'); setLoading(false) })
  }, [period.period])

  // Derivados do dashboard atual (backlog)
  const riskItems = useMemo(() => {
    if (!data) return { overdue: [], stale: [] }
    const overdue = (data.backlog || [])
      .filter(i => i.is_overdue)
      .sort((a, b) => (a.due_date || '') < (b.due_date || '') ? -1 : 1)
      .slice(0, 8)
    const stale = (data.stale_issues || []).slice(0, 6)
    return { overdue, stale }
  }, [data])

  // Trend: última semana vs penúltima
  const trend = useMemo(() => {
    if (!mgmtData?.weeks || mgmtData.weeks.length < 2) return null
    const last = mgmtData.weeks[mgmtData.weeks.length - 1]
    const prev = mgmtData.weeks[mgmtData.weeks.length - 2]
    return { diff: last.done_count - prev.done_count, last: last.done_count, prev: prev.done_count }
  }, [mgmtData])

  const slaColor = sla =>
    sla >= 85 ? 'var(--verde)' : sla >= 65 ? 'var(--amarelo)' : 'var(--rosa)'

  const cycleColor = days =>
    days <= 3 ? 'var(--verde)' : days <= 7 ? 'var(--amarelo)' : 'var(--rosa)'

  const maxProd = mgmtData?.by_product?.[0]?.done_count || 1

  return (
    <div className="mgmt-root">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="mgmt-header">
        <div>
          <h2 className="mgmt-title">Gestão Executiva</h2>
          <p className="mgmt-subtitle">Visão histórica de entregas, SLA e capacity do time</p>
        </div>
        <div className="mgmt-period-picker">
          {PERIODS.map(p => (
            <button
              key={p.label}
              className={`mgmt-period-btn ${period.label === p.label ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="mgmt-loading">
          <div className="spinner" />
          <span>Carregando histórico do Jira...</span>
        </div>
      )}

      {error && <div className="mgmt-error">{error}</div>}

      {!loading && mgmtData && (
        <>
          {/* ── KPI ROW ─────────────────────────────────────────── */}
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

          {/* ── DRILL-DOWN DE ENTREGAS ──────────────────────────── */}
          <DrillDownTable issues={mgmtData.done_issues || []} periodLabel={period.label} />

          {/* ── COMPARATIVO SEMANAL + RADAR ─────────────────────── */}
          <div className="mgmt-row-2">
            <div className="mgmt-card">
              <div className="mgmt-card-title">Entregas por Semana — por Responsável</div>
              <WeeklyComparisonChart key={period.period} mgmtData={mgmtData} />
            </div>
            <div className="mgmt-card">
              <div className="mgmt-card-title">Radar de Desempenho — por Responsável</div>
              <DevRadarChart key={period.period} byDev={mgmtData.by_dev} />
            </div>
          </div>

          {/* ── ANÁLISE DE PROCESSO ─────────────────────────────── */}
          <div className="mgmt-row-process">
            {/* Gargalo do time */}
            <div className="mgmt-card">
              <div className="mgmt-card-title">Gargalo de Processo — Time</div>
              <div className="mgmt-bottleneck-row">
                {[
                  { label: 'Fila / Backlog', days: mgmtData.team_avg_backlog_days, color: 'var(--text-muted)' },
                  { label: 'Aguardando', days: mgmtData.team_avg_waiting_days, color: 'var(--amarelo)' },
                  { label: 'Em andamento', days: mgmtData.team_avg_in_progress_days, color: 'var(--azul-claro)' },
                ].map(({ label, days, color }) => {
                  const maxDays = Math.max(
                    mgmtData.team_avg_backlog_days,
                    mgmtData.team_avg_waiting_days,
                    mgmtData.team_avg_in_progress_days,
                    0.1
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
                          style={{
                            width: `${(days / maxDays) * 100}%`,
                            background: isBottleneck ? 'var(--rosa)' : color,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mix por tipo */}
            <div className="mgmt-card">
              <div className="mgmt-card-title">Mix de Jiras Concluídos</div>
              <div className="mgmt-type-list">
                {mgmtData.by_type.map(t => {
                  const maxType = mgmtData.by_type[0]?.count || 1
                  const sla = t.count > 0 ? Math.round(t.on_time / t.count * 100) : 0
                  return (
                    <div key={t.type_name} className="mgmt-type-row">
                      <span className="mgmt-type-name">{t.type_name}</span>
                      <div className="mgmt-type-bar-wrap">
                        <div
                          className="mgmt-type-bar"
                          style={{ width: `${(t.count / maxType) * 100}%` }}
                        />
                      </div>
                      <span className="mgmt-type-count">{t.count}</span>
                      <span
                        className="mgmt-type-sla"
                        style={{ color: slaColor(sla) }}
                      >{sla}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── TEMPO POR STATUS POR DEV ─────────────────────────── */}
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
                const sla = d.done_count > 0 ? Math.round(d.on_time / d.done_count * 100) : 0
                const phases = [d.avg_backlog_days, d.avg_waiting_days, d.avg_in_progress_days]
                const maxPhase = Math.max(...phases, 0.1)
                const bottleneckIdx = phases.indexOf(maxPhase)
                return (
                  <div key={d.name} className="mgmt-phase-row">
                    <span className="mgmt-phase-col-name mgmt-phase-dev-name">{d.name}</span>
                    {phases.map((v, i) => (
                      <div key={i} className="mgmt-phase-col-bar">
                        <span
                          className="mgmt-phase-days"
                          style={{ color: i === bottleneckIdx && v > 0 ? 'var(--rosa)' : 'var(--text)' }}
                        >
                          {v > 0 ? `${v}d` : '—'}
                        </span>
                        <div className="mgmt-phase-mini-bar-wrap">
                          <div
                            className="mgmt-phase-mini-bar"
                            style={{
                              width: `${(v / maxPhase) * 100}%`,
                              background: ['var(--surface-alt)', 'var(--amarelo)', 'var(--azul-claro)'][i],
                              opacity: i === bottleneckIdx && v > 0 ? 1 : 0.55,
                            }}
                          />
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

          {/* ── PRODUTOS + RISCO ────────────────────────────────── */}
          <div className="mgmt-row-3">
            <div className="mgmt-card">
              <div className="mgmt-card-title">Entregas por Produto</div>
              <div className="mgmt-prod-list">
                {mgmtData.by_product.slice(0, 8).map(p => (
                  <div key={p.product} className="mgmt-prod-row">
                    <span className="mgmt-prod-name">{p.product}</span>
                    <div className="mgmt-prod-bar-wrap">
                      <div
                        className="mgmt-prod-bar"
                        style={{ width: `${(p.done_count / maxProd) * 100}%` }}
                      />
                    </div>
                    <div className="mgmt-prod-stats">
                      <span className="mgmt-prod-count">{p.done_count}</span>
                      <span
                        className="mgmt-prod-sla"
                        style={{ color: slaColor(p.done_count > 0 ? p.on_time / p.done_count * 100 : 0) }}
                      >
                        {p.done_count > 0 ? Math.round(p.on_time / p.done_count * 100) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mgmt-card mgmt-card--risk">
              <div className="mgmt-card-title">Radar de Risco Atual</div>

              {riskItems.overdue.length > 0 && (
                <div className="mgmt-risk-section">
                  <span className="mgmt-risk-label">Atrasados ({riskItems.overdue.length})</span>
                  {riskItems.overdue.map(i => (
                    <a
                      key={i.key}
                      href={i.jira_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mgmt-risk-item mgmt-risk-item--overdue"
                    >
                      <span className="mgmt-risk-key">{i.key}</span>
                      <span className="mgmt-risk-summary">{i.summary}</span>
                      <span className="mgmt-risk-who">{i.assignee?.display_name || '—'}</span>
                    </a>
                  ))}
                </div>
              )}

              {riskItems.stale.length > 0 && (
                <div className="mgmt-risk-section">
                  <span className="mgmt-risk-label">Paralisados +30 dias ({riskItems.stale.length})</span>
                  {riskItems.stale.map(i => (
                    <a
                      key={i.key}
                      href={i.jira_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mgmt-risk-item mgmt-risk-item--stale"
                    >
                      <span className="mgmt-risk-key">{i.key}</span>
                      <span className="mgmt-risk-summary">{i.summary}</span>
                      <span className="mgmt-risk-who">{i.assignee?.display_name || '—'}</span>
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

          {/* ── AI CHAT HISTÓRICO ──────────────────────────────── */}
          <MgmtAIChat mgmtData={mgmtData} dashData={data} />
        </>
      )}
    </div>
  )
}
