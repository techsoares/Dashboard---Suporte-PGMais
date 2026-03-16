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

  // Preparar contexto com informações da fila
  const prepareContext = () => {
    if (!data) return 'Sem dados disponíveis'

    const totalIssues = (data.backlog || []).length
    const totalDevs = (data.devs || []).length
    const topIssues = (data.backlog || []).slice(0, 5)

    const summary = `
FILA DE ATENDIMENTO ATUAL:
- Total de demandas pendentes: ${totalIssues}
- Desenvolvedores atuais: ${totalDevs}
- Demandas atrasadas (overdue): ${(data.backlog || []).filter(i => i.is_overdue).length}

TOP 5 DEMANDAS PRIORITÁRIAS:
${topIssues.map((issue, idx) => `${idx + 1}. [${issue.key}] ${issue.summary} (${issue.priority?.name || 'Normal'}) - Responsável: ${issue.assignee?.display_name || 'Não atribuído'}`).join('\n')}

KPIs:
- Concluídas esta semana: ${data.kpis?.done_this_week || 0}
- Tempo médio de resolução: ${data.kpis?.avg_resolution_time_hours ? Math.round(data.kpis.avg_resolution_time_hours) + 'h' : 'N/A'}

Pergunta do usuário: ${question}
    `.trim()

    return summary
  }

  // Templates de perguntas rápidas
  const quickQuestions = [
    'Qual é a próxima demanda prioritária?',
    'Quais demandas estão atrasadas?',
    'Qual é o status geral da fila?',
    'Quantas demandas foram concluídas esta semana?',
    'Há algum risco de SLA?'
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
            <p className="ai-assistant-subtitle">Tire dúvidas sobre a fila de atendimento</p>
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
