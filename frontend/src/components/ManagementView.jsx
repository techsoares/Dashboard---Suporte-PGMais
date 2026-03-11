import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import './ManagementView.css'

// Renderiza resposta da IA: mistura parágrafos e bullet points
function renderAIAnswer(text) {
  const blocks = text.split(/\n{2,}/)
  return blocks.map((block, bi) => {
    const lines = block.split('\n').filter(l => l.trim() !== '')
    const isList = lines.every(l => /^[-•]\s/.test(l.trim()))
    if (isList) {
      return (
        <ul key={bi} className="ai-answer-list">
          {lines.map((l, li) => (
            <li key={li}>{l.replace(/^[-•]\s+/, '')}</li>
          ))}
        </ul>
      )
    }
    // Bloco misto: separa linhas bullet das de texto
    const parts = []
    let currentBullets = []
    for (const [li, line] of lines.entries()) {
      if (/^[-•]\s/.test(line.trim())) {
        currentBullets.push(line)
      } else {
        if (currentBullets.length) {
          parts.push(<ul key={`${bi}-ul-${li}`} className="ai-answer-list">{currentBullets.map((b, i) => <li key={i}>{b.replace(/^[-•]\s+/, '')}</li>)}</ul>)
          currentBullets = []
        }
        parts.push(<p key={`${bi}-p-${li}`} className="ai-answer-para">{line}</p>)
      }
    }
    if (currentBullets.length) {
      parts.push(<ul key={`${bi}-ul-end`} className="ai-answer-list">{currentBullets.map((b, i) => <li key={i}>{b.replace(/^[-•]\s+/, '')}</li>)}</ul>)
    }
    return <div key={bi}>{parts}</div>
  })
}

// ── API URL ────────────────────────────────────────────────────────────────
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    return 'http://localhost:8000'
  const host = window.location.host.replace(':5173', ':8000').replace('-5173.', '-8000.')
  return `${window.location.protocol}//${host}`
}
const API = getApiUrl()

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

  const W = 480, H = 110, pL = 28, pR = 12, pT = 10, pB = 28
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
        ? <p className="mgmt-empty">Selecione ao menos um responsável.</p>
        : (
          <svg viewBox={`0 0 ${W} ${H}`} className="mgmt-line-svg">
            {[0, 0.5, 1].map(t => (
              <line key={t} x1={pL} y1={yPos(maxVal * t)} x2={pL + cW} y2={yPos(maxVal * t)}
                stroke="var(--border)" strokeWidth={0.5} strokeDasharray={t > 0 ? '4,3' : ''} />
            ))}
            {weekLabels.map((lbl, i) => (
              <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" className="mgmt-chart-label">{lbl}</text>
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
    const q = search.trim().toLowerCase()
    return (issues ?? []).filter(i =>
      i.key?.toLowerCase().includes(q) ||
      i.summary?.toLowerCase().includes(q) ||
      i.assignee?.display_name?.toLowerCase().includes(q) ||
      i.product?.toLowerCase().includes(q)
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
                    rel="noreferrer"
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

// ── MgmtAIChat ─────────────────────────────────────────────────────────────
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

  const buildContext = () => {
    if (!mgmtData) return ''
    const lines = [
      `=== HISTÓRICO (${mgmtData.period_weeks ?? '?'} semanas) ===`,
      `Total entregues: ${mgmtData.total_done ?? 0}`,
      `SLA: ${mgmtData.sla_rate ?? 0}%`,
      `Ciclo médio: ${mgmtData.avg_cycle_days ?? 0}d`,
      '', '--- POR SEMANA ---',
    ]
    for (const w of mgmtData.weeks ?? []) {
      lines.push(`${w.week_label}: ${w.done_count} entregues (${w.on_time} no prazo, ciclo ${w.avg_cycle_days}d)`)
    }
    lines.push('', '--- POR DEV ---')
    for (const d of mgmtData.by_dev ?? []) {
      lines.push(`${d.name}: ${d.done_count} entregues, ciclo médio ${d.avg_cycle_days}d`)
    }
    lines.push('', '--- POR PRODUTO ---')
    for (const p of mgmtData.by_product ?? []) {
      lines.push(`${p.product}: ${p.done_count} entregues`)
    }
    if (dashData?.backlog) {
      const active = dashData.backlog
      lines.push('', '--- BACKLOG ATUAL ---',
        `Total ativo: ${active.length}`,
        `Atrasados: ${active.filter(i => i.is_overdue).length}`,
        `Paralisados: ${(dashData.stale_issues ?? []).length}`,
      )
    }
    return lines.join('\n')
  }

  const askAI = async (q) => {
    const text = (q ?? question).trim()
    if (!text || loading) return
    setError('')
    setLoading(true)

    const recent = history.slice(-3).map(h =>
      `Pergunta anterior: ${h.question}\nResposta anterior: ${h.answer}`
    ).join('\n\n')
    const ctx = buildContext() + (recent ? `\n\n--- HISTÓRICO ---\n${recent}` : '')

    try {
      const res  = await fetch(`${API}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, context: ctx }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.detail ?? 'Erro ao consultar a IA.')
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
                <div className="mgmt-ai-answer">{renderAIAnswer(item.answer)}</div>
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
          placeholder="Pergunte sobre o histórico de entregas, SLA, tendências..."
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

    fetch(`${API}/api/management?period=${periodKey}`, { signal })
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
      .filter(i => i.is_overdue)
      .sort((a, b) => (a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1)
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
    if (filters.assignee?.length)    result = result.filter(i => filters.assignee.includes(i.assignee?.display_name))
    if (filters.account?.length)     result = result.filter(i => filters.account.includes(i.account))
    if (filters.product?.length)     result = result.filter(i => filters.product.includes(i.product))
    if (filters.issue_type?.length)  result = result.filter(i => filters.issue_type.includes(i.issue_type?.name))
    if (filters.status?.length)      result = result.filter(i => filters.status.includes(i.status?.name))
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
                    <a key={i.key} href={i.jira_url} target="_blank" rel="noreferrer"
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
                    <a key={i.key} href={i.jira_url} target="_blank" rel="noreferrer"
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

          {/* AI Chat */}
          <MgmtAIChat mgmtData={mgmtData} dashData={data} />
        </>
      )}
    </div>
  )
}
