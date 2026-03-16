import { useState, useRef, useEffect } from 'react'
import { API_BASE_URL } from '../apiUrl'
import './AIAssistantCollapsible.css'

export default function AIAssistantCollapsible({ data, user }) {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [error, setError] = useState(null)
  const chatEndRef = useRef(null)

  // Scroll to bottom when answer loads
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [answer])

  // Enviar pergunta para IA
  const handleAskQuestion = async (e) => {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    setError(null)
    setAnswer(null)

    try {
      // Preparar contexto das issues ativas
      const context = prepareContext()

      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          question: question.trim(),
          context: context
        })
      })

      if (!res.ok) {
        throw new Error(`Erro ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      setAnswer(data.answer || 'Sem resposta')
      setQuestion('')
    } catch (err) {
      console.error('Erro ao consultar IA:', err)
      setError(err.message || 'Erro ao consultar IA')
    } finally {
      setLoading(false)
    }
  }

  // Preparar contexto com informações da fila ATUAL + HISTÓRICO COMPLETO
  const prepareContext = () => {
    if (!data) return 'Sem dados disponíveis'

    // FILA ATUAL
    const activeIssues = data.backlog || []
    const totalActive = activeIssues.length
    const totalDevs = (data.devs || []).length
    const overdueIssues = activeIssues.filter(i => i.is_overdue)
    const topIssues = activeIssues.slice(0, 5)

    // HISTÓRICO COMPLETO: esta semana + mês anterior
    const doneThisWeek = data.done_issues || []
    const doneHistorical = data.done_issues_historical || []
    const allDoneIssues = [...doneThisWeek, ...doneHistorical]
    
    const totalDone = allDoneIssues.length
    const avgResolutionHours = data.kpis?.avg_resolution_time_hours || 0
    const doneThisWeekCount = data.kpis?.done_this_week || 0
    
    // Calcular estatísticas do histórico COMPLETO
    const doneByPriority = {
      Highest: allDoneIssues.filter(i => i.priority?.name === 'Highest').length,
      High: allDoneIssues.filter(i => i.priority?.name === 'High').length,
      Medium: allDoneIssues.filter(i => i.priority?.name === 'Medium').length,
      Low: allDoneIssues.filter(i => i.priority?.name === 'Low').length,
    }

    const priorityDistribution = activeIssues.reduce((acc, issue) => {
      const prio = issue.priority?.name || 'Normal'
      acc[prio] = (acc[prio] || 0) + 1
      return acc
    }, {})

    // Calcular velocidade e projeções
    const burnRate = avgResolutionHours > 0 ? (1 / avgResolutionHours).toFixed(2) : 0
    const estimatedDaysToEmpty = totalActive > 0 && doneThisWeekCount > 0 ? (totalActive / doneThisWeekCount * 7).toFixed(1) : 'N/A'
    
    // Estatísticas de qualidade
    const onTimeCount = allDoneIssues.filter(i => !i.is_overdue).length
    const lateCount = allDoneIssues.filter(i => i.is_overdue).length
    const qualityRate = totalDone > 0 ? ((onTimeCount / totalDone) * 100).toFixed(1) : 'N/A'

    // Construir lista de top issues
    const topIssuesList = topIssues.map((issue, idx) => {
      const overdue = issue.is_overdue ? ' [OVERDUE]' : ''
      const line1 = `  ${idx + 1}. [${issue.key}] ${issue.summary}`
      const line2 = `     Prioridade: ${issue.priority?.name || 'Normal'} | Responsavel: ${issue.assignee?.display_name || 'Sem atribuicao'}${overdue}`
      return line1 + '\n' + line2
    }).join('\n')

    // Construir distribuição
    const prioDistStr = Object.entries(priorityDistribution).map(([p, c]) => `${p}: ${c}`).join(', ')

    const summary = `
======================================================================
                   ASSISTENTE IA - CONTEXTO COMPLETO
======================================================================

FILA ATUAL (TEMPO REAL):
  + Total de demandas pendentes: ${totalActive}
  + Demandas ATRASADAS (URGENTE): ${overdueIssues.length}
  + Desenvolvedores ativos: ${totalDevs}
  + Distribuicao por prioridade: ${prioDistStr}

TOP 5 DEMANDAS PRIORITARIAS:
${topIssuesList}

HISTORICO CONSOLIDADO (ULTIMAS 4 SEMANAS + SEMANA ATUAL):
  + Total de demandas concluidas: ${totalDone}
    - Esta semana: ${doneThisWeekCount}
    - Mês anterior: ${doneHistorical.length}
  + Taxa de qualidade (no prazo): ${qualityRate}%
  + Demandas em atraso (historico): ${lateCount}
  + Tempo medio de resolucao: ${Math.round(avgResolutionHours)}h
  + Burn rate (demandas/hora): ${burnRate}
  + Distribuicao pelos ultimos ~30 dias:
    - Highest: ${doneByPriority.Highest}
    - High: ${doneByPriority.High}
    - Medium: ${doneByPriority.Medium}
    - Low: ${doneByPriority.Low}

PROJECOES:
  + Estimativa para fila atual: ${estimatedDaysToEmpty} dias (se mantiver velocidade)
  + Capacidade media: ~${doneThisWeekCount} demandas/semana
  + Velocidade de resolucao: ${burnRate} dem/hora

Pergunta do usuario: ${question}
    `.trim()

    return summary
  }

  // Templates de perguntas rápidas (agora com foco em análise + histórico)
  const quickQuestions = [
    '📊 Qual é a próxima prioridade e por quê?',
    '⚠️ Há risco de quebra de SLA?',
    '📈 Qual é a velocidade de resolução?',
    '🔴 O que está atrasado e qual o impacto?',
    '💡 Recomendações para melhorar a fila?'
  ]

  return (
    <div className={`ai-assistant-collapsible ${isOpen ? 'open' : 'closed'}`}>
      {/* Botão flutuante */}
      <button
        className="ai-assistant-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Fechar assistente de IA' : 'Abrir assistente de IA'}
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {/* Painel recolhível */}
      {isOpen && (
        <div className="ai-assistant-panel">
          <div className="ai-assistant-header">
            <h3>Assistente IA</h3>
            <p className="ai-assistant-subtitle">Análise completa: fila atual + histórico de performance</p>
          </div>

          {/* Chat Area */}
          <div className="ai-assistant-chat">
            {/* Perguntas rápidas */}
            {!answer && !question && (
              <div className="ai-assistant-quick">
                <p className="ai-assistant-quick-title">Perguntas rápidas:</p>
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    className="ai-assistant-quick-btn"
                    onClick={() => {
                      setQuestion(q)
                      // Simular envio automático
                      setTimeout(() => {
                        const form = document.querySelector('.ai-assistant-form')
                        if (form) form.dispatchEvent(new Event('submit', { bubbles: true }))
                      }, 100)
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Resposta anterior */}
            {answer && (
              <div className="ai-assistant-response">
                <div className="ai-assistant-response-label">Resposta da IA:</div>
                <div className="ai-assistant-response-text">
                  {answer.split('\n').map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
                <button
                  className="ai-assistant-new-question"
                  onClick={() => {
                    setAnswer(null)
                    setQuestion('')
                  }}
                >
                  Fazer outra pergunta
                </button>
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="ai-assistant-error">
                <strong>❌ Erro:</strong> {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="ai-assistant-loading">
                <div className="ai-assistant-spinner"></div>
                <span>Consultando IA...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Form */}
          {!answer && (
            <form className="ai-assistant-form" onSubmit={handleAskQuestion}>
              <div className="ai-assistant-input-group">
                <input
                  type="text"
                  className="ai-assistant-input"
                  placeholder="Faça uma pergunta sobre a fila..."
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="ai-assistant-send"
                  disabled={loading || !question.trim()}
                >
                  {loading ? '...' : '→'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
