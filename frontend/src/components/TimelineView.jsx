import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import './TimelineView.css'

// ── Constantes ────────────────────────────────────────────────────────────
const STATUS_MAP = {
  'to do':         { color: '#6B7280', label: 'A Fazer',      order: 0 },
  'backlog':       { color: '#6B7280', label: 'Backlog',      order: 0 },
  'in progress':   { color: '#3DB7F4', label: 'Em Progresso', order: 1 },
  'em andamento':  { color: '#3DB7F4', label: 'Em Andamento', order: 1 },
  'in review':     { color: '#F2C94C', label: 'Em Revisão',   order: 2 },
  'aguardando':    { color: '#F2C94C', label: 'Aguardando',   order: 2 },
  'blocked':       { color: '#FE70BD', label: 'Bloqueado',    order: 3 },
  'done':          { color: '#40EB4F', label: 'Concluído',    order: 4 },
}

function getStatusMeta(name) {
  const key = (name || '').toLowerCase()
  for (const [pattern, meta] of Object.entries(STATUS_MAP)) {
    if (key.includes(pattern)) return meta
  }
  return { color: '#9CA3AF', label: name || 'Desconhecido', order: 5 }
}

const PRIO_ICON = { Highest: { icon: '!!', cls: 'tv-prio--highest' }, Blocker: { icon: '!!', cls: 'tv-prio--highest' }, High: { icon: '!', cls: 'tv-prio--high' } }

const fmtDate = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const daysBetween = (a, b) => Math.round((b - a) / 86400000)

const GROUP_OPTIONS = [
  { value: 'status',   label: 'Status' },
  { value: 'assignee', label: 'Responsável' },
  { value: 'product',  label: 'Produto' },
  { value: 'account',  label: 'Account' },
]

// ── Componente Principal ──────────────────────────────────────────────────
export default function TimelineView({ data }) {
  const [groupBy, setGroupBy]           = useState('assignee')
  const [search, setSearch]             = useState('')
  const [expandedGroups, setExpandedGroups] = useState({})
  const [selectedKey, setSelectedKey]   = useState(null)
  const [zoom, setZoom]                 = useState(1)       // 0.5 | 1 | 2
  const [activeFilter, setActiveFilter] = useState(null)    // 'overdue' | 'thisWeek' | 'noDueDate' | null
  const scrollRef = useRef(null)

  // ── Issues processadas ─────────────────────────────────────────────────
  const issues = useMemo(() => {
    const raw = data?.backlog || []
    return raw.map(i => ({
      ...i,
      _status: getStatusMeta(i.status?.name),
      _prio: PRIO_ICON[i.priority?.name] || null,
      _dueMs: i.due_date ? new Date(i.due_date).getTime() : null,
      _createdMs: i.created ? new Date(i.created).getTime() : null,
    })).sort((a, b) => {
      if (a._dueMs && b._dueMs) return a._dueMs - b._dueMs
      if (a._dueMs) return -1
      if (b._dueMs) return 1
      return (a._status.order - b._status.order) || ((a._prio?.cls ? 0 : 1) - (b._prio?.cls ? 0 : 1))
    })
  }, [data])

  // ── Filtro de busca ────────────────────────────────────────────────────
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return issues
    const q = search.trim().toLowerCase()
    return issues.filter(i =>
      i.key?.toLowerCase().includes(q) ||
      i.summary?.toLowerCase().includes(q) ||
      i.assignee?.display_name?.toLowerCase().includes(q) ||
      i.account?.toLowerCase().includes(q) ||
      i.product?.toLowerCase().includes(q)
    )
  }, [issues, search])

  // ── Filtro por pill ativa ────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!activeFilter) return searchFiltered
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    if (activeFilter === 'overdue') return searchFiltered.filter(i => i.is_overdue)
    if (activeFilter === 'noDueDate') return searchFiltered.filter(i => !i.due_date)
    if (activeFilter === 'thisWeek') return searchFiltered.filter(i => {
      if (!i._dueMs) return false
      const diff = daysBetween(now, new Date(i._dueMs))
      return diff >= 0 && diff <= 7
    })
    return searchFiltered
  }, [searchFiltered, activeFilter])

  // ── Agrupamento ────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = {}
    for (const issue of filtered) {
      let key
      if (groupBy === 'status')   key = issue._status.label
      else if (groupBy === 'assignee') key = issue.assignee?.display_name || 'Não atribuído'
      else if (groupBy === 'product')  key = issue.product || 'Sem produto'
      else key = issue.account || 'Sem account'

      if (!map[key]) map[key] = { items: [], color: issue._status.color }
      map[key].items.push(issue)
    }
    // Ordena grupos: com mais issues primeiro
    return Object.entries(map)
      .sort((a, b) => b[1].items.length - a[1].items.length)
      .map(([name, data]) => ({ name, ...data }))
  }, [filtered, groupBy])

  // Expandir todos por padrão
  useEffect(() => {
    const map = {}
    grouped.forEach(g => { map[g.name] = true })
    setExpandedGroups(map)
  }, [grouped.length, groupBy])

  const toggleGroup = useCallback((name) => {
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }))
  }, [])

  // ── Range de datas para o Gantt ────────────────────────────────────────
  const { rangeStart, rangeEnd, totalDays, weeks } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dates = filtered.filter(i => i._dueMs).map(i => i._dueMs)
    const createdDates = filtered.filter(i => i._createdMs).map(i => i._createdMs)
    const allDates = [...dates, ...createdDates, today.getTime()]

    let minD = new Date(Math.min(...allDates))
    let maxD = new Date(Math.max(...allDates))
    minD.setDate(minD.getDate() - 7)
    maxD.setDate(maxD.getDate() + 14)

    // Alinhar a segunda-feira
    minD.setDate(minD.getDate() - minD.getDay() + 1)
    const total = daysBetween(minD, maxD)
    const wks = []
    for (let d = new Date(minD); d < maxD; d.setDate(d.getDate() + 7)) {
      wks.push(new Date(d))
    }
    return { rangeStart: minD, rangeEnd: maxD, totalDays: Math.max(total, 28), weeks: wks }
  }, [filtered])

  const PX_PER_DAY = 28 * zoom
  const chartWidth = totalDays * PX_PER_DAY

  const getLeft = (dateMs) => {
    if (!dateMs) return null
    return daysBetween(rangeStart, new Date(dateMs)) * PX_PER_DAY
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayLeft = getLeft(today.getTime())

  // Scroll para "hoje" ao montar
  useEffect(() => {
    if (scrollRef.current && todayLeft > 200) {
      scrollRef.current.scrollLeft = todayLeft - 200
    }
  }, [todayLeft, zoom])

  // ── Stats (contagens sempre sobre searchFiltered, não sobre filtered) ─
  const stats = useMemo(() => ({
    total: searchFiltered.length,
    overdue: searchFiltered.filter(i => i.is_overdue).length,
    noDueDate: searchFiltered.filter(i => !i.due_date).length,
    thisWeek: searchFiltered.filter(i => {
      if (!i._dueMs) return false
      const diff = daysBetween(today, new Date(i._dueMs))
      return diff >= 0 && diff <= 7
    }).length,
  }), [searchFiltered])

  const toggleFilter = useCallback((filter) => {
    setActiveFilter(prev => prev === filter ? null : filter)
  }, [])

  return (
    <div className="tv-root">
      {/* Header */}
      <div className="tv-header">
        <div>
          <h2 className="tv-title">Timeline</h2>
          <p className="tv-subtitle">Visualização temporal das demandas ativas</p>
        </div>
        <div className="tv-header-actions">
          <div className="tv-search-wrap">
            <span className="tv-search-icon">&#128269;</span>
            <input
              className="tv-search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar issue, pessoa, account..."
            />
            {search && <button className="tv-search-clear" onClick={() => setSearch('')}>&#10005;</button>}
          </div>

          <div className="tv-group-picker">
            {GROUP_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`tv-group-btn ${groupBy === opt.value ? 'active' : ''}`}
                onClick={() => setGroupBy(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="tv-zoom-btns">
            <button className={`tv-zoom-btn ${zoom === 0.5 ? 'active' : ''}`} onClick={() => setZoom(0.5)} title="Visão mensal">M</button>
            <button className={`tv-zoom-btn ${zoom === 1 ? 'active' : ''}`} onClick={() => setZoom(1)} title="Visão semanal">S</button>
            <button className={`tv-zoom-btn ${zoom === 2 ? 'active' : ''}`} onClick={() => setZoom(2)} title="Visão diária">D</button>
          </div>
        </div>
      </div>

      {/* Stats strip — clickable filters */}
      <div className="tv-stats">
        <button className={`tv-stat ${activeFilter === null ? '' : 'tv-stat--dimmed'}`} onClick={() => setActiveFilter(null)}>
          <span className="tv-stat-val">{stats.total}</span>
          <span className="tv-stat-lbl">total</span>
        </button>
        <button className={`tv-stat tv-stat--danger ${activeFilter === 'overdue' ? 'tv-stat--active' : ''}`} onClick={() => toggleFilter('overdue')}>
          <span className="tv-stat-val">{stats.overdue}</span>
          <span className="tv-stat-lbl">atrasadas</span>
        </button>
        <button className={`tv-stat tv-stat--warn ${activeFilter === 'thisWeek' ? 'tv-stat--active' : ''}`} onClick={() => toggleFilter('thisWeek')}>
          <span className="tv-stat-val">{stats.thisWeek}</span>
          <span className="tv-stat-lbl">vencem esta semana</span>
        </button>
        <button className={`tv-stat tv-stat--muted ${activeFilter === 'noDueDate' ? 'tv-stat--active' : ''}`} onClick={() => toggleFilter('noDueDate')}>
          <span className="tv-stat-val">{stats.noDueDate}</span>
          <span className="tv-stat-lbl">sem data</span>
        </button>
      </div>
      {activeFilter && (
        <div className="tv-filter-banner">
          Filtro ativo: <strong>{activeFilter === 'overdue' ? 'Atrasadas' : activeFilter === 'thisWeek' ? 'Vencem esta semana' : 'Sem data'}</strong>
          — exibindo {filtered.length} de {stats.total}
          <button className="tv-filter-clear" onClick={() => setActiveFilter(null)}>&#10005; Limpar</button>
        </div>
      )}

      {/* Gantt container */}
      <div className="tv-gantt">
        {/* Left panel — issue list */}
        <div className="tv-left">
          <div className="tv-left-header">
            <span>Issue</span>
            <span>Vencimento</span>
          </div>
          <div className="tv-left-body">
            {grouped.map(group => (
              <div key={group.name} className="tv-grp">
                <button className="tv-grp-toggle" onClick={() => toggleGroup(group.name)}>
                  <span className={`tv-grp-arrow ${expandedGroups[group.name] ? 'open' : ''}`}>&#9654;</span>
                  <span className="tv-grp-name">{group.name}</span>
                  <span className="tv-grp-count">{group.items.length}</span>
                </button>
                {expandedGroups[group.name] && group.items.map(issue => (
                  <div
                    key={issue.key}
                    className={`tv-row ${selectedKey === issue.key ? 'tv-row--sel' : ''} ${issue.is_overdue ? 'tv-row--overdue' : ''}`}
                    onClick={() => setSelectedKey(selectedKey === issue.key ? null : issue.key)}
                  >
                    <div className="tv-row-left">
                      {issue._prio && <span className={`tv-prio ${issue._prio.cls}`}>{issue._prio.icon}</span>}
                      <a href={issue.jira_url} target="_blank" rel="noreferrer" className="tv-row-key" onClick={e => e.stopPropagation()}>{issue.key}</a>
                      <span className="tv-row-summary" title={issue.summary}>{issue.summary}</span>
                    </div>
                    <span className={`tv-row-date ${issue.is_overdue ? 'tv-row-date--late' : ''}`}>
                      {fmtDate(issue.due_date)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {grouped.length === 0 && (
              <div className="tv-empty">Nenhuma issue encontrada.</div>
            )}
          </div>
        </div>

        {/* Right panel — Gantt bars */}
        <div className="tv-right" ref={scrollRef}>
          {/* Header com semanas */}
          <div className="tv-right-header" style={{ width: chartWidth }}>
            {weeks.map((w, i) => {
              const isCurrentWeek = daysBetween(w, today) >= 0 && daysBetween(w, today) < 7
              return (
                <div
                  key={i}
                  className={`tv-week ${isCurrentWeek ? 'tv-week--current' : ''}`}
                  style={{ left: i * 7 * PX_PER_DAY, width: 7 * PX_PER_DAY }}
                >
                  {w.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </div>
              )
            })}
            {/* Today marker */}
            {todayLeft !== null && <div className="tv-today" style={{ left: todayLeft }} />}
          </div>

          {/* Bars */}
          <div className="tv-right-body" style={{ width: chartWidth }}>
            {/* Grid vertical lines for weeks */}
            {weeks.map((_, i) => (
              <div key={i} className="tv-grid-line" style={{ left: i * 7 * PX_PER_DAY }} />
            ))}
            {todayLeft !== null && <div className="tv-today-body" style={{ left: todayLeft }} />}

            {grouped.map(group => (
              <div key={group.name}>
                {/* Group header spacer */}
                <div className="tv-bar-grp-header" />
                {expandedGroups[group.name] && group.items.map(issue => {
                  const dueLeft = getLeft(issue._dueMs)
                  const createdLeft = getLeft(issue._createdMs)
                  const isSelected = selectedKey === issue.key

                  // Bar: from created to due (or just a marker at due)
                  let barLeft, barWidth
                  if (createdLeft != null && dueLeft != null) {
                    barLeft = createdLeft
                    barWidth = Math.max(dueLeft - createdLeft, PX_PER_DAY)
                  } else if (dueLeft != null) {
                    barLeft = Math.max(0, dueLeft - 3 * PX_PER_DAY)
                    barWidth = 3 * PX_PER_DAY
                  } else if (createdLeft != null) {
                    barLeft = createdLeft
                    barWidth = PX_PER_DAY * 2
                  } else {
                    barLeft = null
                    barWidth = 0
                  }

                  return (
                    <div key={issue.key} className="tv-bar-row">
                      {barLeft !== null && (
                        <div
                          className={`tv-bar ${isSelected ? 'tv-bar--sel' : ''} ${issue.is_overdue ? 'tv-bar--overdue' : ''}`}
                          style={{
                            left: barLeft,
                            width: barWidth,
                            background: `linear-gradient(135deg, ${issue._status.color}cc, ${issue._status.color}88)`,
                          }}
                          title={`${issue.key}: ${issue.summary}\n${issue.assignee?.display_name || 'Não atribuído'}\nVence: ${fmtDate(issue.due_date)}`}
                          onClick={() => setSelectedKey(isSelected ? null : issue.key)}
                        >
                          <span className="tv-bar-label">{issue.key}</span>
                        </div>
                      )}
                      {barLeft === null && (
                        <span className="tv-bar-nodate">sem data</span>
                      )}

                      {/* Detail card on select */}
                      {isSelected && (
                        <div className="tv-detail" style={{ left: Math.max(12, (barLeft || 0) + (barWidth || 0) + 8) }}>
                          <div className="tv-detail-head">
                            <a href={issue.jira_url} target="_blank" rel="noreferrer" className="tv-detail-key">{issue.key}</a>
                            <span className="tv-detail-status" style={{ color: issue._status.color }}>{issue._status.label}</span>
                          </div>
                          <p className="tv-detail-summary">{issue.summary}</p>
                          <div className="tv-detail-meta">
                            <span>Responsável: {issue.assignee?.display_name || '—'}</span>
                            <span>Account: {issue.account || '—'}</span>
                            <span>Produto: {issue.product || '—'}</span>
                            <span>Criado: {fmtDate(issue.created)}</span>
                            <span>Vence: {fmtDate(issue.due_date)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="tv-legend">
        {Object.entries(STATUS_MAP).filter(([, m], i, arr) => arr.findIndex(([, m2]) => m2.label === m.label) === i).map(([, meta]) => (
          <div key={meta.label} className="tv-legend-item">
            <span className="tv-legend-dot" style={{ background: meta.color }} />
            {meta.label}
          </div>
        ))}
        <div className="tv-legend-item">
          <span className="tv-legend-dot tv-legend-dot--today" />
          Hoje
        </div>
      </div>
    </div>
  )
}
