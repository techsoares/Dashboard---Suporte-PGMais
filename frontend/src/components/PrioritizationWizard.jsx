import { useState, useMemo } from 'react'
import { API_BASE_URL } from '../apiUrl'
import './PrioritizationWizard.css'

const TEMPLATES = [
  { label: 'Produção parada', value: 'Produção parada. Sistema fora do ar. Impacto imediato em clientes.' },
  { label: 'Cliente crítico', value: 'Cliente crítico com SLA vencido. Risco de churn.' },
  { label: 'Bloqueador', value: 'Bloqueador para outras equipes. Impede progresso.' },
  { label: 'Segurança', value: 'Vulnerabilidade de segurança. Risco de exposição de dados.' },
  { label: 'Performance', value: 'Degradação de performance. Impacto na experiência do usuário.' },
]

export default function PrioritizationWizard({ data, user, bus, onClose }) {
  const [step, setStep] = useState(1)
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [justification, setJustification] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [aiVerdict, setAiVerdict] = useState(null)

  const userBu = useMemo(() => {
    if (!user?.bu_name || !bus) return null
    return bus.find(b => b.name === user.bu_name)
  }, [user, bus])

  const backlogIssues = useMemo(() => {
    return (data?.backlog || [])
      .sort((a, b) => {
        const prioOrder = { Highest: 0, Blocker: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 }
        return (prioOrder[a.priority?.name] ?? 2) - (prioOrder[b.priority?.name] ?? 2)
      })
  }, [data])

  const filteredIssues = useMemo(() => {
    if (!searchQuery.trim()) return backlogIssues.slice(0, 50)
    const q = searchQuery.trim().toLowerCase()
    return backlogIssues.filter(i =>
      i.key?.toLowerCase().includes(q) ||
      i.summary?.toLowerCase().includes(q) ||
      i.assignee?.display_name?.toLowerCase().includes(q) ||
      i.account?.toLowerCase().includes(q) ||
      i.product?.toLowerCase().includes(q)
    )
  }, [backlogIssues, searchQuery])

  const handleSelectIssue = (issue) => {
    setSelectedIssue(issue)
    setJustification('')
    setAiVerdict(null)
    setError('')
  }

  const handleTemplateClick = (template) => {
    setJustification(template)
  }

  const handleSubmit = async () => {
    if (!selectedIssue || !justification.trim()) {
      setError('Preencha todos os campos')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE_URL}/api/priority-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          issue_key: selectedIssue.key,
          requester_name: user.name,
          requester_bu: user.bu_name || '',
          justification: justification.trim(),
          issue_summary: selectedIssue.summary,
          issue_type: selectedIssue.issue_type?.name || '',
          account: selectedIssue.account || '',
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        if (json.error === 'duplicate') {
          setError('Você já solicitou prioridade para este jira.')
        } else {
          setError(json.detail || 'Erro ao enviar solicitação')
        }
      } else {
        setAiVerdict(json)
        setSuccess(true)
        setTimeout(() => {
          onClose?.()
        }, 3000)
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1: Selecionar Issue ──────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="pw-modal-overlay" onClick={onClose}>
        <div className="pw-modal" onClick={e => e.stopPropagation()}>
          <div className="pw-modal-header">
            <h2 className="pw-modal-title">Solicitar Priorização</h2>
            <button className="pw-modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="pw-step-indicator">
            <div className="pw-step pw-step--active">1. Selecionar</div>
            <div className="pw-step">2. Justificar</div>
            <div className="pw-step">3. Confirmar</div>
          </div>

          <div className="pw-modal-body">
            <p className="pw-step-desc">Escolha o jira que deseja priorizar</p>

            <div className="pw-search-wrap">
              <input
                className="pw-search"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por chave, título, responsável, account ou produto..."
                autoFocus
              />
              {searchQuery && (
                <button className="pw-search-clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>

            <div className="pw-issue-list">
              {filteredIssues.length === 0 ? (
                <p className="pw-empty">
                  {backlogIssues.length === 0 ? 'Nenhum jira disponível para priorização' : 'Nenhum resultado para a busca'}
                </p>
              ) : (
                filteredIssues.map(issue => (
                  <button
                    key={issue.key}
                    className={`pw-issue-item ${selectedIssue?.key === issue.key ? 'active' : ''}`}
                    onClick={() => handleSelectIssue(issue)}
                  >
                    <div className="pw-issue-left">
                      <span className="pw-issue-key">{issue.key}</span>
                      <span className="pw-issue-summary">{issue.summary}</span>
                    </div>
                    <div className="pw-issue-right">
                      <span className="pw-issue-prio" style={{
                        color: issue.priority?.name === 'Highest' ? 'var(--rosa)' : 'var(--text-muted)'
                      }}>
                        {issue.priority?.name || 'Medium'}
                      </span>
                      <span className="pw-issue-assignee">{issue.assignee?.display_name || '—'}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="pw-modal-footer">
            <button className="pw-btn pw-btn--secondary" onClick={onClose}>Cancelar</button>
            <button
              className="pw-btn pw-btn--primary"
              onClick={() => setStep(2)}
              disabled={!selectedIssue}
            >
              Próximo
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: Justificativa ────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="pw-modal-overlay" onClick={onClose}>
        <div className="pw-modal" onClick={e => e.stopPropagation()}>
          <div className="pw-modal-header">
            <h2 className="pw-modal-title">Justificativa</h2>
            <button className="pw-modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="pw-step-indicator">
            <div className="pw-step pw-step--done">1. Selecionar</div>
            <div className="pw-step pw-step--active">2. Justificar</div>
            <div className="pw-step">3. Confirmar</div>
          </div>

          <div className="pw-modal-body">
            <div className="pw-issue-preview">
              <span className="pw-preview-key">{selectedIssue?.key}</span>
              <span className="pw-preview-summary">{selectedIssue?.summary}</span>
            </div>

            <p className="pw-step-desc">Explique por que este jira precisa ser priorizado</p>

            <div className="pw-templates">
              <p className="pw-templates-label">Modelos rápidos:</p>
              <div className="pw-templates-grid">
                {TEMPLATES.map(t => (
                  <button
                    key={t.value}
                    className="pw-template-btn"
                    onClick={() => handleTemplateClick(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              className="pw-textarea"
              value={justification}
              onChange={e => setJustification(e.target.value)}
              placeholder="Descreva o impacto, urgência e contexto..."
              rows={6}
            />

            <div className="pw-char-count">
              {justification.length} caracteres
            </div>

            {error && <div className="pw-error">{error}</div>}
          </div>

          <div className="pw-modal-footer">
            <button className="pw-btn pw-btn--secondary" onClick={() => setStep(1)}>Voltar</button>
            <button
              className="pw-btn pw-btn--primary"
              onClick={() => setStep(3)}
              disabled={!justification.trim()}
            >
              Próximo
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: Confirmação ──────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="pw-modal-overlay" onClick={onClose}>
        <div className="pw-modal" onClick={e => e.stopPropagation()}>
          <div className="pw-modal-header">
            <h2 className="pw-modal-title">Confirmar Solicitação</h2>
            <button className="pw-modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="pw-step-indicator">
            <div className="pw-step pw-step--done">1. Selecionar</div>
            <div className="pw-step pw-step--done">2. Justificar</div>
            <div className="pw-step pw-step--active">3. Confirmar</div>
          </div>

          <div className="pw-modal-body">
            {success && aiVerdict ? (
              <div className="pw-success">
                <div className="pw-success-icon">✓</div>
                <h3 className="pw-success-title">Solicitação Enviada!</h3>
                <p className="pw-success-text">Sua solicitação foi avaliada pela IA</p>

                <div className="pw-verdict-card">
                  <div className="pw-verdict-header">
                    <span className="pw-verdict-label">Avaliação da IA</span>
                    <span className="pw-verdict-boost">+{aiVerdict.boost} pontos</span>
                  </div>
                  <p className="pw-verdict-text">{aiVerdict.ai_verdict}</p>
                  {userBu?.bu_type === 'gestao' && (
                    <div className="pw-verdict-multiplier">
                      <span className="pw-verdict-mult-icon">⚡</span>
                      Sua BU (Gestão) recebe multiplicador 1.5x
                    </div>
                  )}
                </div>

                <p className="pw-success-redirect">Redirecionando em 3 segundos...</p>
              </div>
            ) : (
              <>
                <div className="pw-review-section">
                  <h4 className="pw-review-title">Resumo da Solicitação</h4>

                  <div className="pw-review-item">
                    <span className="pw-review-label">Jira</span>
                    <span className="pw-review-value">{selectedIssue?.key} — {selectedIssue?.summary}</span>
                  </div>

                  <div className="pw-review-item">
                    <span className="pw-review-label">Solicitante</span>
                    <span className="pw-review-value">{user?.name}</span>
                  </div>

                  {userBu && (
                    <div className="pw-review-item">
                      <span className="pw-review-label">Unidade de Negócio</span>
                      <span className="pw-review-value">
                        {userBu.name}
                        {userBu.bu_type === 'gestao' && <span className="pw-review-badge">Gestão</span>}
                      </span>
                    </div>
                  )}

                  <div className="pw-review-item">
                    <span className="pw-review-label">Justificativa</span>
                    <p className="pw-review-justification">{justification}</p>
                  </div>
                </div>

                <div className="pw-info-box">
                  <span className="pw-info-icon">ℹ️</span>
                  <p className="pw-info-text">
                    Sua solicitação será avaliada por IA. Se aprovada, o jira receberá um boost de prioridade.
                    {userBu?.bu_type === 'gestao' && ' Como membro de Gestão, sua solicitação tem peso 1.5x.'}
                  </p>
                </div>

                {error && <div className="pw-error">{error}</div>}
              </>
            )}
          </div>

          {!success && (
            <div className="pw-modal-footer">
              <button className="pw-btn pw-btn--secondary" onClick={() => setStep(2)}>Voltar</button>
              <button
                className="pw-btn pw-btn--primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }
}
