import IssueRow from './IssueRow'
import './DevCard.css'

function Avatar({ assignee }) {
  const initials = assignee.display_name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="dev-avatar-ring" title={assignee.display_name}>
      {assignee.avatar_url
        ? <img className="dev-avatar-img" src={assignee.avatar_url} alt={assignee.display_name} />
        : <div className="dev-avatar-initials">{initials}</div>
      }
    </div>
  )
}

function HealthBar({ issues }) {
  if (!issues.length) return null

  const total      = issues.length
  const inProgress = issues.filter(i => i.status?.category === 'indeterminate').length
  const waiting    = issues.filter(i => /aguard|wait|blocked/i.test(i.status?.name ?? '')).length
  const overdue    = issues.filter(i => i.is_overdue).length
  const neutral    = total - inProgress - waiting - overdue

  const avgMs = issues
    .map(i => i.time_in_status?.in_progress_ms ?? 0)
    .filter(ms => ms > 0)
  const avgDays = avgMs.length
    ? Math.round(avgMs.reduce((a, b) => a + b, 0) / avgMs.length / 86400000)
    : null

  const segments = [
    { n: inProgress, cls: 'seg-progress', label: `${inProgress} em andamento`, color: '#3DB7F4' },
    { n: waiting,    cls: 'seg-waiting',  label: `${waiting} aguardando`,       color: '#F2F24B' },
    { n: overdue,    cls: 'seg-overdue',  label: `${overdue} em atraso`,        color: '#FE70BD' },
    { n: neutral,    cls: 'seg-neutral',  label: `${neutral} backlog`,          color: 'rgba(255,255,255,0.12)' },
  ].filter(s => s.n > 0)

  return (
    <div className="dev-health">
      <div className="dev-health-bar">
        {segments.map(s => (
          <div
            key={s.cls}
            className={`seg ${s.cls}`}
            style={{ flex: s.n, backgroundColor: s.color }}
            title={s.label}
          />
        ))}
      </div>
      <div className="dev-health-legend">
        {inProgress > 0  && <span style={{ color: '#3DB7F4' }} title={`${inProgress} issue(s) sendo trabalhada(s)`}>{inProgress} andamento</span>}
        {waiting    > 0  && <span style={{ color: '#F2F24B' }} title={`${waiting} issue(s) aguardando ação externa`}>{waiting} aguardando</span>}
        {overdue    > 0  && <span style={{ color: '#FE70BD' }} title={`${overdue} issue(s) com prazo vencido`}>{overdue} em atraso</span>}
        {avgDays    !== null && <span className="avg-days" title="Tempo médio que as issues ficam em progresso">⌀ {avgDays}d em progresso</span>}
      </div>
    </div>
  )
}

export default function DevCard({ dev, jiraBaseUrl }) {
  if (!dev?.assignee) return null
  const { assignee, active_issues = [] } = dev
  const count = active_issues.length
  const overdueCount = active_issues.filter(i => i.is_overdue).length

  return (
    <div className={`dev-card ${overdueCount > 0 ? 'dev-card-alert' : ''}`} role="article" aria-label={`Card do desenvolvedor ${assignee.display_name} com ${count} issue${count !== 1 ? 's' : ''}`}>
      <div className="dev-card-header">
        <Avatar assignee={assignee} />
        <div className="dev-info">
          <span className="dev-name" title={assignee.display_name}>{assignee.display_name}</span>
          <span className="dev-sub" title={`${count} issue(s) atribuída(s) a este desenvolvedor`}>{count} issue{count !== 1 ? 's' : ''}</span>
        </div>
        {overdueCount > 0 && (
          <span className="dev-alert-badge" title={`${overdueCount} issue(s) atrasada(s)`}>⚠ {overdueCount}</span>
        )}
      </div>

      <HealthBar issues={active_issues} />

      <div className="dev-issues">
        {active_issues.length === 0
          ? <p className="dev-empty">Nenhuma issue no momento</p>
          : active_issues.map(issue => (
              <IssueRow key={issue.key} issue={issue} jiraBaseUrl={jiraBaseUrl} compact />
            ))
        }
      </div>
    </div>
  )
}
