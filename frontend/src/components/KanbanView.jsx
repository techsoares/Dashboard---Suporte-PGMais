import { useState, useMemo, useCallback } from 'react'
import { isWaiting } from '../utils/constants'
import './KanbanView.css'

// ── Constantes ────────────────────────────────────────────────────────────
const CATEGORY_META = {
  new:           { label: 'A Fazer',       color: '#6B7280', order: 0 },
  indeterminate: { label: 'Em Andamento',  color: '#3DB7F4', order: 1 },
  done:          { label: 'Concluído',     color: '#40EB4F', order: 2 },
}

const PRIO_ORDER = { Highest: 0, Blocker: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 }

const PRIO_COLORS = {
  Highest: '#ef4444', Blocker: '#ef4444', High: '#f97316',
  Medium: '#eab308', Low: '#22c55e', Lowest: '#9ca3af',
}

const fmtDate = d => {
  if (!d) return null
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const daysDiff = d => {
  if (!d) return null
  const diff = Math.round((new Date(d) - new Date()) / 86400000)
  return diff
}

// ── WIP Limit badge ───────────────────────────────────────────────────────
function WipBadge({ count }) {
  const level = count > 10 ? 'critical' : count > 6 ? 'warn' : 'ok'
  return <span className={`kb-wip kb-wip--${level}`} title="Work in Progress">{count}</span>
}

// ── Card ──────────────────────────────────────────────────────────────────
function IssueCard({ issue }) {
  const prioColor = PRIO_COLORS[issue.priority?.name] || '#9ca3af'
  const prioName = issue.priority?.name || 'Medium'
  const daysLeft = daysDiff(issue.due_date)
  const isOverdue = issue.is_overdue
  const isUrgent = daysLeft !== null && daysLeft <= 2 && daysLeft >= 0
  const waiting = isWaiting(issue)

  return (
    <a
      href={issue.jira_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`kb-card ${isOverdue ? 'kb-card--overdue' : ''} ${waiting ? 'kb-card--waiting' : ''}`}
    >
      {/* Priority stripe */}
      <div className="kb-card__prio-stripe" style={{ background: prioColor }} />

      <div className="kb-card__body">
        <div className="kb-card__top">
          <span className="kb-card__key">{issue.key}</span>
          <span className="kb-card__prio" style={{ color: prioColor }}>{prioName}</span>
        </div>

        <p className="kb-card__summary">{issue.summary}</p>

        <div className="kb-card__tags">
          {issue.issue_type?.name && (
            <span className="kb-card__tag kb-card__tag--type">{issue.issue_type.name}</span>
          )}
          {issue.account && (
            <span className="kb-card__tag kb-card__tag--account" title={issue.account}>
              {issue.account.length > 18 ? issue.account.slice(0, 17) + '\u2026' : issue.account}
            </span>
          )}
          {issue.product && (
            <span className="kb-card__tag kb-card__tag--product" title={issue.product}>
              {issue.product.length > 18 ? issue.product.slice(0, 17) + '\u2026' : issue.product}
            </span>
          )}
        </div>

        <div className="kb-card__footer">
          <span className="kb-card__assignee">
            {issue.assignee?.display_name || 'Não atribuído'}
          </span>
          {issue.due_date && (
            <span className={`kb-card__due ${isOverdue ? 'kb-card__due--late' : isUrgent ? 'kb-card__due--urgent' : ''}`}>
              {isOverdue ? `Atrasado ${Math.abs(daysLeft)}d` : isUrgent ? `Vence em ${daysLeft}d` : fmtDate(issue.due_date)}
            </span>
          )}
        </div>

        {/* Flags */}
        {(isOverdue || waiting) && (
          <div className="kb-card__flags">
            {isOverdue && <span className="kb-card__flag kb-card__flag--overdue">ATRASADO</span>}
            {waiting && <span className="kb-card__flag kb-card__flag--waiting">AGUARDANDO</span>}
          </div>
        )}
      </div>
    </a>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function KanbanView({ data }) {
  const [search, setSearch] = useState('')
  const [filterPrio, setFilterPrio] = useState(null)

  const issues = useMemo(() => data?.backlog || [], [data])

  const filtered = useMemo(() => {
    let result = issues
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(i =>
        i.key?.toLowerCase().includes(q) ||
        i.summary?.toLowerCase().includes(q) ||
        i.assignee?.display_name?.toLowerCase().includes(q) ||
        i.account?.toLowerCase().includes(q) ||
        i.product?.toLowerCase().includes(q)
      )
    }
    if (filterPrio) {
      result = result.filter(i => i.priority?.name === filterPrio)
    }
    return result
  }, [issues, search, filterPrio])

  // Group by status
  const columns = useMemo(() => {
    const map = {}
    for (const issue of filtered) {
      const statusName = issue.status?.name || 'Sem Status'
      const category = issue.status?.category || 'new'
      if (!map[statusName]) {
        map[statusName] = { name: statusName, category, issues: [], overdueCount: 0, waitingCount: 0 }
      }
      map[statusName].issues.push(issue)
      if (issue.is_overdue) map[statusName].overdueCount++
      if (isWaiting(issue)) map[statusName].waitingCount++
    }

    return Object.values(map)
      .sort((a, b) => {
        const catA = CATEGORY_META[a.category]?.order ?? 3
        const catB = CATEGORY_META[b.category]?.order ?? 3
        if (catA !== catB) return catA - catB
        return b.issues.length - a.issues.length
      })
      .map(col => ({
        ...col,
        issues: col.issues.sort((a, b) => {
          if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1
          return (PRIO_ORDER[a.priority?.name] ?? 2) - (PRIO_ORDER[b.priority?.name] ?? 2)
        }),
      }))
  }, [filtered])

  // Stats
  const stats = useMemo(() => ({
    total: filtered.length,
    overdue: filtered.filter(i => i.is_overdue).length,
    inProgress: filtered.filter(i => i.status?.category === 'indeterminate' && !isWaiting(i)).length,
    waiting: filtered.filter(i => isWaiting(i)).length,
  }), [filtered])

  // Priority distribution for filter pills
  const prioDist = useMemo(() => {
    const map = {}
    filtered.forEach(i => {
      const p = i.priority?.name || 'Medium'
      map[p] = (map[p] || 0) + 1
    })
    return map
  }, [filtered])

  const togglePrio = useCallback((prio) => {
    setFilterPrio(prev => prev === prio ? null : prio)
  }, [])

  if (!issues.length) {
    return (
      <div className="kb-root">
        <h2 className="kb-title">Kanban</h2>
        <p className="kb-empty-msg">Nenhuma issue encontrada.</p>
      </div>
    )
  }

  return (
    <div className="kb-root">
      {/* Header */}
      <div className="kb-header">
        <div>
          <h2 className="kb-title">Kanban</h2>
          <p className="kb-subtitle">Fluxo de trabalho por status</p>
        </div>
        <div className="kb-header-actions">
          <div className="kb-search-wrap">
            <input
              type="text"
              className="kb-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar issue, pessoa, account..."
            />
            {search && <button className="kb-search-clear" onClick={() => setSearch('')}>&#10005;</button>}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="kb-stats">
        <div className="kb-stat">
          <span className="kb-stat-val">{stats.total}</span>
          <span className="kb-stat-lbl">total</span>
        </div>
        <div className="kb-stat kb-stat--progress">
          <span className="kb-stat-val">{stats.inProgress}</span>
          <span className="kb-stat-lbl">andamento</span>
        </div>
        <div className="kb-stat kb-stat--waiting">
          <span className="kb-stat-val">{stats.waiting}</span>
          <span className="kb-stat-lbl">aguardando</span>
        </div>
        <div className="kb-stat kb-stat--danger">
          <span className="kb-stat-val">{stats.overdue}</span>
          <span className="kb-stat-lbl">atrasadas</span>
        </div>

        <div className="kb-stat-divider" />

        {/* Priority filter pills */}
        {['Highest', 'High', 'Medium', 'Low', 'Lowest'].filter(p => prioDist[p]).map(prio => (
          <button
            key={prio}
            className={`kb-prio-pill ${filterPrio === prio ? 'kb-prio-pill--active' : ''}`}
            style={{ '--prio-color': PRIO_COLORS[prio] }}
            onClick={() => togglePrio(prio)}
          >
            <span className="kb-prio-pill__dot" />
            {prio} ({prioDist[prio]})
          </button>
        ))}
      </div>

      {/* Board */}
      <div className="kb-board">
        {columns.map(col => {
          const meta = CATEGORY_META[col.category] || { color: '#9CA3AF' }
          return (
            <div key={col.name} className="kb-column">
              <div className="kb-col-header" style={{ '--col-color': meta.color }}>
                <div className="kb-col-header__left">
                  <span className="kb-col-name">{col.name}</span>
                  <WipBadge count={col.issues.length} />
                </div>
                <div className="kb-col-header__indicators">
                  {col.overdueCount > 0 && <span className="kb-col-indicator kb-col-indicator--overdue" title="Atrasadas">{col.overdueCount}</span>}
                  {col.waitingCount > 0 && <span className="kb-col-indicator kb-col-indicator--waiting" title="Aguardando">{col.waitingCount}</span>}
                </div>
              </div>
              <div className="kb-col-body">
                {col.issues.map(issue => (
                  <IssueCard key={issue.key} issue={issue} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
