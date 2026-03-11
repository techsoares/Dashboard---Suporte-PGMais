import { useState, useMemo } from 'react'
import DevCard from './DevCard'
import './DevGrid.css'

export default function DevGrid({ devs, jiraBaseUrl, bus }) {
  const [collapsed, setCollapsed] = useState({})

  const toggle = (name) => setCollapsed(prev => ({ ...prev, [name]: !prev[name] }))

  // Group devs by BU
  const groups = useMemo(() => {
    if (!devs?.length) return []
    if (!bus?.length) {
      // No BUs configured — show flat grid
      return [{ name: null, devs }]
    }

    const assigned = new Set()
    const result = bus.map(bu => {
      const buDevs = devs.filter(d => bu.members.includes(d.assignee?.display_name))
      buDevs.forEach(d => assigned.add(d.assignee?.display_name))
      return { name: bu.name, devs: buDevs }
    }).filter(g => g.devs.length > 0)

    // Devs not in any BU
    const unassigned = devs.filter(d => !assigned.has(d.assignee?.display_name))
    if (unassigned.length > 0) {
      result.push({ name: 'Sem BU', devs: unassigned })
    }

    return result
  }, [devs, bus])

  if (!devs?.length) {
    return <div className="dev-grid-empty">Nenhum dev com issues ativas.</div>
  }

  return (
    <div className="bu-columns" style={{ gridTemplateColumns: `repeat(${groups.length}, 1fr)` }}>
      {groups.map((group) => (
        <div key={group.name || '__flat__'} className="bu-column">
          {group.name && (
            <button className="bu-column-header" onClick={() => toggle(group.name)}>
              <span className="bu-column-name">{group.name}</span>
              <span className="bu-column-count">{group.devs.reduce((s, d) => s + d.active_issues.length, 0)}</span>
            </button>
          )}
          {!collapsed[group.name] && (
            <div className="bu-column-cards">
              {group.devs.map((dev) => (
                <DevCard key={dev.assignee.account_id} dev={dev} jiraBaseUrl={jiraBaseUrl} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
