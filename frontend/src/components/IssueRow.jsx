import './IssueRow.css'

const STATUS_MAP = {
  'new':           { label: null,          cls: 'st-new'      },
  'indeterminate': { label: 'Em Andamento', cls: 'st-progress' },
  'done':          { label: 'Concluído',    cls: 'st-done'     },
}

const TYPE_MAP = {
  'Problema': { label: '🔴 Bug',      cls: 'tp-bug'  },
  'Bug':      { label: '🔴 Bug',      cls: 'tp-bug'  },
  'Melhoria': { label: '🟢 Melhoria', cls: 'tp-imp'  },
  'Tarefa':   { label: '🔵 Tarefa',   cls: 'tp-task' },
  'História': { label: '🔵 História', cls: 'tp-task' },
  'Story':    { label: '🔵 História', cls: 'tp-task' },
  'Epic':     { label: '🟣 Epic',     cls: 'tp-epic' },
}

const PRIO_MAP = {
  'Highest': '🔴',
  'High':    '🟠',
  'Medium':  '🟡',
  'Low':     '⚪',
  'Lowest':  '⚪',
}

function daysAgo(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000)
}

function msToLabel(ms) {
  const h = Math.floor(ms / 3600000)
  if (h < 1) return null
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function IssueRow({ issue, jiraBaseUrl, compact }) {
  const age       = daysAgo(issue.created)
  const progTime  = msToLabel(issue.time_in_status?.in_progress_ms ?? 0)
  const component = issue.components?.[0]?.name
  const status    = STATUS_MAP[issue.status?.category]
  const type      = TYPE_MAP[issue.issue_type?.name]
  const prioEmoji = PRIO_MAP[issue.priority?.name] ?? ''
  const url       = issue.jira_url || (jiraBaseUrl ? `${jiraBaseUrl}/browse/${issue.key}` : '#')

  const ageColor = age === null ? '' : age > 30 ? '#FE70BD' : age > 7 ? '#F2F24B' : 'rgba(255,255,255,0.35)'

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'ir',
        issue.is_overdue ? 'ir-overdue' : '',
        compact ? 'ir-compact' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Linha 1: chave + status + idade */}
      <div className="ir-row1">
        <span className="ir-key">{issue.key}</span>
        {prioEmoji && <span className="ir-prio" title={issue.priority?.name}>{prioEmoji}</span>}
        {type && <span className={`ir-type ${type.cls}`}>{type.label}</span>}
        {status?.label && (
          <span className={`ir-status ${status.cls}`}>{status.label}</span>
        )}
        {!status?.label && issue.status?.name && (
          <span className="ir-status-raw">{issue.status.name}</span>
        )}
        {age !== null && (
          <span className="ir-age" style={{ color: ageColor }}>
            {age === 0 ? 'hoje' : `${age}d`}
          </span>
        )}
      </div>

      {/* Linha 2: título */}
      <p className="ir-summary">{issue.summary}</p>

      {/* Linha 3: datas + tempo + componente */}
      <div className="ir-row3">
        {issue.is_overdue && issue.due_date && (
          <span className="ir-due-overdue">⚠ venceu {issue.due_date}</span>
        )}
        {!issue.is_overdue && issue.due_date && (
          <span className="ir-due">vence {issue.due_date}</span>
        )}
        {progTime && <span className="ir-meta">⏱ {progTime} em progresso</span>}
        {component && <span className="ir-component">{component}</span>}
        {issue.activity_type && <span className="ir-meta">{issue.activity_type}</span>}
      </div>
    </a>
  )
}
