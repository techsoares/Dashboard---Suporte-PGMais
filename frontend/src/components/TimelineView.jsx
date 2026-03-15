import { useMemo, useState } from 'react'
import './TimelineView.css'

const STATUS_COLORS = {
  'To Do': '#6B7280',
  'In Progress': '#3DB7F4',
  'In Review': '#F2F24B',
  'Done': '#40EB4F',
  'Blocked': '#FE70BD',
}

const PRIO_ORDER = { Highest: 0, Blocker: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 }

export default function TimelineView({ data }) {
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [groupBy, setGroupBy] = useState('status') // status | assignee | product

  const issues = useMemo(() => {
    const all = data?.backlog || []
    return all.sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return PRIO_ORDER[a.priority?.name] - PRIO_ORDER[b.priority?.name]
    })
  }, [data])

  const grouped = useMemo(() => {
    const groups = {}
    for (const issue of issues) {
      const key = groupBy === 'status'
        ? issue.status?.name || 'Unknown'
        : groupBy === 'assignee'
        ? issue.assignee?.display_name || 'Unassigned'
        : issue.product || 'No Product'

      if (!groups[key]) groups[key] = []
      groups[key].push(issue)
    }
    return groups
  }, [issues, groupBy])

  const dateRange = useMemo(() => {
    const dates = issues
      .filter(i => i.due_date)
      .map(i => new Date(i.due_date))
    if (dates.length === 0) {
      const today = new Date()
      return { start: today, end: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) }
    }
    const start = new Date(Math.min(...dates))
    const end = new Date(Math.max(...dates))
    start.setDate(start.getDate() - 5)
    end.setDate(end.getDate() + 5)
    return { start, end }
  }, [issues])

  const daysBetween = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24))
  const pixelsPerDay = Math.max(20, 600 / daysBetween)

  const getPosition = (date) => {
    if (!date) return null
    const d = new Date(date)
    const diff = Math.ceil((d - dateRange.start) / (1000 * 60 * 60 * 24))
    return diff * pixelsPerDay
  }

  const formatDate = (date) => {
    if (!date) return '—'
    const d = new Date(date)
    return d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
  }

  const today = new Date()
  const todayPos = getPosition(today)

  return (
    <div className="tv-root">
      <div className="tv-header">
        <h2 className="tv-title">Timeline de Issues</h2>
        <div className="tv-controls">
          <select
            className="tv-select"
            value={groupBy}
            onChange={e => setGroupBy(e.target.value)}
          >
            <option value="status">Agrupar por Status</option>
            <option value="assignee">Agrupar por Responsável</option>
            <option value="product">Agrupar por Produto</option>
          </select>
        </div>
      </div>

      <div className="tv-container">
        <div className="tv-sidebar">
          <div className="tv-sidebar-header">Grupos</div>
          {Object.keys(grouped).map(group => (
            <div key={group} className="tv-group-label">
              <span className="tv-group-dot" style={{
                background: STATUS_COLORS[group] || '#9CA3AF'
              }} />
              <span className="tv-group-name">{group}</span>
              <span className="tv-group-count">{grouped[group].length}</span>
            </div>
          ))}
        </div>

        <div className="tv-timeline-wrapper">
          <div className="tv-timeline-header">
            <div className="tv-timeline-ruler">
              {Array.from({ length: Math.ceil(daysBetween / 7) + 1 }).map((_, weekIdx) => {
                const weekStart = new Date(dateRange.start)
                weekStart.setDate(weekStart.getDate() + weekIdx * 7)
                return (
                  <div
                    key={weekIdx}
                    className="tv-week-marker"
                    style={{ left: `${weekIdx * 7 * pixelsPerDay}px` }}
                  >
                    {weekStart.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
                  </div>
                )
              })}
            </div>
            {todayPos !== null && (
              <div className="tv-today-line" style={{ left: `${todayPos}px` }} title="Hoje" />
            )}
          </div>

          <div className="tv-timeline-body">
            {Object.entries(grouped).map(([group, groupIssues]) => (
              <div key={group} className="tv-group">
                <div className="tv-group-header">
                  <span className="tv-group-header-dot" style={{
                    background: STATUS_COLORS[group] || '#9CA3AF'
                  }} />
                  <span className="tv-group-header-name">{group}</span>
                </div>

                <div className="tv-group-items">
                  {groupIssues.map(issue => {
                    const pos = getPosition(issue.due_date)
                    const width = issue.due_date ? Math.max(60, pixelsPerDay * 3) : 80
                    const isOverdue = issue.is_overdue
                    const isSelected = selectedIssue?.key === issue.key

                    return (
                      <div
                        key={issue.key}
                        className={`tv-item ${isOverdue ? 'tv-item--overdue' : ''} ${isSelected ? 'tv-item--selected' : ''}`}
                        onClick={() => setSelectedIssue(isSelected ? null : issue)}
                      >
                        <div className="tv-item-label">
                          <span className="tv-item-key">{issue.key}</span>
                          <span className="tv-item-summary" title={issue.summary}>
                            {issue.summary}
                          </span>
                        </div>

                        {pos !== null && (
                          <div
                            className="tv-item-bar"
                            style={{
                              left: `${pos}px`,
                              width: `${width}px`,
                              background: STATUS_COLORS[issue.status?.name] || '#9CA3AF',
                              opacity: isSelected ? 1 : 0.7,
                            }}
                            title={`${issue.key}: ${formatDate(issue.due_date)}`}
                          >
                            <span className="tv-item-bar-text">
                              {issue.priority?.name === 'Highest' && '🔴'}
                              {issue.priority?.name === 'High' && '🟠'}
                            </span>
                          </div>
                        )}

                        {isSelected && (
                          <div className="tv-item-details">
                            <div className="tv-detail-row">
                              <span className="tv-detail-label">Status:</span>
                              <span className="tv-detail-value">{issue.status?.name || '—'}</span>
                            </div>
                            <div className="tv-detail-row">
                              <span className="tv-detail-label">Responsável:</span>
                              <span className="tv-detail-value">{issue.assignee?.display_name || '—'}</span>
                            </div>
                            <div className="tv-detail-row">
                              <span className="tv-detail-label">Vencimento:</span>
                              <span className="tv-detail-value">{formatDate(issue.due_date)}</span>
                            </div>
                            {issue.account && (
                              <div className="tv-detail-row">
                                <span className="tv-detail-label">Account:</span>
                                <span className="tv-detail-value">{issue.account}</span>
                              </div>
                            )}
                            <a
                              href={`${data.jira_base_url}/browse/${issue.key}`}
                              target="_blank"
                              rel="noreferrer"
                              className="tv-detail-link"
                            >
                              Abrir no Jira →
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="tv-legend">
        <div className="tv-legend-item">
          <span className="tv-legend-dot" style={{ background: '#3DB7F4' }} />
          Em Progresso
        </div>
        <div className="tv-legend-item">
          <span className="tv-legend-dot" style={{ background: '#F2F24B' }} />
          Em Revisão
        </div>
        <div className="tv-legend-item">
          <span className="tv-legend-dot" style={{ background: '#40EB4F' }} />
          Concluído
        </div>
        <div className="tv-legend-item">
          <span className="tv-legend-dot" style={{ background: '#FE70BD' }} />
          Bloqueado
        </div>
        <div className="tv-legend-item">
          <span className="tv-legend-dot" style={{ background: '#6B7280' }} />
          Não iniciado
        </div>
      </div>
    </div>
  )
}
