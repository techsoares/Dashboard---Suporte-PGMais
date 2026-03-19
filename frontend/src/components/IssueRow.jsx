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

function SlaBar({ issue }) {
  const due = issue.due_date
  if (!due) return null

  const startStr = issue.start_date || issue.created?.slice(0, 10)
  if (!startStr) return null

  const startMs = new Date(startStr).getTime()
  const dueMs   = new Date(due).getTime()
  if (dueMs <= startMs) return null

  const pct   = Math.min(100, Math.max(0, ((Date.now() - startMs) / (dueMs - startMs)) * 100))
  const color = pct > 85 ? '#FE70BD' : pct > 60 ? '#F2F24B' : '#40EB4F'

  return (
    <div className="ir-sla">
      <div className="ir-sla-track">
        <div className="ir-sla-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="ir-sla-pct" style={{ color }} title={`${Math.round(pct)}% do prazo consumido`}>{Math.round(pct)}% prazo</span>
    </div>
  )
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
        <span className="ir-key" title={`Abrir ${issue.key} no Jira`}>{issue.key}</span>
        {prioEmoji && <span className="ir-prio" title={`Prioridade: ${issue.priority?.name}`}>{prioEmoji}</span>}
        {type && <span className={`ir-type ${type.cls}`} title={`Tipo: ${issue.issue_type?.name}`}>{type.label}</span>}
        {status?.label && (
          <span className={`ir-status ${status.cls}`} title={`Status: ${status.label}`}>{status.label}</span>
        )}
        {!status?.label && issue.status?.name && (
          <span className="ir-status-raw" title={`Status: ${issue.status.name}`}>{issue.status.name}</span>
        )}
        {age !== null && (
          <span className="ir-age" style={{ color: ageColor }} title={`Criado há ${age} dia(s)`}>
            {age === 0 ? 'hoje' : `${age}d`}
          </span>
        )}
      </div>

      {/* Linha 2: título */}
      <p className="ir-summary" title={issue.summary}>{issue.summary}</p>

      {/* Linha 3: datas + tempo + componente */}
      <div className="ir-row3">
        {issue.is_overdue && issue.due_date && (
          <span className="ir-due-overdue" title={`Prazo vencido em ${issue.due_date}`}>⚠ venceu {issue.due_date}</span>
        )}
        {!issue.is_overdue && issue.due_date && (
          <span className="ir-due" title={`Prazo de entrega: ${issue.due_date}`}>vence {issue.due_date}</span>
        )}
        {progTime && <span className="ir-meta" title="Tempo total em status de progresso">⏱ {progTime} em progresso</span>}
        {component && <span className="ir-component" title={`Componente: ${component}`}>{component}</span>}
        {issue.activity_type && <span className="ir-meta" title={`Tipo de atividade: ${issue.activity_type}`}>{issue.activity_type}</span>}
      </div>

      {/* Barra de SLA */}
      <SlaBar issue={issue} />
    </a>
  )
}
