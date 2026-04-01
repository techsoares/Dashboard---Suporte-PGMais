import { useState, useEffect, useMemo, useCallback } from 'react'
import { API_BASE_URL } from '../apiUrl'
import FilterDropdown from './FilterDropdown'
import { DeprioritizeModal } from './DeprioritizeModal'
import './PrioritizationView.css'

const SCORE_WEIGHTS = {
  production:  1000,
  incident:     500,
  problem:      300,
  topAccount:    40,   // multiplied by (11 - rank)
  agePerDay:      3,
  ageCap:       200,
}

// Normalize: remove accents, lowercase, strip extra spaces
function normalizeText(text) {
  return (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// Find the ranking index for a Jira account using fuzzy matching
// Rules: case-insensitive, accent-insensitive, partial contains in both directions
function findRankIndex(account, ranking) {
  if (!account) return -1
  const normalizedAccount = normalizeText(account)
  for (let rankIdx = 0; rankIdx < ranking.length; rankIdx++) {
    const normalizedRankEntry = normalizeText(ranking[rankIdx])
    // Exact normalized match
    if (normalizedAccount === normalizedRankEntry) return rankIdx
    // One contains the other (handles "99Pay" ↔ "99 PAY", "FRANQUIAS BOTICARIO [S]" ↔ "EUDORA / BOTICÁRIO")
    // Split ranking entry by / to check each part (e.g. "EUDORA / BOTICÁRIO" → ["eudora", "boticario"])
    const rankWords = normalizedRankEntry.split(/[\s\/]+/).filter(word => word.length > 2)
    const accountWords = normalizedAccount.split(/[\s\/\[\]]+/).filter(word => word.length > 2)
    // Check if any significant word from ranking appears in the account or vice versa
    if (rankWords.some(rWord => normalizedAccount.includes(rWord)) || accountWords.some(aWord => normalizedRankEntry.includes(aWord))) return rankIdx
  }
  return -1
}

function calcScore(issue, ranking, productionKeys, boost = 0) {
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

  // 5. Priority boost from requests
  score += boost

  return score
}

function fmtAge(created) {
  if (!created) return '—'
  const days = Math.floor((Date.now() - new Date(created).getTime()) / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return '1 dia'
  return `${days} dias`
}

function isCreatedToday(created) {
  if (!created) return false
  const d = new Date(created)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
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

export default function PrioritizationView({ data, bus = [], user }) {
  const isAdmin = user?.permissions?.includes('admin')
  const [ranking, setRanking]               = useState([])
  const [productionKeys, setProductionKeys] = useState([])
  const [classifying, setClassifying]       = useState(false)
  const [savingRank, setSavingRank]         = useState(false)
  const [activeFilter, setActiveFilter]     = useState(null)   // null|'all'|'production'|'incident'|'problem'
  const [expandedKey, setExpandedKey]       = useState(null)
  const [summaries, setSummaries]           = useState({})      // { issueKey: { loading, text, error } }
  const [searchQuery, setSearchQuery]       = useState('')
  const [prioRequests, setPrioRequests]     = useState([])    // all priority requests
  const [prioForm, setPrioForm]             = useState(null)   // { issueKey, summary, type, account } or null
  const [prioName, setPrioName]             = useState(() => user?.name || localStorage.getItem('prio_user_name') || '')
  const [prioJustification, setPrioJustification] = useState('')
  const [prioBu, setPrioBu]                 = useState('')
  const [prioSubmitting, setPrioSubmitting] = useState(false)
  const [deprioritizeModal, setDeprioritizeModal] = useState({
    isOpen: false,
    issueKey: null,
  })
  const [localFilters, setLocalFilters]     = useState({ assignee: [], account: [], issue_type: [] })
  const [clock, setClock]                   = useState(() => new Date())

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Local filter options derived from prioritized data
  const localFilterOptions = useMemo(() => {
    if (!data?.backlog) return { assignees: [], accounts: [], issueTypes: [] }
    const allIssues = [...(data.backlog || []), ...(data.devs || []).flatMap(d => d.active_issues || [])]
    return {
      assignees: [...new Set(allIssues.map(i => i.assignee?.display_name).filter(Boolean))].sort(),
      accounts: [...new Set(allIssues.map(i => i.account).filter(Boolean))].sort(),
      issueTypes: [...new Set(allIssues.map(i => i.issue_type?.name).filter(Boolean))].sort(),
    }
  }, [data])

  const toggleLocalFilter = useCallback((key, value) => {
    setLocalFilters(prev => {
      const cur = prev[key] || []
      return { ...prev, [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] }
    })
  }, [])

  const clearLocalFilter = useCallback((key) => {
    setLocalFilters(prev => ({ ...prev, [key]: [] }))
  }, [])

  // Resolve user's BU automatically from bus list
  const userBuResolved = useMemo(() => {
    if (!user?.bu_name || !bus.length) return null
    return bus.find(b => b.name === user.bu_name) || null
  }, [user, bus])
  const [showHelp, setShowHelp]             = useState(false)
  const [showRanking, setShowRanking]       = useState(false)

  // All unique accounts from data
  const allAccounts = useMemo(() => {
    if (!data?.backlog) return []
    const accountSet = new Set()
    data.backlog.forEach(issue => { if (issue.account) accountSet.add(issue.account) })
    data.devs?.forEach(dev => dev.active_issues?.forEach(issue => { if (issue.account) accountSet.add(issue.account) }))
    return [...accountSet].sort()
  }, [data])

  // Load ranking
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/admin/account-ranking`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } })
      .then(r => r.json())
      .then(r => setRanking(Array.isArray(r) ? r : []))
      .catch(() => {})
  }, [])

  // Load priority requests
  const loadPrioRequests = useCallback(() => {
    fetch(`${API_BASE_URL}/api/priority-requests`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } })
      .then(r => r.json())
      .then(r => setPrioRequests(Array.isArray(r) ? r : []))
      .catch(() => {})
  }, [])

  useEffect(() => { loadPrioRequests() }, [loadPrioRequests])

  // Submit priority request
  const submitPrioRequest = useCallback(() => {
    const resolvedBu = prioBu || userBuResolved?.name || ''
    if (!prioForm || !prioName.trim() || !prioJustification.trim() || !resolvedBu) return
    setPrioSubmitting(true)
    fetch(`${API_BASE_URL}/api/priority-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
      body: JSON.stringify({
        issue_key: prioForm.issueKey,
        requester_name: prioName.trim(),
        justification: prioJustification.trim(),
        requester_bu: resolvedBu,
        issue_summary: prioForm.summary || '',
        issue_type: prioForm.type || '',
        account: prioForm.account || '',
      }),
    })
      .then(r => r.json())
      .then(r => {
        if (r.error === 'duplicate') {
          alert(r.message)
        } else {
          localStorage.setItem('prio_user_name', prioName.trim())
          loadPrioRequests()
          setPrioForm(null)
          setPrioJustification('')
          setPrioBu('')
        }
      })
      .catch(() => {})
      .finally(() => setPrioSubmitting(false))
  }, [prioForm, prioName, prioJustification, prioBu, loadPrioRequests])

  // Deprioritize — remove a specific priority request by ID
  const removePrioRequest = useCallback((requestId, requesterName) => {
    if (!confirm(`Remover a priorização de ${requesterName}?`)) return
    fetch(`${API_BASE_URL}/api/priority-requests/${requestId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } })
      .then(() => loadPrioRequests())
      .catch(() => {})
  }, [loadPrioRequests])

  // Deprioritize all — admin removes all priority requests for an issue
  const deprioritizeAll = useCallback((issueKey) => {
    setDeprioritizeModal({ isOpen: true, issueKey });
  }, [])

  // Handle modal confirm
  const handleDeprioritizeConfirm = useCallback((reason) => {
    return new Promise((resolve, reject) => {
      fetch(`${API_BASE_URL}/api/priority-requests/deprioritize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          issue_key: deprioritizeModal.issueKey,
          deprioritization_reason: reason,
        }),
      })
        .then(res => {
          if (!res.ok) {
            return res.json().then(err => {
              throw new Error(err.detail || 'Erro ao despriorizar');
            });
          }
          return res.json();
        })
        .then(data => {
          setDeprioritizeModal({ isOpen: false, issueKey: null });
          loadPrioRequests();
          resolve(data);
        })
        .catch(err => {
          reject(err);
        });
    });
  }, [deprioritizeModal.issueKey, loadPrioRequests])

  const handleDeprioritizeCancel = useCallback(() => {
    setDeprioritizeModal({ isOpen: false, issueKey: null });
  }, [])

  // Compute boost per issue from priority requests
  const boostByKey = useMemo(() => {
    const boostMap = {}
    prioRequests.forEach(request => {
      if (!boostMap[request.issue_key]) boostMap[request.issue_key] = { total: 0, requests: [], deprioritized: [] }
      if (request.deprioritized_by) {
        boostMap[request.issue_key].deprioritized.push(request)
      } else {
        boostMap[request.issue_key].total += request.boost || 0
        boostMap[request.issue_key].requests.push(request)
      }
    })
    return boostMap
  }, [prioRequests])

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
    fetch(`${API_BASE_URL}/api/ai/classify-production`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
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
      await fetch(`${API_BASE_URL}/api/admin/account-ranking`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
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
    let issues = data.backlog.map(issue => {
      const boost = boostByKey[issue.key]?.total || 0
      return {
        ...issue,
        score: calcScore(issue, ranking, productionKeys, boost),
        isProduction: productionKeys.includes(issue.key),
        accountRank: findRankIndex(issue.account, ranking),
        prioBoost: boost,
        prioRequests: boostByKey[issue.key]?.requests || [],
        prioDeprioritized: boostByKey[issue.key]?.deprioritized || [],
      }
    })
    const sorted = issues.sort((a, b) => b.score - a.score)
    return sorted.map((item, idx) => ({ ...item, originalRank: idx + 1 }))
  }, [data, ranking, productionKeys, boostByKey])

  // Stats — includes dynamic type breakdown
  const stats = useMemo(() => {
    const base = {
      total: prioritized.length,
      incidents: prioritized.filter(i => isIncidentType(i.issue_type?.name)).length,
      problems: prioritized.filter(i => isProblemType(i.issue_type?.name)).length,
      production: prioritized.filter(i => i.isProduction).length,
      boosted: prioritized.filter(i => i.prioBoost > 0).length,
      todayIncProb: prioritized.filter(i => isCreatedToday(i.created) && (isIncidentType(i.issue_type?.name) || isProblemType(i.issue_type?.name))).length,
    }
    // Count remaining types not covered by incident/problem
    const otherTypes = {}
    prioritized.forEach(i => {
      const name = i.issue_type?.name || ''
      if (!name || isIncidentType(name) || isProblemType(name)) return
      const key = name.toLowerCase()
      if (!otherTypes[key]) otherTypes[key] = { label: name, count: 0 }
      otherTypes[key].count++
    })
    base.otherTypes = Object.values(otherTypes).sort((a, b) => b.count - a.count)
    return base
  }, [prioritized])

  // AI summary for an issue
  const fetchSummary = useCallback((issue) => {
    if (summaries[issue.key]?.text || summaries[issue.key]?.loading) return
    setSummaries(prev => ({ ...prev, [issue.key]: { loading: true, text: '', error: false } }))
    const question = `Resuma em 2-3 frases curtas o chamado Jira abaixo. Seja direto: o que aconteceu, impacto e status atual.\n\nChave: ${issue.key}\nTítulo: ${issue.summary}\nTipo: ${issue.issue_type?.name || '—'}\nStatus: ${issue.status?.name || '—'}\nAccount: ${issue.account || '—'}\nResponsável: ${issue.assignee?.display_name || 'Não atribuído'}\nCriado: ${issue.created || '—'}`
    fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
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

  // Filter by stat pill + local filters + search
  const displayList = useMemo(() => {
    let list = prioritized
    // Stat pill filter
    if (activeFilter) {
      switch (activeFilter) {
        case 'production': list = list.filter(i => i.isProduction); break
        case 'incident':   list = list.filter(i => isIncidentType(i.issue_type?.name)); break
        case 'problem':    list = list.filter(i => isProblemType(i.issue_type?.name)); break
        case 'boosted':    list = list.filter(i => i.prioBoost > 0); break
        case 'today':      list = list.filter(i => isCreatedToday(i.created) && (isIncidentType(i.issue_type?.name) || isProblemType(i.issue_type?.name))); break
        default:
          if (activeFilter.startsWith('type:')) {
            const typeKey = activeFilter.slice(5)
            list = list.filter(i => (i.issue_type?.name || '').toLowerCase() === typeKey)
          }
          break
      }
    }
    // Local dropdown filters
    if (localFilters.assignee.length > 0) {
      list = list.filter(i => localFilters.assignee.includes(i.assignee?.display_name))
    }
    if (localFilters.account.length > 0) {
      list = list.filter(i => localFilters.account.includes(i.account))
    }
    if (localFilters.issue_type.length > 0) {
      list = list.filter(i => localFilters.issue_type.includes(i.issue_type?.name))
    }
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(i =>
        i.key?.toLowerCase().includes(q) ||
        i.summary?.toLowerCase().includes(q) ||
        i.account?.toLowerCase().includes(q) ||
        i.assignee?.display_name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [prioritized, activeFilter, localFilters, searchQuery])

  // Mensageria BU sidebar data
  const mensageriaBu = useMemo(() => bus.find(b => b.name === 'Mensageria'), [bus])
  const mensageriaMembers = useMemo(() => mensageriaBu?.members || [], [mensageriaBu])

  // Shared filter function for reuse in mensageria
  const applyLocalFilters = useCallback((issues) => {
    let list = issues
    if (activeFilter) {
      switch (activeFilter) {
        case 'production': list = list.filter(i => productionKeys.includes(i.key)); break
        case 'incident':   list = list.filter(i => isIncidentType(i.issue_type?.name)); break
        case 'problem':    list = list.filter(i => isProblemType(i.issue_type?.name)); break
        case 'today':      list = list.filter(i => isCreatedToday(i.created) && (isIncidentType(i.issue_type?.name) || isProblemType(i.issue_type?.name))); break
        default:
          if (activeFilter.startsWith('type:')) {
            const typeKey = activeFilter.slice(5)
            list = list.filter(i => (i.issue_type?.name || '').toLowerCase() === typeKey)
          }
          break
      }
    }
    if (localFilters.assignee.length > 0) {
      list = list.filter(i => localFilters.assignee.includes(i.assignee?.display_name))
    }
    if (localFilters.account.length > 0) {
      list = list.filter(i => localFilters.account.includes(i.account))
    }
    if (localFilters.issue_type.length > 0) {
      list = list.filter(i => localFilters.issue_type.includes(i.issue_type?.name))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(i =>
        i.key?.toLowerCase().includes(q) ||
        i.summary?.toLowerCase().includes(q) ||
        i.account?.toLowerCase().includes(q) ||
        i.assignee?.display_name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [activeFilter, localFilters, searchQuery, productionKeys])

  const mensageriaByMember = useMemo(() => {
    if (!data || !mensageriaMembers.length) return []
    return mensageriaMembers.map(member => {
      const memberLower = member.toLowerCase()
      const dev = (data.devs || []).find(d => (d.assignee?.display_name || '').toLowerCase() === memberLower)
      const activeIssues = dev?.active_issues || []
      const backlogIssues = (data.backlog || []).filter(i => (i.assignee?.display_name || '').toLowerCase() === memberLower)
      const allIssues = [...activeIssues, ...backlogIssues]
      // deduplicate by key
      const seen = new Set()
      const deduped = allIssues.filter(i => { if (seen.has(i.key)) return false; seen.add(i.key); return true })
      // apply same filters as the main list
      const issues = applyLocalFilters(deduped)
      const firstName = member.split(' ')[0]
      return { name: member, firstName, issues }
    })
  }, [data, mensageriaMembers, applyLocalFilters])

  // Accounts NOT in ranking (using fuzzy match)
  const unrankedAccounts = allAccounts.filter(a => findRankIndex(a, ranking) === -1)

  return (
    <div className="prio-root">
      <div className="prio-header">
        <div>
          <h2 className="prio-title">Priorização</h2>
          <p className="prio-subtitle">Ordenação inteligente baseada em faturamento, tipo, produção e idade</p>
        </div>
        <div className="prio-header-actions">
          <span className="prio-clock" title="Hora atual">
            {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <div className="prio-ranking-collapsible">
            <button className={`prio-help-btn ${showRanking ? 'prio-help-btn--active' : ''}`} onClick={() => setShowRanking(v => !v)}>
              Ranking de Faturamento {ranking.length > 0 && <span className="prio-ranking-toggle-count">{ranking.length}</span>}
              {savingRank && <span className="prio-saving">...</span>}
            </button>
            {showRanking && (
              <div className="prio-ranking-dropdown">
                {ranking.length > 0 && (
                  <div className="prio-ranking-list">
                    {ranking.map((account, idx) => (
                      <div key={account} className={`prio-ranking-item ${idx < 10 ? 'prio-ranking-item--top' : ''}`} title={idx < 10 ? `#${idx + 1} — +${(11 - (idx + 1)) * 40} pts` : `#${idx + 1}`}>
                        <span className="prio-ranking-pos">{idx + 1}</span>
                        <span className="prio-ranking-name">{account}</span>
                        {isAdmin && (
                          <div className="prio-ranking-actions">
                            <button className="prio-rank-btn" onClick={() => moveAccount(account, -1)} disabled={idx === 0} title="Subir">▲</button>
                            <button className="prio-rank-btn" onClick={() => moveAccount(account, 1)} disabled={idx === ranking.length - 1} title="Descer">▼</button>
                            <button className="prio-rank-btn prio-rank-btn--remove" onClick={() => removeFromRanking(account)} title="Remover">✕</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {isAdmin && unrankedAccounts.length > 0 && (
                  <>
                    <div className="prio-unranked-header">Sem ranking</div>
                    <div className="prio-unranked-list">
                      {unrankedAccounts.map(account => (
                        <button key={account} className="prio-unranked-btn" onClick={() => addToRanking(account)} title="Adicionar">+ {account}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <button className="prio-help-btn" onClick={() => setShowHelp(v => !v)}>
            Como pedir prioridade?
          </button>
          <button
            className="prio-classify-btn"
            onClick={classifyProduction}
            disabled={classifying}
            title="Usar IA para identificar issues que afetam ambiente de produção"
          >
            {classifying ? 'Analisando...' : '✦ Reclassificar produção'}
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="prio-help-card">
          <button className="prio-help-close" onClick={() => setShowHelp(false)}>✕</button>
          <h3 className="prio-help-title">Como solicitar prioridade?</h3>
          <ol className="prio-help-steps">
            <li>Encontre o chamado na lista abaixo (use a busca se necessário)</li>
            <li>Clique no botão <span className="prio-help-icon">⚡</span> ao lado do chamado</li>
            <li>Preencha seu nome e a justificativa explicando o impacto</li>
            <li>A IA avaliará a urgência e atribuirá um boost de 0 a 500 pontos</li>
            <li>O chamado será reposicionado automaticamente na fila</li>
          </ol>
          <div className="prio-help-tips">
            <strong>Dicas para um boost maior:</strong> Descreva o impacto real — produção parada, perda financeira, SLA estourado, cliente em risco de churn. Justificativas genéricas como "é urgente" recebem boost baixo.
          </div>
        </div>
      )}

      {/* Stats pills + filters inline */}
      <div className="prio-stats-row">
        <button className={`prio-stat ${activeFilter === null ? 'prio-stat--active' : ''}`} onClick={() => setActiveFilter(null)} title="Total de issues na fila de priorização">
          <span className="prio-stat-value">{stats.total}</span>
          <span className="prio-stat-label">na fila</span>
        </button>
        <button className={`prio-stat prio-stat--danger ${activeFilter === 'production' ? 'prio-stat--active' : ''}`} onClick={() => setActiveFilter(v => v === 'production' ? null : 'production')} title="Issues afetando produção">
          <span className="prio-stat-value">{stats.production}</span>
          <span className="prio-stat-label">produção</span>
        </button>
        <button className={`prio-stat prio-stat--incident ${activeFilter === 'incident' ? 'prio-stat--active' : ''}`} onClick={() => setActiveFilter(v => v === 'incident' ? null : 'incident')} title="Incidentes ou Bugs">
          <span className="prio-stat-value">{stats.incidents}</span>
          <span className="prio-stat-label">incidentes</span>
        </button>
        <button className={`prio-stat prio-stat--problem ${activeFilter === 'problem' ? 'prio-stat--active' : ''}`} onClick={() => setActiveFilter(v => v === 'problem' ? null : 'problem')} title="Problemas">
          <span className="prio-stat-value">{stats.problems}</span>
          <span className="prio-stat-label">problemas</span>
        </button>
        {stats.otherTypes.map(t => (
          <button key={t.label} className={`prio-stat prio-stat--type ${activeFilter === 'type:' + t.label.toLowerCase() ? 'prio-stat--active' : ''}`} onClick={() => setActiveFilter(v => v === 'type:' + t.label.toLowerCase() ? null : 'type:' + t.label.toLowerCase())} title={t.label}>
            <span className="prio-stat-value">{t.count}</span>
            <span className="prio-stat-label">{t.label.toLowerCase()}</span>
          </button>
        ))}
        <button className={`prio-stat prio-stat--today ${activeFilter === 'today' ? 'prio-stat--active' : ''}`} onClick={() => setActiveFilter(v => v === 'today' ? null : 'today')} title="Recebidos hoje">
          <span className="prio-stat-value">{stats.todayIncProb}</span>
          <span className="prio-stat-label">hoje</span>
        </button>
        {stats.boosted > 0 && (
          <button className={`prio-stat prio-stat--boosted ${activeFilter === 'boosted' ? 'prio-stat--active' : ''}`} onClick={() => setActiveFilter(v => v === 'boosted' ? null : 'boosted')} title="Issues com solicitação de prioridade">
            <span className="prio-stat-value">{stats.boosted}</span>
            <span className="prio-stat-label">priorizados</span>
          </button>
        )}

        <span className="prio-stats-divider" />

        <FilterDropdown label="Responsável" options={localFilterOptions.assignees} selected={localFilters.assignee} onToggle={v => toggleLocalFilter('assignee', v)} onClear={() => clearLocalFilter('assignee')} />
        <FilterDropdown label="Account" options={localFilterOptions.accounts} selected={localFilters.account} onToggle={v => toggleLocalFilter('account', v)} onClear={() => clearLocalFilter('account')} />
        <FilterDropdown label="Tipo" options={localFilterOptions.issueTypes} selected={localFilters.issue_type} onToggle={v => toggleLocalFilter('issue_type', v)} onClear={() => clearLocalFilter('issue_type')} />
        <div className="prio-search-inline">
          <input
            className="prio-search-input"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar..."
          />
          {searchQuery && <button className="prio-search-clear" onClick={() => setSearchQuery('')}>✕</button>}
        </div>
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
                      className={`prio-item ${idx === 0 ? 'prio-item--next' : ''} ${issue.isProduction ? 'prio-item--production' : ''} ${issue.prioBoost > 0 ? 'prio-item--boosted' : ''}`}
                    >
                      <span className="prio-rank" title={`Posição #${issue.originalRank} na fila de atendimento`}>#{issue.originalRank}</span>
                      <div className="prio-item-main">
                        <div className="prio-item-top">
                          <span className="prio-key" title={`Abrir ${issue.key} no Jira`}>{issue.key}</span>
                          <TypeBadge type={issue.issue_type?.name} />
                          {issue.isProduction && (
                            <span className="prio-prod-flag" title="IA classificou esta issue como afetando produção (+1000 pontos)">PRODUÇÃO</span>
                          )}
                          {isTopAccount && (
                            <span className="prio-top-badge" title={`Conta ranqueada em #${issue.accountRank + 1} por faturamento (+${(11 - (issue.accountRank + 1)) * 40} pontos)`}>Top {issue.accountRank + 1}</span>
                          )}
                          {issue.prioBoost > 0 && (
                            <span className="prio-boost-badge" title={issue.prioRequests.map(r => `${r.requester_name}: ${r.justification} (boost +${r.boost})`).join('\n')}>
                              ⚡ +{issue.prioBoost} ({issue.prioRequests.length})
                            </span>
                          )}
                        </div>
                        <span className="prio-summary" title={issue.summary}>{issue.summary}</span>
                        <div className="prio-item-meta">
                          <span className="prio-account" title={`Account: ${issue.account || 'Não definido'}`}>{issue.account || '—'}</span>
                          {issue.product && <span className="prio-product" title={`Produto: ${issue.product}`}>{issue.product}</span>}
                          <span className="prio-assignee" title={`Responsável: ${issue.assignee?.display_name || 'Não atribuído'}`}>{issue.assignee?.display_name || 'Não atribuído'}</span>
                          <span className="prio-age" title={`Criado há ${fmtAge(issue.created)} — issues mais antigas ganham mais pontos (até 200)`}>{fmtAge(issue.created)}</span>
                          <span className="prio-score" title="Score total: soma de pontos por produção, tipo, ranking de faturamento, idade e boost de priorização">Score: {issue.score}</span>
                        </div>
                        {issue.prioRequests.length > 0 && (
                          <div className="prio-boost-history">
                            {issue.prioRequests.map(r => (
                              <div key={r.id} className={`prio-boost-entry ${r.bu_type === 'gestao' ? 'prio-boost-entry--gestao' : ''}`}>
                                <span className="prio-boost-name">{r.requester_name}</span>
                                {r.requester_bu && <span className="prio-boost-bu">{r.requester_bu}</span>}
                                <span className="prio-boost-reason">{r.ai_verdict}</span>
                                <span className="prio-boost-value">+{r.boost}</span>
                                {(prioName.trim().toLowerCase() === r.requester_name.toLowerCase() || isAdmin) && (
                                  <button
                                    className="prio-deprio-btn"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePrioRequest(r.id, r.requester_name) }}
                                    title={isAdmin ? 'Remover priorização (admin)' : 'Remover sua priorização'}
                                  >✕</button>
                                )}
                              </div>
                            ))}
                            {isAdmin && issue.prioRequests.length > 1 && (
                              <button
                                className="prio-deprio-all-btn"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); deprioritizeAll(issue.key) }}
                                title="Remover todas as priorizações (admin)"
                              >
                                Despriorizar tudo
                              </button>
                            )}
                          </div>
                        )}
                        {issue.prioDeprioritized.length > 0 && (
                          <div className="prio-deprio-history">
                            {issue.prioDeprioritized.map(r => (
                              <div key={r.id} className="prio-deprio-entry">
                                <span className="prio-deprio-icon">✕</span>
                                <span className="prio-deprio-text">
                                  Despriorizado por <strong>{r.deprioritized_by}</strong>
                                  {r.deprioritized_at && ` em ${new Date(r.deprioritized_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                                </span>
                                {r.deprioritization_reason && (
                                  <span className="prio-deprio-reason">
                                    "{r.deprioritization_reason}"
                                  </span>
                                )}
                                <span className="prio-deprio-original">solicitado por {r.requester_name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="prio-item-actions">
                        <button
                          className="prio-request-btn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setPrioName(user?.name || localStorage.getItem('prio_user_name') || '')
                            setPrioBu(userBuResolved?.name || '')
                            setPrioForm({ issueKey: issue.key, summary: issue.summary, type: issue.issue_type?.name, account: issue.account })
                          }}
                          title="Solicitar prioridade"
                        >
                          ⚡
                        </button>
                        <button
                          className={`prio-expand-btn ${isExpanded ? 'prio-expand-btn--open' : ''}`}
                          onClick={(e) => toggleExpand(e, issue)}
                          title="Resumo IA"
                        >
                          {summary?.loading ? '...' : isExpanded ? '−' : '+'}
                        </button>
                      </div>
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

        {/* Sidebar direita: Mensageria por membro */}
        <div className="prio-mensageria-panel">
          <div className="prio-mensageria-header">
            <span className="prio-mensageria-title">Mensageria</span>
            <span className="prio-mensageria-count">{mensageriaByMember.reduce((s, m) => s + m.issues.length, 0)}</span>
          </div>

          <div className="prio-mensageria-columns">
            {mensageriaByMember.map(member => (
              <div key={member.name} className="prio-mensageria-col">
                <div className="prio-mensageria-member-header">
                  <span className="prio-mensageria-member-name">{member.firstName}</span>
                  <span className="prio-mensageria-member-count">{member.issues.length}</span>
                </div>
                {member.issues.length > 0 ? (
                  <div className="prio-mensageria-list">
                    {member.issues.map(issue => (
                      <a key={issue.key} href={issue.jira_url} target="_blank" rel="noreferrer" className="prio-mensageria-item">
                        <div className="prio-mensageria-item-top">
                          <span className="prio-mensageria-key">{issue.key}</span>
                          <span className="prio-mensageria-status">{issue.status?.name || '—'}</span>
                        </div>
                        <span className="prio-mensageria-summary">{issue.summary}</span>
                        <div className="prio-mensageria-item-meta">
                          {issue.product && <span className="prio-mensageria-product">{issue.product}</span>}
                          {issue.account && <span className="prio-mensageria-account">{issue.account}</span>}
                          <span className="prio-mensageria-age">{fmtAge(issue.created)}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="prio-mensageria-empty">Sem demandas</p>
                )}
              </div>
            ))}
          </div>

          {mensageriaByMember.length === 0 && (
            <p className="prio-mensageria-empty">Nenhum membro na BU Mensageria.</p>
          )}
        </div>
      </div>

      {/* Priority request modal */}
      {prioForm && (
        <>
          <div className="prio-modal-overlay" onClick={() => setPrioForm(null)} />
          <div className="prio-modal">
            <div className="prio-modal-header">
              <span className="prio-modal-title">Solicitar Prioridade</span>
              <button className="prio-modal-close" onClick={() => setPrioForm(null)}>✕</button>
            </div>
            <div className="prio-modal-issue">
              <span className="prio-modal-key">{prioForm.issueKey}</span>
              <span className="prio-modal-summary">{prioForm.summary}</span>
            </div>
            <div className="prio-modal-field">
              <label>Seu nome</label>
              <input
                type="text"
                value={prioName}
                onChange={e => setPrioName(e.target.value)}
                placeholder="Ex: João Silva"
                readOnly={!!user?.name}
                className={user?.name ? 'prio-modal-input--readonly' : ''}
              />
            </div>
            {userBuResolved ? (
              <div className="prio-modal-field">
                <label>Sua BU</label>
                <div className="prio-modal-bu-auto">
                  <span className="prio-modal-bu-name">{userBuResolved.name}</span>
                  {userBuResolved.bu_type === 'gestao' && <span className="prio-modal-bu-tag">Gestão</span>}
                </div>
              </div>
            ) : (
              <div className="prio-modal-field">
                <label>Sua BU</label>
                <select
                  value={prioBu}
                  onChange={e => setPrioBu(e.target.value)}
                  className="prio-modal-select"
                >
                  <option value="">Selecione sua BU...</option>
                  {bus.map(b => (
                    <option key={b.id} value={b.name}>
                      {b.name}{b.bu_type === 'gestao' ? ' (Gestão)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="prio-modal-field">
              <label>Justificativa</label>
              <textarea
                value={prioJustification}
                onChange={e => setPrioJustification(e.target.value)}
                placeholder="Explique por que este chamado precisa de prioridade..."
                rows={3}
              />
            </div>
            <p className="prio-modal-hint">
              A IA avaliará sua justificativa e determinará o nível de boost na fila.
              {bus.find(b => b.name === prioBu)?.bu_type === 'gestao' && (
                <span className="prio-modal-gestao-hint"> BUs de gestão recebem multiplicador de impacto.</span>
              )}
            </p>
            <button
              className="prio-modal-submit"
              onClick={submitPrioRequest}
              disabled={prioSubmitting || !prioName.trim() || !prioJustification.trim() || (!prioBu && !userBuResolved)}
            >
              {prioSubmitting ? 'Avaliando...' : 'Enviar solicitação'}
            </button>
          </div>
        </>
      )}

      <DeprioritizeModal
        issueKey={deprioritizeModal.issueKey}
        isOpen={deprioritizeModal.isOpen}
        onConfirm={handleDeprioritizeConfirm}
        onCancel={handleDeprioritizeCancel}
      />
    </div>
  )
}
