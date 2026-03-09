import { useState } from 'react'
import IssueRow from './IssueRow'
import './StaleBanner.css'

export default function StaleBanner({ issues, jiraBaseUrl }) {
  const [open, setOpen] = useState(false)

  if (!issues?.length) return null

  return (
    <div className="stale-banner">
      <button className="stale-header" onClick={() => setOpen(o => !o)}>
        <span className="stale-icon">🔥</span>
        <span className="stale-text">
          <strong>{issues.length}</strong> {issues.length === 1 ? 'issue parada' : 'issues paradas'} há mais de 30 dias em progresso — atenção imediata necessária
        </span>
        <span className="stale-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="stale-list">
          {issues.map(issue => (
            <IssueRow key={issue.key} issue={issue} jiraBaseUrl={jiraBaseUrl} />
          ))}
        </div>
      )}
    </div>
  )
}
