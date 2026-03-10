import './ProductStrip.css'

// Grupos de produtos: label, cor, padrão de match no campo product
const PRODUCT_GROUPS = [
  { key: 'sms',   label: 'SMS',   color: 'var(--azul-claro)',   match: v => /\+?sms/i.test(v) },
  { key: 'email', label: 'Email', color: 'var(--azul-primario)', match: v => /\+?e[\s-]?mail|painel.*email/i.test(v) },
  { key: 'rcs',   label: 'RCS',   color: 'var(--rosa)',          match: v => /\brcs\b/i.test(v) },
]

function calcGroup(issues, matchFn) {
  const grouped = issues.filter(i => i.product && matchFn(i.product))
  return {
    total:      grouped.length,
    inProgress: grouped.filter(i => i.status?.category === 'indeterminate').length,
    overdue:    grouped.filter(i => i.is_overdue).length,
  }
}

export default function ProductStrip({ issues }) {
  if (!issues?.length) return null

  const groups = PRODUCT_GROUPS.map(g => ({
    ...g,
    stats: calcGroup(issues, g.match),
  })).filter(g => g.stats.total > 0)

  if (!groups.length) return null

  return (
    <div className="product-strip">
      {groups.map(g => (
        <div key={g.key} className="ps-card" style={{ '--ps-color': g.color }}>
          <span className="ps-label">{g.label}</span>
          <span className="ps-total">{g.stats.total}</span>
          <div className="ps-sub">
            <span className="ps-sub-item ps-sub-progress">
              <span className="ps-dot" style={{ background: 'var(--azul-primario)' }} />
              {g.stats.inProgress} andamento
            </span>
            {g.stats.overdue > 0 && (
              <span className="ps-sub-item ps-sub-overdue">
                <span className="ps-dot" style={{ background: 'var(--rosa)' }} />
                {g.stats.overdue} atrasado{g.stats.overdue > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
