import { useState } from 'react'
import IssueRow from './IssueRow'
import './BacklogPanel.css'

const FILTERS = [
  { key: 'all',         label: 'Todas'      },
  { key: 'in_progress', label: 'Andamento'  },
  { key: 'waiting',     label: 'Aguardando' },
  { key: 'overdue',     label: 'Atraso'     },
]

function matchFilter(issue, filter) {
  if (filter === 'all') return true
  if (filter === 'overdue') return issue.is_overdue
  if (filter === 'in_progress') return issue.status?.category === 'indeterminate'
  if (filter === 'waiting') {
    const name = issue.status?.name?.toLowerCase() ?? ''
    return name.includes('aguard') || name.includes('wait') || name.includes('blocked')
  }
  return true
}

export default function BacklogPanel({ issues, jiraBaseUrl }) {
  const [filter, setFilter] = useState('all')
  const filtered = issues.filter(i => matchFilter(i, filter))

  return (
    <aside className="backlog-panel">
      <div className="backlog-header">
        <span className="backlog-title">Backlog Geral</span>
        <span className="backlog-count">{filtered.length}</span>
      </div>

      <div className="backlog-filters">
        {FILTERS.map(f => (
          <button
            key={f.key}
            data-key={f.key}
            className={`filter-btn ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="backlog-list">
        {filtered.length === 0 ? (
          <p className="backlog-empty">Nenhuma issue encontrada.</p>
        ) : (
          filtered.map(issue => (
            <IssueRow key={issue.key} issue={issue} jiraBaseUrl={jiraBaseUrl} />
          ))
        )}
      </div>
    </aside>
  )
}
