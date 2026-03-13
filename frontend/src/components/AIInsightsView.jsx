import { useState, useMemo, useRef, useEffect } from 'react'
import { API_BASE_URL } from '../apiUrl'
import './AIInsightsView.css'

const SUGGESTIONS = [
  'Qual o estado geral do backlog agora?',
  'Quais são os principais riscos para o negócio?',
  'Qual o próximo jira para atender e por quê?',
  'Quais jiras críticos estão parados sem responsável?',
  'O backlog está saudável? O que precisa de atenção?',
  'Quem está mais sobrecarregado no time?',
]

function buildContext(data) {
  if (!data) return ''
  const issues = data.backlog || []
  const devs   = data.devs   || []
  const kpis   = data.kpis   || {}
  const today  = new Date().toLocaleDateString('pt-BR')

  const lines = [
    `=== DASHBOARD JIRA PGMais (${today}) ===`,
    `Issues ativas: ${issues.length}`,
    `Em atraso: ${issues.filter(i => i.is_overdue).length}`,
    `Em andamento: ${issues.filter(i => i.status?.category === 'indeterminate').length}`,
    `Aguardando: ${issues.filter(i => i.status?.name?.toLowerCase().includes('aguard')).length}`,
    `Concluídas esta semana: ${kpis.done_this_week ?? 0}`,
    '',
    `--- BACKLOG COMPLETO (${issues.length} issues) ---`,
  ]

  for (const issue of issues) {
    const parts = [`[${issue.key}] ${issue.summary}`]
    parts.push(`Resp:${issue.assignee?.display_name || 'Não atribuído'}`)
    parts.push(`Status:${issue.status?.name || '-'}`)
    parts.push(`Prio:${issue.priority?.name || '-'}`)
    if (issue.product)          parts.push(`Produto:${issue.product}`)
    if (issue.account)          parts.push(`Account:${issue.account}`)
    if (issue.issue_type?.name) parts.push(`Tipo:${issue.issue_type.name}`)
    if (issue.is_overdue)       parts.push('⚠ATRASADA')
    if (issue.due_date)         parts.push(`Vence:${new Date(issue.due_date).toLocaleDateString('pt-BR')}`)
    lines.push(parts.join(' | '))
  }

  lines.push('', `--- EQUIPE (${devs.length} devs) ---`)
  for (const dev of devs) {
    const devName    = dev.assignee?.display_name || 'Dev'
    const issueCount = dev.active_issues?.length ?? 0
    const overdueCount = dev.active_issues?.filter(issue => issue.is_overdue).length ?? 0
    lines.push(`${devName}: ${issueCount} issues${overdueCount ? `, ${overdueCount} atrasadas` : ''}`)
  }

  return lines.join('\n')
}

export default function AIInsightsView({ data }) {
  const [question,   setQuestion]   = useState('')
  const [history,    setHistory]    = useState([])   // [{question, answer}]
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const chatEndRef = useRef(null)
  const inputRef   = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  const askAI = async (q) => {
    const text = (q ?? question).trim()
    if (!text || loading) return
    setError('')
    setLoading(true)

    // Inclui histórico recente para contexto de conversa (últimas 3 trocas)
    const recentHistory = history.slice(-3).map(h =>
      `Pergunta anterior: ${h.question}\nResposta anterior: ${h.answer}`
    ).join('\n\n')

    const ctx = buildContext(data) + (recentHistory ? `\n\n--- HISTÓRICO RECENTE ---\n${recentHistory}` : '')

    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: text, context: ctx }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.detail || 'Erro ao consultar a IA.')
      } else {
        setHistory(prev => [...prev, { question: text, answer: json.answer }])
        setQuestion('')
        inputRef.current?.focus()
      }
    } catch {
      setError('Não foi possível conectar ao servidor. Verifique se o backend está rodando.')
    } finally {
      setLoading(false)
    }
  }

  // Stats locais para os cards informativos
  const stats = useMemo(() => {
    const issues = data?.backlog || []
    const countByType    = {}
    const countByDev     = {}
    const countByProduct = {}
    for (const issue of issues) {
      const typeName    = issue.issue_type?.name || 'Outro'
      const assigneeName = issue.assignee?.display_name || 'Não atribuído'
      const productName = issue.product || 'Sem produto'
      countByType[typeName]       = (countByType[typeName] || 0) + 1
      countByDev[assigneeName]    = (countByDev[assigneeName] || 0) + 1
      countByProduct[productName] = (countByProduct[productName] || 0) + 1
    }
    const sortDescByCount = ([, countA], [, countB]) => countB - countA
    return {
      total:      issues.length,
      overdue:    issues.filter(issue => issue.is_overdue).length,
      inProgress: issues.filter(issue => issue.status?.category === 'indeterminate').length,
      topTypes:   Object.entries(countByType).sort(sortDescByCount).slice(0, 5),
      topDevs:    Object.entries(countByDev).sort(sortDescByCount).slice(0, 5),
      topProds:   Object.entries(countByProduct).sort(sortDescByCount).slice(0, 5),
    }
  }, [data])

  return (
    <div className="ai-root">

      <div className="ai-page-header">
        <h2>IA Insights</h2>
        <span className="ai-badge">✦ Claude Sonnet 4.6</span>
      </div>

      {/* ── CHAT (TOPO) ────────────────────────────────────────── */}
      <div className="ai-chat-panel">
        <div className="ai-chat-heading">
          <span className="ai-chat-title">Pergunte à IA</span>
          <span className="ai-chat-sub">
            A IA tem acesso completo ao escopo dos jiras em backlog, pergunte qualquer coisa.
          </span>
        </div>

        {/* Histórico de conversa */}
        {(history.length > 0 || loading) && (
          <div className="ai-history">
            {history.map((item, idx) => (
              <div key={idx} className="ai-exchange">
                <div className="ai-bubble ai-bubble--user">
                  <span className="ai-bubble-who">Você</span>
                  {item.question}
                </div>
                <div className="ai-bubble ai-bubble--ai">
                  <span className="ai-bubble-who">✦ IA</span>
                  <span className="ai-answer-text">
                    {item.answer.split('\n').map((line, lineIndex) =>
                      line.trim() === ''
                        ? <br key={lineIndex} />
                        : <span key={lineIndex} className="ai-answer-line">{line}</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-exchange">
                <div className="ai-bubble ai-bubble--user">
                  <span className="ai-bubble-who">Você</span>
                  {question}
                </div>
                <div className="ai-bubble ai-bubble--ai ai-bubble--typing">
                  <span className="ai-bubble-who">✦ IA</span>
                  <span className="ai-dots"><span /><span /><span /></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Input */}
        <div className="ai-input-row">
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Ex: Quais issues estão atrasadas? Quem está mais sobrecarregado?"
            onKeyDown={e => e.key === 'Enter' && askAI()}
            disabled={loading}
            autoFocus
          />
          <button
            className="ai-send-btn"
            onClick={() => askAI()}
            disabled={loading || !question.trim()}
          >
            {loading ? <span className="ai-send-spinner" /> : 'Enviar'}
          </button>
        </div>

        {error && (
          <div className="ai-error-msg">
            <strong>⚠ </strong>{error}
          </div>
        )}

        {/* Sugestões — visíveis enquanto sem histórico */}
        {history.length === 0 && !loading && (
          <div className="ai-suggestions">
            <p>Sugestões para começar:</p>
            <div className="ai-suggestion-list">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setQuestion(s); askAI(s) }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Nova conversa */}
        {history.length > 0 && (
          <button className="ai-clear-btn" onClick={() => { setHistory([]); setError('') }}>
            ↺ Nova conversa
          </button>
        )}
      </div>

      {/* ── STATS CARDS ─────────────────────────────────────────── */}
      <div className="ai-cards-grid">

        <div className="ai-card">
          <div className="ai-card-title">Visão Geral</div>
          <div className="ai-kpi-row">
            <div className="ai-kpi">
              <span className="ai-kpi-num">{stats.total}</span>
              <span className="ai-kpi-lbl">Total</span>
            </div>
            <div className="ai-kpi">
              <span className="ai-kpi-num ai-kpi--overdue">{stats.overdue}</span>
              <span className="ai-kpi-lbl">Atrasadas</span>
            </div>
            <div className="ai-kpi">
              <span className="ai-kpi-num ai-kpi--blue">{stats.inProgress}</span>
              <span className="ai-kpi-lbl">Em andamento</span>
            </div>
          </div>
        </div>

        <div className="ai-card">
          <div className="ai-card-title">Tipos de Issue</div>
          {stats.topTypes.map(([typeName, count]) => (
            <div key={typeName} className="ai-list-row">
              <span className="ai-list-name">{typeName}</span>
              <span className="ai-count-badge">{count}</span>
            </div>
          ))}
        </div>

        <div className="ai-card">
          <div className="ai-card-title">Issues por Dev</div>
          {stats.topDevs.map(([devName, count]) => (
            <div key={devName} className="ai-list-row">
              <span className="ai-list-name">{devName}</span>
              <span className="ai-count-badge">{count}</span>
            </div>
          ))}
        </div>

        <div className="ai-card">
          <div className="ai-card-title">Issues por Produto</div>
          {stats.topProds.map(([productName, count]) => (
            <div key={productName} className="ai-list-row">
              <span className="ai-list-name">{productName}</span>
              <span className="ai-count-badge">{count}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
