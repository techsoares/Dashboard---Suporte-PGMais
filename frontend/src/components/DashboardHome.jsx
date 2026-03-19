import { useMemo } from 'react'
import { issuePrio } from '../utils/constants'
import './DashboardHome.css'

export default function DashboardHome({ data, user, bus }) {
  const userBu = useMemo(() => {
    if (!user?.bu_name || !bus) return null
    return bus.find(b => b.name === user.bu_name)
  }, [user, bus])

  const userType = user?.bu_type || 'dev'
  const isGestao = userType === 'gestao'
  const isDev = !isGestao

  // ── Para DEV ──────────────────────────────────────────────────────────────
  const devStats = useMemo(() => {
    if (!isDev || !data) return null
    const issues = data.backlog || []
    const myIssues = issues.filter(i => i.assignee?.display_name === user?.name)
    const urgent = myIssues
      .filter(i => !i.is_overdue && (issuePrio(i) <= 1))
      .sort((a, b) => issuePrio(a) - issuePrio(b))
      .slice(0, 3)
    const overdue = myIssues.filter(i => i.is_overdue).slice(0, 3)
    const blocked = myIssues.filter(i => i.status?.name?.toLowerCase().includes('bloqu')).slice(0, 3)
    const workload = myIssues.length
    const avgDaysInProgress = myIssues
      .filter(i => i.status?.category === 'indeterminate')
      .map(i => i.time_in_status?.in_progress_ms ?? 0)
      .filter(ms => ms > 0)
    const avgDays = avgDaysInProgress.length
      ? Math.round(avgDaysInProgress.reduce((a, b) => a + b, 0) / avgDaysInProgress.length / 86400000)
      : 0

    return { urgent, overdue, blocked, workload, avgDays }
  }, [isDev, data, user])

  // ── Para GESTÃO ───────────────────────────────────────────────────────────
  const gestaoStats = useMemo(() => {
    if (!isGestao || !data) return null
    const issues = data.backlog || []
    const overdue = issues.filter(i => i.is_overdue).length
    const stale = (data.stale_issues || []).length
    const inProgress = issues.filter(i => i.status?.category === 'indeterminate').length
    const waiting = issues.filter(i => i.status?.name?.toLowerCase().includes('aguard')).length
    const riskScore = (overdue * 10) + (stale * 5) + (waiting * 2)
    const buMembers = userBu?.members?.length || 0
    const buIssues = issues.filter(i => userBu?.members?.includes(i.assignee?.display_name)).length

    return { overdue, stale, inProgress, waiting, riskScore, buMembers, buIssues }
  }, [isGestao, data, userBu])

  // ── Para C-LEVEL ──────────────────────────────────────────────────────────
  const executiveStats = useMemo(() => {
    if (!isGestao || !data) return null
    const issues = data.backlog || []
    const total = issues.length
    const overdue = issues.filter(i => i.is_overdue).length
    const stale = (data.stale_issues || []).length
    const health = overdue === 0 && stale === 0 ? 'green' : overdue > 5 || stale > 3 ? 'red' : 'yellow'
    const riskAccounts = [...new Set(
      issues.filter(i => i.is_overdue).map(i => i.account).filter(Boolean)
    )].slice(0, 5)

    return { total, overdue, stale, health, riskAccounts }
  }, [isGestao, data])

  // ── Render DEV ────────────────────────────────────────────────────────────
  if (isDev && devStats) {
    return (
      <div className="dh-root dh-dev">
        <div className="dh-header">
          <h2 className="dh-title">Seu Dashboard</h2>
          <p className="dh-subtitle">Foco no que você precisa fazer hoje</p>
        </div>

        <div className="dh-grid-3">
          {/* Workload */}
          <div className="dh-card dh-card--workload" title="Quantidade total de issues atribuídas a você que estão abertas ou em andamento">
            <div className="dh-card-header">
              <span className="dh-card-icon">📊</span>
              <span className="dh-card-title">Sua Carga</span>
            </div>
            <div className="dh-card-value">{devStats.workload}</div>
            <div className="dh-card-sub">issues ativas</div>
            {devStats.avgDays > 0 && (
              <div className="dh-card-meta" title="Tempo médio que suas issues ficam em progresso">⌀ {devStats.avgDays}d em progresso</div>
            )}
          </div>

          {/* Urgentes */}
          <div className="dh-card dh-card--urgent" title="Issues com prioridade High ou Highest que não estão atrasadas — atenção imediata necessária">
            <div className="dh-card-header">
              <span className="dh-card-icon">🔴</span>
              <span className="dh-card-title">Urgentes</span>
            </div>
            <div className="dh-card-value">{devStats.urgent.length}</div>
            <div className="dh-card-sub">High/Highest</div>
            {devStats.urgent.length > 0 && (
              <div className="dh-card-list">
                {devStats.urgent.map(i => (
                  <a key={i.key} href={`${data.jira_base_url}/browse/${i.key}`} target="_blank" rel="noreferrer" className="dh-card-item">
                    {i.key}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Atrasadas */}
          <div className="dh-card dh-card--overdue" title="Issues cujo prazo de entrega já passou — priorize resolvê-las">
            <div className="dh-card-header">
              <span className="dh-card-icon">⚠️</span>
              <span className="dh-card-title">Atrasadas</span>
            </div>
            <div className="dh-card-value" style={{ color: 'var(--rosa)' }}>{devStats.overdue.length}</div>
            <div className="dh-card-sub">vencimento passou</div>
            {devStats.overdue.length > 0 && (
              <div className="dh-card-list">
                {devStats.overdue.map(i => (
                  <a key={i.key} href={`${data.jira_base_url}/browse/${i.key}`} target="_blank" rel="noreferrer" className="dh-card-item dh-card-item--overdue">
                    {i.key}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Bloqueadas */}
          <div className="dh-card dh-card--blocked" title="Issues bloqueadas por dependência externa, aprovação ou impedimento técnico">
            <div className="dh-card-header">
              <span className="dh-card-icon">🚫</span>
              <span className="dh-card-title">Bloqueadas</span>
            </div>
            <div className="dh-card-value">{devStats.blocked.length}</div>
            <div className="dh-card-sub">aguardando desbloqueio</div>
            {devStats.blocked.length > 0 && (
              <div className="dh-card-list">
                {devStats.blocked.map(i => (
                  <a key={i.key} href={`${data.jira_base_url}/browse/${i.key}`} target="_blank" rel="noreferrer" className="dh-card-item">
                    {i.key}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Próximas Deadlines */}
          <div className="dh-card dh-card--deadline" title="Próximos vencimentos das suas issues mais urgentes e atrasadas">
            <div className="dh-card-header">
              <span className="dh-card-icon">📅</span>
              <span className="dh-card-title">Próximas Deadlines</span>
            </div>
            {devStats.urgent.length === 0 && devStats.overdue.length === 0 ? (
              <p className="dh-card-empty">Nenhuma deadline crítica</p>
            ) : (
              <div className="dh-card-list">
                {[...devStats.overdue, ...devStats.urgent].slice(0, 3).map(i => (
                  <div key={i.key} className="dh-deadline-item">
                    <span className="dh-deadline-key">{i.key}</span>
                    <span className="dh-deadline-date">
                      {i.due_date ? new Date(i.due_date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dica */}
          <div className="dh-card dh-card--tip">
            <div className="dh-card-header">
              <span className="dh-card-icon">💡</span>
              <span className="dh-card-title">Dica do Dia</span>
            </div>
            <p className="dh-card-tip-text">
              {devStats.overdue.length > 0
                ? 'Você tem issues atrasadas. Priorize resolvê-las hoje.'
                : devStats.workload > 8
                ? 'Sua carga está alta. Considere pedir ajuda ao time.'
                : 'Seu backlog está saudável. Bom trabalho!'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Render GESTÃO ─────────────────────────────────────────────────────────
  if (isGestao && gestaoStats) {
    return (
      <div className="dh-root dh-gestao">
        <div className="dh-header">
          <h2 className="dh-title">Visão Gerencial</h2>
          <p className="dh-subtitle">Saúde do time e riscos em tempo real</p>
        </div>

        <div className="dh-grid-3">
          {/* Saúde Geral */}
          <div className="dh-card dh-card--health" title={`Score de risco: ${gestaoStats.riskScore} — Calculado com base em atrasadas (×10), paralisadas (×5) e aguardando (×2)`}>
            <div className="dh-card-header">
              <span className="dh-card-icon">❤️</span>
              <span className="dh-card-title">Saúde Geral</span>
            </div>
            <div className="dh-card-value" style={{
              color: gestaoStats.riskScore === 0 ? 'var(--verde)' : gestaoStats.riskScore < 20 ? 'var(--amarelo)' : 'var(--rosa)'
            }}>
              {gestaoStats.riskScore === 0 ? '✓ Saudável' : gestaoStats.riskScore < 20 ? '⚠ Atenção' : '🔴 Crítico'}
            </div>
            <div className="dh-card-sub">Score de risco: {gestaoStats.riskScore}</div>
          </div>

          {/* Atrasadas */}
          <div className="dh-card dh-card--overdue" title="Issues com prazo de entrega vencido em todo o backlog">
            <div className="dh-card-header">
              <span className="dh-card-icon">⏰</span>
              <span className="dh-card-title">Atrasadas</span>
            </div>
            <div className="dh-card-value" style={{ color: 'var(--rosa)' }}>{gestaoStats.overdue}</div>
            <div className="dh-card-sub">issues vencidas</div>
          </div>

          {/* Paralisadas */}
          <div className="dh-card dh-card--stale" title="Issues sem nenhuma atualização há mais de 30 dias — podem estar esquecidas ou bloqueadas">
            <div className="dh-card-header">
              <span className="dh-card-icon">🧊</span>
              <span className="dh-card-title">Paralisadas</span>
            </div>
            <div className="dh-card-value" style={{ color: 'var(--amarelo)' }}>{gestaoStats.stale}</div>
            <div className="dh-card-sub">+30 dias sem movimento</div>
          </div>

          {/* Sua BU */}
          {userBu && (
            <div className="dh-card dh-card--bu">
              <div className="dh-card-header">
                <span className="dh-card-icon">👥</span>
                <span className="dh-card-title">{userBu.name}</span>
              </div>
              <div className="dh-card-value">{gestaoStats.buIssues}</div>
              <div className="dh-card-sub">issues / {gestaoStats.buMembers} membros</div>
              <div className="dh-card-meta">
                {gestaoStats.buMembers > 0 ? `${(gestaoStats.buIssues / gestaoStats.buMembers).toFixed(1)} por pessoa` : '—'}
              </div>
            </div>
          )}

          {/* Em Andamento */}
          <div className="dh-card dh-card--progress" title="Issues sendo trabalhadas ativamente pelo time no momento">
            <div className="dh-card-header">
              <span className="dh-card-icon">⚙️</span>
              <span className="dh-card-title">Em Andamento</span>
            </div>
            <div className="dh-card-value">{gestaoStats.inProgress}</div>
            <div className="dh-card-sub">issues em execução</div>
          </div>

          {/* Aguardando */}
          <div className="dh-card dh-card--waiting" title="Issues paradas aguardando aprovação, revisão ou desbloqueio">
            <div className="dh-card-header">
              <span className="dh-card-icon">⏳</span>
              <span className="dh-card-title">Aguardando</span>
            </div>
            <div className="dh-card-value">{gestaoStats.waiting}</div>
            <div className="dh-card-sub">bloqueadas ou em revisão</div>
          </div>

          {/* Ação Recomendada */}
          <div className="dh-card dh-card--action">
            <div className="dh-card-header">
              <span className="dh-card-icon">🎯</span>
              <span className="dh-card-title">Ação Recomendada</span>
            </div>
            <p className="dh-card-action-text">
              {gestaoStats.overdue > 0
                ? `${gestaoStats.overdue} issues atrasadas precisam de atenção imediata.`
                : gestaoStats.stale > 0
                ? `${gestaoStats.stale} issues paralisadas. Desbloqueie-as.`
                : gestaoStats.waiting > 5
                ? `${gestaoStats.waiting} issues aguardando. Acelere revisões.`
                : 'Backlog sob controle. Continue monitorando.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Render C-LEVEL ────────────────────────────────────────────────────────
  if (isGestao && executiveStats) {
    return (
      <div className="dh-root dh-executive">
        <div className="dh-header">
          <h2 className="dh-title">Executivo</h2>
          <p className="dh-subtitle">Saúde do negócio e riscos estratégicos</p>
        </div>

        <div className="dh-grid-3">
          {/* Saúde */}
          <div className={`dh-card dh-card--health dh-card--${executiveStats.health}`} title={`${executiveStats.overdue} atrasadas, ${executiveStats.stale} paralisadas — Saúde: ${executiveStats.health === 'green' ? 'Verde' : executiveStats.health === 'yellow' ? 'Amarelo' : 'Vermelho'}`}>
            <div className="dh-card-header">
              <span className="dh-card-icon">
                {executiveStats.health === 'green' ? '✅' : executiveStats.health === 'yellow' ? '⚠️' : '🔴'}
              </span>
              <span className="dh-card-title">Saúde Geral</span>
            </div>
            <div className="dh-card-value">
              {executiveStats.health === 'green' ? 'Verde' : executiveStats.health === 'yellow' ? 'Amarelo' : 'Vermelho'}
            </div>
            <div className="dh-card-sub">
              {executiveStats.overdue} atrasadas · {executiveStats.stale} paralisadas
            </div>
          </div>

          {/* Total */}
          <div className="dh-card dh-card--total" title="Total de issues abertas e em andamento no pipeline completo">
            <div className="dh-card-header">
              <span className="dh-card-icon">📦</span>
              <span className="dh-card-title">Backlog Total</span>
            </div>
            <div className="dh-card-value">{executiveStats.total}</div>
            <div className="dh-card-sub">issues em pipeline</div>
          </div>

          {/* Capacidade */}
          <div className="dh-card dh-card--capacity">
            <div className="dh-card-header">
              <span className="dh-card-icon">⚡</span>
              <span className="dh-card-title">Capacidade</span>
            </div>
            <div className="dh-card-value">
              {executiveStats.total > 50 ? '⚠️ Alta' : executiveStats.total > 30 ? '✓ Normal' : '✓ Baixa'}
            </div>
            <div className="dh-card-sub">
              {executiveStats.total > 50 ? 'Considere aumentar recursos' : 'Sob controle'}
            </div>
          </div>

          {/* Clientes em Risco */}
          <div className="dh-card dh-card--risk" title="Contas (accounts) que possuem issues com prazo vencido — risco de impacto em SLA e satisfação">
            <div className="dh-card-header">
              <span className="dh-card-icon">🚨</span>
              <span className="dh-card-title">Clientes em Risco</span>
            </div>
            <div className="dh-card-value">{executiveStats.riskAccounts.length}</div>
            <div className="dh-card-sub">com issues atrasadas</div>
            {executiveStats.riskAccounts.length > 0 && (
              <div className="dh-card-list">
                {executiveStats.riskAccounts.map(acc => (
                  <span key={acc} className="dh-risk-account" title={`Account ${acc} possui issues atrasadas`}>{acc}</span>
                ))}
              </div>
            )}
          </div>

          {/* Recomendação */}
          <div className="dh-card dh-card--recommendation">
            <div className="dh-card-header">
              <span className="dh-card-icon">📋</span>
              <span className="dh-card-title">Recomendação</span>
            </div>
            <p className="dh-card-rec-text">
              {executiveStats.health === 'red'
                ? 'Situação crítica. Escalação necessária. Revisar SLAs e capacidade.'
                : executiveStats.health === 'yellow'
                ? 'Monitorar de perto. Alguns clientes em risco. Considere ações preventivas.'
                : 'Operação saudável. Continue com o plano atual.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
