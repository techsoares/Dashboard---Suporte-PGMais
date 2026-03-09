import { useState } from 'react'
import './AIInsightsView.css'

export default function AIInsightsView({ data }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')

  // Análise básica dos dados
  const analyzeData = () => {
    const issues = data.backlog
    const totalIssues = issues.length
    const overdueIssues = issues.filter(i => i.is_overdue).length
    const inProgressIssues = issues.filter(i => i.status.category === 'indeterminate').length

    const typeGroups = issues.reduce((acc, issue) => {
      const type = issue.issue_type.name
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    const assigneeGroups = issues.reduce((acc, issue) => {
      const assignee = issue.assignee?.display_name || 'Não atribuído'
      acc[assignee] = (acc[assignee] || 0) + 1
      return acc
    }, {})

    return {
      totalIssues,
      overdueIssues,
      inProgressIssues,
      typeGroups,
      assigneeGroups,
      topTypes: Object.entries(typeGroups).sort(([,a], [,b]) => b - a).slice(0, 3),
      busiestDevs: Object.entries(assigneeGroups).sort(([,a], [,b]) => b - a).slice(0, 3)
    }
  }

  const analysis = analyzeData()

  const handleQuestion = () => {
    if (!question.trim()) return

    let response = ''

    const q = question.toLowerCase()

    if (q.includes('quantas') && q.includes('tarefas')) {
      response = `Há um total de ${analysis.totalIssues} tarefas no backlog.`
    } else if (q.includes('atraso') || q.includes('overdue')) {
      response = `Há ${analysis.overdueIssues} tarefas em atraso (${((analysis.overdueIssues / analysis.totalIssues) * 100).toFixed(1)}% do total).`
    } else if (q.includes('andamento') || q.includes('progress')) {
      response = `Há ${analysis.inProgressIssues} tarefas em andamento.`
    } else if (q.includes('tipo') || q.includes('tipos')) {
      const topTypes = analysis.topTypes.map(([type, count]) => `${type}: ${count}`).join(', ')
      response = `Os tipos mais comuns são: ${topTypes}.`
    } else if (q.includes('desenvolvedor') || q.includes('dev') || q.includes('responsável')) {
      const busiest = analysis.busiestDevs.map(([dev, count]) => `${dev}: ${count}`).join(', ')
      response = `Os desenvolvedores com mais tarefas são: ${busiest}.`
    } else {
      response = 'Desculpe, não entendi a pergunta. Tente perguntar sobre quantidade de tarefas, atrasos, tipos ou responsáveis.'
    }

    setAnswer(response)
  }

  return (
    <div className="ai-insights-view">
      <h2>IA Insights - Análise Inteligente</h2>

      <div className="insights-grid">
        <div className="insight-card">
          <h3>Resumo Geral</h3>
          <div className="stats">
            <div className="stat">
              <span className="stat-value">{analysis.totalIssues}</span>
              <span className="stat-label">Total de Tarefas</span>
            </div>
            <div className="stat">
              <span className="stat-value">{analysis.overdueIssues}</span>
              <span className="stat-label">Em Atraso</span>
            </div>
            <div className="stat">
              <span className="stat-value">{analysis.inProgressIssues}</span>
              <span className="stat-label">Em Andamento</span>
            </div>
          </div>
        </div>

        <div className="insight-card">
          <h3>Top Tipos de Tarefa</h3>
          <ul className="type-list">
            {analysis.topTypes.map(([type, count]) => (
              <li key={type}>
                <span className="type-name">{type}</span>
                <span className="type-count">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="insight-card">
          <h3>Desenvolvedores Mais Ocupados</h3>
          <ul className="dev-list">
            {analysis.busiestDevs.map(([dev, count]) => (
              <li key={dev}>
                <span className="dev-name">{dev}</span>
                <span className="dev-count">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="ai-chat">
        <h3>Pergunte à IA</h3>
        <div className="chat-container">
          <div className="question-input">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex: Quantas tarefas estão em atraso?"
              onKeyPress={(e) => e.key === 'Enter' && handleQuestion()}
            />
            <button onClick={handleQuestion}>Perguntar</button>
          </div>
          {answer && (
            <div className="answer-output">
              <strong>Resposta:</strong> {answer}
            </div>
          )}
        </div>
        <div className="suggestions">
          <p>Sugestões de perguntas:</p>
          <div className="suggestion-buttons">
            <button onClick={() => { setQuestion('Quantas tarefas estão em atraso?'); handleQuestion(); }}>
              Quantas tarefas em atraso?
            </button>
            <button onClick={() => { setQuestion('Quais são os tipos mais comuns?'); handleQuestion(); }}>
              Tipos mais comuns
            </button>
            <button onClick={() => { setQuestion('Quem tem mais tarefas?'); handleQuestion(); }}>
              Desenvolvedores mais ocupados
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}