import { useState, useEffect, useMemo, useCallback } from 'react'
import './PrioritizationView.css'

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    return 'http://localhost:8000'
  const host = window.location.host.replace(':5173', ':8000').replace('-5173.', '-8000.')
  return `${window.location.protocol}//${host}`
}
const API = getApiUrl()

const SCORE_WEIGHTS = {
  production:  1000,
  incident:     500,
  problem:      300,
  topAccount:    40,   // multiplied by (11 - rank)
  agePerDay:      3,
  ageCap:       200,
}

// Normalize: remove accents, lowercase, strip extra spaces
function norm(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// Find the ranking index for a Jira account using fuzzy matching
// Rules: case-insensitive, accent-insensitive, partial contains in both directions
function findRankIndex(account, ranking) {
  if (!account) return -1
  const a = norm(account)
  for (let i = 0; i < ranking.length; i++) {
    const r = norm(ranking[i])
    // Exact normalized match
    if (a === r) return i
    // One contains the other (handles "99Pay" ↔ "99 PAY", "FRANQUIAS BOTICARIO [S]" ↔ "EUDORA / BOTICÁRIO")
    // Split ranking entry by / to check each part (e.g. "EUDORA / BOTICÁRIO" → ["eudora", "boticario"])
    const rParts = r.split(/[\s\/]+/).filter(p => p.length > 2)
    const aParts = a.split(/[\s\/\[\]]+/).filter(p => p.length > 2)
    // Check if any significant word from ranking appears in the account or vice versa
    if (rParts.some(rp => a.includes(rp)) || aParts.some(ap => r.includes(ap))) return i
  }
  return -1
}

// Check if account matches any of the top N ranked accounts
function isInTopAccounts(account, ranking, n) {
  return findRankIndex(account, ranking.slice(0, n)) >= 0
}

function calcScore(issue, ranking, productionKeys) {
  let score = 0

  // 1. Production affected
  if (productionKeys.includes(issue.key)) score += SCORE_WEIGHTS.production

  // 2. Issue type (PT: incidente/problema, EN: incident/problem, ou reclassificado como bug)
  const typeName = (issue.issue_type?.name || '').toLowerCase()
  const isIncident = ['incident', 'incidente', 'bug'].includes(typeName)
  const isProblem  = ['problem', 'problema'].includes(typeName)
  if (isIncident) score += SCORE_WEIGHTS.incident
  else if (isProblem) score += SCORE_WEIGHTS.problem

  // 3. Account in top 10 (fuzzy match)
  const accountIdx = findRankIndex(issue.account, ranking)
  if (accountIdx >= 0 && accountIdx < 10) {
    score += (11 - (accountIdx + 1)) * SCORE_WEIGHTS.topAccount
  }

  // 4. Age (days since creation)
  if (issue.created) {
    const age = Math.floor((Date.now() - new Date(issue.created).getTime()) / 86400000)
    score += Math.min(age * SCORE_WEIGHTS.agePerDay, SCORE_WEIGHTS.ageCap)
  }

  return score
}

function fmtAge(created) {
  if (!created) return '—'
  const days = Math.floor((Date.now() - new Date(created).getTime()) / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return '1 dia'
  return `${days} dias`
}

function isIncidentType(t) { return ['incident', 'incidente', 'bug'].includes((t || '').toLowerCase()) }
function isProblemType(t)  { return ['problem', 'problema'].includes((t || '').toLowerCase()) }

function TypeBadge({ type }) {
  const color = isIncidentType(type) ? 'var(--rosa)' : isProblemType(type) ? 'var(--amarelo)' : 'var(--text-muted)'
  const label = isIncidentType(type) ? 'Incidente' : isProblemType(type) ? 'Problema' : type || '—'
  return (
    <span className="prio-type-badge" style={{ borderColor: color, color }}>
      {label}
    </span>
  )
}

export default function PrioritizationView({ data }) {
  const [ranking, setRanking]               = useState([])
  const [productionKeys, setProductionKeys] = useState([])
  const [classifying, setClassifying]       = useState(false)
  const [savingRank, setSavingRank]         = useState(false)
  const [filterTopOnly, setFilterTopOnly]   = useState(false)
  const [activeFilter, setActiveFilter]     = useState(null)   // null|'all'|'production'|'incident'|'problem'
  const [expandedKey, setExpandedKey]       = useState(null)
  const [summaries, setSummaries]           = useState({})      // { issueKey: { loading, text, error } }

  // All unique accounts from data
  const allAccounts = useMemo(() => {
    if (!data?.backlog) return []
    const set = new Set()
    data.backlog.forEach(i => { if (i.account) set.add(i.account) })
    data.devs?.forEach(d => d.active_issues?.forEach(i => { if (i.account) set.add(i.account) }))
    return [...set].sort()
  }, [data])

  // Load ranking
  useEffect(() => {
    fetch(`${API}/api/admin/account-ranking`)
      .then(r => r.json())
      .then(r => setRanking(Array.isArray(r) ? r : []))
      .catch(() => {})
  }, [])

  // Classify production via AI
  const classifyProduction = useCallback(() => {
    if (!data?.backlog?.length) return
    setClassifying(true)
    const issues = data.backlog.map(i => ({
      key: i.key,
      summary: i.summary,
      type: i.issue_type?.name || '',
      status: i.status?.name || '',
    }))
    fetch(`${API}/api/ai/classify-production`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issues }),
    })
      .then(r => r.json())
      .then(r => setProductionKeys(r.production_affected || []))
      .catch(() => {})
      .finally(() => setClassifying(false))
  }, [data])

  useEffect(() => { classifyProduction() }, [classifyProduction])

  // Save ranking
  const saveRanking = async (newRanking) => {
    setRanking(newRanking)
    setSavingRank(true)
    try {
      await fetch(`${API}/api/admin/account-ranking`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: newRanking }),
      })
    } catch {}
    setSavingRank(false)
  }

  const moveAccount = (account, direction) => {
    const idx = ranking.indexOf(account)
    // If not in ranking yet, add at end
    if (idx === -1) {
      saveRanking([...ranking, account])
      return
    }
    const newRanking = [...ranking]
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= newRanking.length) return
    ;[newRanking[idx], newRanking[newIdx]] = [newRanking[newIdx], newRanking[idx]]
    saveRanking(newRanking)
  }

  const addToRanking = (account) => {
    if (ranking.includes(account)) return
    saveRanking([...ranking, account])
  }

  const removeFromRanking = (account) => {
    saveRanking(ranking.filter(a => a !== account))
  }

  // Compute prioritized list
  const prioritized = useMemo(() => {
    if (!data?.backlog) return []
    let issues = data.backlog.map(i => ({
      ...i,
      score: calcScore(i, ranking, productionKeys),
      isProduction: productionKeys.includes(i.key),
      accountRank: findRankIndex(i.account, ranking),
    }))
    if (filterTopOnly) {
      issues = issues.filter(i => isInTopAccounts(i.account, ranking, 10))
    }
    return issues.sort((a, b) => b.score - a.score)
  }, [data, ranking, productionKeys, filterTopOnly])

  // Stats
  const stats = useMemo(() => ({
    total: prioritized.length,
    incidents: prioritized.filter(i => isIncidentType(i.issue_type?.name)).length,
    problems: prioritized.filter(i => isProblemType(i.issue_type?.name)).length,
    production: prioritized.filter(i => i.isProduction).length,
  }), [prioritized])

  // AI summary for an issue
  const fetchSummary = useCallback((issue) => {
    if (summaries[issue.key]?.text || summaries[issue.key]?.loading) return
    setSummaries(prev => ({ ...prev, [issue.key]: { loading: true, text: '', error: false } }))
    const question = `Resuma em 2-3 frases curtas o chamado Jira abaixo. Seja direto: o que aconteceu, impacto e status atual.\n\nChave: ${issue.key}\nTítulo: ${issue.summary}\nTipo: ${issue.issue_type?.name || '—'}\nStatus: ${issue.status?.name || '—'}\nAccount: ${issue.account || '—'}\nResponsável: ${issue.assignee?.display_name || 'Não atribuído'}\nCriado: ${issue.created || '—'}`
    fetch(`${API}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
      .then(r => r.json())
      .then(r => setSummaries(prev => ({ ...prev, [issue.key]: { loading: false, text: r.answer || 'Sem resposta.', error: false } })))
      .catch(() => setSummaries(prev => ({ ...prev, [issue.key]: { loading: false, text: '', error: true } })))
  }, [summaries])

  const toggleExpand = useCallback((e, issue) => {
    e.preventDefault()
    e.stopPropagation()
    if (expandedKey === issue.key) {
      setExpandedKey(null)
    } else {
      setExpandedKey(issue.key)
      fetchSummary(issue)
    }
  }, [expandedKey, fetchSummary])

  // Filter by stat pill
  const displayList = useMemo(() => {
    if (!activeFilter) return prioritized
    switch (activeFilter) {
      case 'production': return prioritized.filter(i => i.isProduction)
      case 'incident':   return prioritized.filter(i => isIncidentType(i.issue_type?.name))
      case 'problem':    return prioritized.filter(i => isProblemType(i.issue_type?.name))
      default:           return prioritized
    }
  }, [prioritized, activeFilter])

  // Accounts NOT in ranking (using fuzzy match)
  const unrankedAccounts = allAccounts.filter(a => findRankIndex(a, ranking) === -1)

  return (
    <div className="prio-root">
      <div className="prio-header">
        <div>
          <h2 className="prio-title">Priorização de Demandas</h2>
          <p className="prio-subtitle">Ordenação inteligente baseada em faturamento, tipo, produção e idade</p>
        </div>
        <div className="prio-header-actions">
          <button
            className={`prio-filter-btn ${filterTopOnly ? 'active' : ''}`}
            onClick={() => setFilterTopOnly(v => !v)}
          >
            {filterTopOnly ? 'Mostrando Top 10' : 'Todos accounts'}
          </button>
          <button
            className="prio-classify-btn"
            onClick={classifyProduction}
            disabled={classifying}
          >
            {classifying ? 'Analisando...' : '✦ Reclassificar produção'}
          </button>
        </div>
      </div>

      {/* Stats — clickable filters */}
      <div className="prio-stats-row">
        <button className={`prio-stat ${activeFilter === null ? 'prio-stat--active' : ''}`} onClick={() => setActiveFilter(activeFilter === null ? null : null)}>
          <span className="prio-stat-value">{stats.total}</span>
          <span className="prio-stat-label">na fila</span>
        </button>
        <button className={`prio-stat prio-stat--danger ${activeFilter === 'production' ? 'prio-stat--active' : ''}`} onClick={() => setActiveFilter(v => v === 'production' ? null : 'production')}>
          <span className="prio-stat-value">{stats.production}</span>
          <span className="prio-stat-label">produção afetada</span>
        </button>
        <button className={`prio-stat prio-stat--incident ${activeFilter === 'incident' ? 'prio-stat--active' : ''}`} onClick={() => setActiveFilter(v => v === 'incident' ? null : 'incident')}>
          <span className="prio-stat-value">{stats.incidents}</span>
          <span className="prio-stat-label">incidentes</span>
        </button>
        <button className={`prio-stat prio-stat--problem ${activeFilter === 'problem' ? 'prio-stat--active' : ''}`} onClick={() => setActiveFilter(v => v === 'problem' ? null : 'problem')}>
          <span className="prio-stat-value">{stats.problems}</span>
          <span className="prio-stat-label">problemas</span>
        </button>
      </div>

      <div className="prio-body">
        {/* Main: Prioritized list */}
        <div className="prio-list-panel">
          <div className="prio-list-header">
            <span className="prio-list-title">Ordem de Atendimento</span>
            {classifying && <span className="prio-classifying">IA analisando...</span>}
          </div>

          {displayList.length === 0 ? (
            <p className="prio-empty">Nenhum chamado no backlog.</p>
          ) : (
            <div className="prio-list">
              {displayList.map((issue, idx) => {
                const isTopAccount = issue.accountRank >= 0 && issue.accountRank < 10
                const isExpanded = expandedKey === issue.key
                const summary = summaries[issue.key]
                return (
                  <div key={issue.key} className="prio-item-wrapper">
                    <a
                      href={issue.jira_url}
                      target="_blank"
                      rel="noreferrer"
                      className={`prio-item ${idx === 0 ? 'prio-item--next' : ''} ${issue.isProduction ? 'prio-item--production' : ''}`}
                    >
                      <span className="prio-rank">#{idx + 1}</span>
                      <div className="prio-item-main">
                        <div className="prio-item-top">
                          <span className="prio-key">{issue.key}</span>
                          <TypeBadge type={issue.issue_type?.name} />
                          {issue.isProduction && (
                            <span className="prio-prod-flag">PRODUÇÃO</span>
                          )}
                          {isTopAccount && (
                            <span className="prio-top-badge">Top {issue.accountRank + 1}</span>
                          )}
                        </div>
                        <span className="prio-summary">{issue.summary}</span>
                        <div className="prio-item-meta">
                          <span className="prio-account">{issue.account || '—'}</span>
                          <span className="prio-assignee">{issue.assignee?.display_name || 'Não atribuído'}</span>
                          <span className="prio-age">{fmtAge(issue.created)}</span>
                          <span className="prio-score">Score: {issue.score}</span>
                        </div>
                      </div>
                      <button
                        className={`prio-expand-btn ${isExpanded ? 'prio-expand-btn--open' : ''}`}
                        onClick={(e) => toggleExpand(e, issue)}
                        title="Resumo IA"
                      >
                        {summary?.loading ? '...' : isExpanded ? '−' : '+'}
                      </button>
                    </a>
                    {isExpanded && (
                      <div className="prio-ai-summary">
                        {summary?.loading && <span className="prio-ai-loading">IA analisando...</span>}
                        {summary?.error && <span className="prio-ai-error">Erro ao gerar resumo.</span>}
                        {summary?.text && <p className="prio-ai-text">{summary.text}</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar: Account Ranking */}
        <div className="prio-ranking-panel">
          <div className="prio-ranking-header">
            <span className="prio-ranking-title">Ranking de Faturamento</span>
            {savingRank && <span className="prio-saving">salvando...</span>}
          </div>

          {ranking.length > 0 && (
            <div className="prio-ranking-list">
              {ranking.map((account, idx) => (
                <div key={account} className={`prio-ranking-item ${idx < 10 ? 'prio-ranking-item--top' : ''}`}>
                  <span className="prio-ranking-pos">{idx + 1}</span>
                  <span className="prio-ranking-name">{account}</span>
                  <div className="prio-ranking-actions">
                    <button
                      className="prio-rank-btn"
                      onClick={() => moveAccount(account, -1)}
                      disabled={idx === 0}
                      title="Subir"
                    >▲</button>
                    <button
                      className="prio-rank-btn"
                      onClick={() => moveAccount(account, 1)}
                      disabled={idx === ranking.length - 1}
                      title="Descer"
                    >▼</button>
                    <button
                      className="prio-rank-btn prio-rank-btn--remove"
                      onClick={() => removeFromRanking(account)}
                      title="Remover"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unranked accounts */}
          {unrankedAccounts.length > 0 && (
            <>
              <div className="prio-unranked-header">Accounts sem ranking</div>
              <div className="prio-unranked-list">
                {unrankedAccounts.map(account => (
                  <button
                    key={account}
                    className="prio-unranked-btn"
                    onClick={() => addToRanking(account)}
                    title="Adicionar ao ranking"
                  >
                    + {account}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
