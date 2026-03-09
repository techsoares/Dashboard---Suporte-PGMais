import './ProductView.css'

export default function ProductView({ data }) {
  // Agrupar por produto e calcular métricas
  const productStats = data.backlog.reduce((acc, issue) => {
    const product = issue.product || 'Sem Produto'
    if (!acc[product]) {
      acc[product] = {
        name: product,
        total: 0,
        inProgress: 0,
        overdue: 0,
        done: 0,
        avgTimeInBacklog: 0,
        totalBacklogTime: 0
      }
    }

    acc[product].total++
    if (issue.status.category === 'indeterminate') acc[product].inProgress++
    if (issue.is_overdue) acc[product].overdue++
    if (issue.status.category === 'done') acc[product].done++

    // Calcular tempo médio em backlog (em horas)
    const backlogHours = issue.time_in_status.backlog_ms / (1000 * 60 * 60)
    acc[product].totalBacklogTime += backlogHours

    return acc
  }, {})

  // Calcular médias e ranking
  Object.values(productStats).forEach(product => {
    product.avgTimeInBacklog = product.total > 0 ? product.totalBacklogTime / product.total : 0
  })

  const rankedProducts = Object.values(productStats)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10) // Top 10

  // Dados para o radar chart (normalizados 0-100)
  const getRadarData = (product) => {
    const maxTotal = Math.max(...rankedProducts.map(p => p.total))
    const maxOverdue = Math.max(...rankedProducts.map(p => p.overdue))
    const maxAvgTime = Math.max(...rankedProducts.map(p => p.avgTimeInBacklog))

    return {
      total: (product.total / maxTotal) * 100,
      progress: (product.inProgress / product.total) * 100,
      overdue: maxOverdue > 0 ? (product.overdue / maxOverdue) * 100 : 0,
      efficiency: maxAvgTime > 0 ? Math.max(0, 100 - (product.avgTimeInBacklog / maxAvgTime) * 100) : 100
    }
  }

  const RadarChart = ({ data, size = 120 }) => {
    const center = size / 2
    const radius = size / 2 - 20
    const angles = [0, 72, 144, 216, 288] // 5 pontos para pentágono

    const points = angles.map((angle, i) => {
      const value = data[Object.keys(data)[i]] / 100
      const x = center + Math.cos((angle - 90) * Math.PI / 180) * radius * value
      const y = center + Math.sin((angle - 90) * Math.PI / 180) * radius * value
      return `${x},${y}`
    }).join(' ')

    return (
      <svg width={size} height={size} className="radar-chart">
        {/* Grid */}
        {[0.2, 0.4, 0.6, 0.8, 1].map(level => (
          <polygon
            key={level}
            points={angles.map(angle => {
              const x = center + Math.cos((angle - 90) * Math.PI / 180) * radius * level
              const y = center + Math.sin((angle - 90) * Math.PI / 180) * radius * level
              return `${x},${y}`
            }).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        ))}

        {/* Eixos */}
        {angles.map(angle => (
          <line
            key={angle}
            x1={center}
            y1={center}
            x2={center + Math.cos((angle - 90) * Math.PI / 180) * radius}
            y2={center + Math.sin((angle - 90) * Math.PI / 180) * radius}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
        ))}

        {/* Dados */}
        <polygon
          points={points}
          fill="rgba(52, 152, 219, 0.3)"
          stroke="#3498db"
          strokeWidth="2"
        />
      </svg>
    )
  }

  return (
    <div className="product-view">
      <h2>Visão Produto - Ranking e Análise</h2>

      <div className="products-grid">
        {rankedProducts.map((product, index) => (
          <div key={product.name} className="product-card">
            <div className="product-header">
              <div className="product-rank">#{index + 1}</div>
              <h3 className="product-name">{product.name}</h3>
            </div>

            <div className="product-stats">
              <div className="stat">
                <span className="stat-value">{product.total}</span>
                <span className="stat-label">Total</span>
              </div>
              <div className="stat">
                <span className="stat-value">{product.inProgress}</span>
                <span className="stat-label">Em Andamento</span>
              </div>
              <div className="stat">
                <span className="stat-value">{product.overdue}</span>
                <span className="stat-label">Atrasadas</span>
              </div>
              <div className="stat">
                <span className="stat-value">{product.avgTimeInBacklog.toFixed(1)}h</span>
                <span className="stat-label">Tempo Médio Backlog</span>
              </div>
            </div>

            <div className="radar-container">
              <RadarChart data={getRadarData(product)} />
              <div className="radar-legend">
                <div className="legend-item">
                  <span className="legend-color" style={{background: '#3498db'}}></span>
                  <span>Total / Progresso / Atraso / Eficiência</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}