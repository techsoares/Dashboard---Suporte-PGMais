import './KanbanView.css'

export default function KanbanView({ data }) {
  if (!data?.backlog?.length) {
    return (
      <div className="kanban-view">
        <h2>Kanban - Visão da Área</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>Nenhuma issue encontrada.</p>
      </div>
    )
  }

  // Agrupar issues por status
  const statusGroups = data.backlog.reduce((acc, issue) => {
    const statusName = issue.status?.name || 'Sem Status'
    if (!acc[statusName]) {
      acc[statusName] = {
        name: statusName,
        category: issue.status?.category || 'new',
        issues: []
      }
    }
    acc[statusName].issues.push(issue)
    return acc
  }, {})

  // Ordenar colunas por categoria e nome
  const sortedColumns = Object.values(statusGroups).sort((a, b) => {
    const categoryOrder = { 'new': 0, 'indeterminate': 1, 'done': 2 }
    const catA = categoryOrder[a.category] ?? 3
    const catB = categoryOrder[b.category] ?? 3
    if (catA !== catB) return catA - catB
    return a.name.localeCompare(b.name)
  })

  const getStatusColor = (category) => {
    switch (category) {
      case 'new': return '#95a5a6'
      case 'indeterminate': return '#f39c12'
      case 'done': return '#27ae60'
      default: return '#7f8c8d'
    }
  }

  const IssueCard = ({ issue }) => (
    <div className="kanban-card">
      <div className="card-header">
        <span className="card-key">{issue.key}</span>
        <span className={`card-priority priority-${issue.priority?.name.toLowerCase() || 'medium'}`}>
          {issue.priority?.name || 'Medium'}
        </span>
      </div>
      <h4 className="card-summary">{issue.summary}</h4>
      <div className="card-meta">
        <span className="card-type">{issue.issue_type?.name || 'N/A'}</span>
        {issue.assignee && (
          <span className="card-assignee">{issue.assignee.display_name}</span>
        )}
      </div>
      {issue.is_overdue && (
        <div className="card-overdue">ATRASADO</div>
      )}
      <div className="card-footer">
        {issue.due_date && (
          <span className="card-due">Vence: {new Date(issue.due_date).toLocaleDateString('pt-BR')}</span>
        )}
      </div>
    </div>
  )

  return (
    <div className="kanban-view">
      <h2>Kanban - Visão da Área</h2>

      <div className="kanban-board">
        {sortedColumns.map(column => (
          <div key={column.name} className="kanban-column">
            <div
              className="column-header"
              style={{ borderBottomColor: getStatusColor(column.category) }}
            >
              <h3 className="column-title">{column.name}</h3>
              <span className="column-count">{column.issues.length}</span>
            </div>
            <div className="column-content">
              {column.issues
                .sort((a, b) => {
                  // Priorizar atrasados, depois por prioridade
                  if (a.is_overdue && !b.is_overdue) return -1
                  if (!a.is_overdue && b.is_overdue) return 1

                  const priorityOrder = { 'highest': 0, 'high': 1, 'medium': 2, 'low': 3, 'lowest': 4 }
                  const prioA = priorityOrder[a.priority?.name?.toLowerCase()] ?? 2
                  const prioB = priorityOrder[b.priority?.name?.toLowerCase()] ?? 2
                  return prioA - prioB
                })
                .map(issue => (
                  <IssueCard key={issue.key} issue={issue} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}