import { useState, useMemo, useRef, useEffect } from 'react'
import './AIInsightsView.css'

// Renderiza resposta da IA: mistura parágrafos e bullet points
function renderAIAnswer(text) {
  const blocks = text.split(/\n{2,}/)
  return blocks.map((block, bi) => {
    const lines = block.split('\n').filter(l => l.trim() !== '')
    const isList = lines.every(l => /^[-•]\s/.test(l.trim()))
    if (isList) {
      return (
        <ul key={bi} className="ai-answer-list">
          {lines.map((l, li) => (
            <li key={li}>{l.replace(/^[-•]\s+/, '')}</li>
          ))}
        </ul>
      )
    }
    const parts = []
    let currentBullets = []
    for (const [li, line] of lines.entries()) {
      if (/^[-•]\s/.test(line.trim())) {
        currentBullets.push(line)
      } else {
        if (currentBullets.length) {
          parts.push(<ul key={`${bi}-ul-${li}`} className="ai-answer-list">{currentBullets.map((b, i) => <li key={i}>{b.replace(/^[-•]\s+/, '')}</li>)}</ul>)
          currentBullets = []
        }
        parts.push(<p key={`${bi}-p-${li}`} className="ai-answer-para">{line}</p>)
      }
    }
    if (currentBullets.length) {
      parts.push(<ul key={`${bi}-ul-end`} className="ai-answer-list">{currentBullets.map((b, i) => <li key={i}>{b.replace(/^[-•]\s+/, '')}</li>)}</ul>)
    }
    return <div key={bi}>{parts}</div>
  })
}

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:8000'
  const host = window.location.host.replace(':5173', ':8000').replace('-5173.', '-8000.')
  return `${window.location.protocol}//${host}`
}
const API = getApiUrl()

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

  for (const i of issues) {
    const parts = [`[${i.key}] ${i.summary}`]
    parts.push(`Resp:${i.assignee?.display_name || 'Não atribuído'}`)
    parts.push(`Status:${i.status?.name || '-'}`)
    parts.push(`Prio:${i.priority?.name || '-'}`)
    if (i.product)          parts.push(`Produto:${i.product}`)
    if (i.account)          parts.push(`Account:${i.account}`)
    if (i.issue_type?.name) parts.push(`Tipo:${i.issue_type.name}`)
    if (i.is_overdue)       parts.push('⚠ATRASADA')
    if (i.due_date)         parts.push(`Vence:${new Date(i.due_date).toLocaleDateString('pt-BR')}`)
    lines.push(parts.join(' | '))
  }

  lines.push('', `--- EQUIPE (${devs.length} devs) ---`)
  for (const d of devs) {
    const name = d.assignee?.display_name || 'Dev'
    const n    = d.active_issues?.length ?? 0
    const ov   = d.active_issues?.filter(i => i.is_overdue).length ?? 0
    lines.push(`${name}: ${n} issues${ov ? `, ${ov} atrasadas` : ''}`)
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
      const res = await fetch(`${API}/api/ai/chat`, {
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
    const typeMap = {}
    const devMap  = {}
    const prodMap = {}
    for (const i of issues) {
      const t = i.issue_type?.name || 'Outro'
      const a = i.assignee?.display_name || 'Não atribuído'
      const p = i.product || 'Sem produto'
      typeMap[t] = (typeMap[t] || 0) + 1
      devMap[a]  = (devMap[a]  || 0) + 1
      prodMap[p] = (prodMap[p] || 0) + 1
    }
    return {
      total:      issues.length,
      overdue:    issues.filter(i => i.is_overdue).length,
      inProgress: issues.filter(i => i.status?.category === 'indeterminate').length,
      topTypes:   Object.entries(typeMap).sort(([,a],[,b]) => b-a).slice(0, 5),
      topDevs:    Object.entries(devMap).sort(([,a],[,b])  => b-a).slice(0, 5),
      topProds:   Object.entries(prodMap).sort(([,a],[,b]) => b-a).slice(0, 5),
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
                  <div className="ai-answer-text">
                    {renderAIAnswer(item.answer)}
                  </div>
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
          {stats.topTypes.map(([t, c]) => (
            <div key={t} className="ai-list-row">
              <span className="ai-list-name">{t}</span>
              <span className="ai-count-badge">{c}</span>
            </div>
          ))}
        </div>

        <div className="ai-card">
          <div className="ai-card-title">Issues por Dev</div>
          {stats.topDevs.map(([d, c]) => (
            <div key={d} className="ai-list-row">
              <span className="ai-list-name">{d}</span>
              <span className="ai-count-badge">{c}</span>
            </div>
          ))}
        </div>

        <div className="ai-card">
          <div className="ai-card-title">Issues por Produto</div>
          {stats.topProds.map(([p, c]) => (
            <div key={p} className="ai-list-row">
              <span className="ai-list-name">{p}</span>
              <span className="ai-count-badge">{c}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
