import DevCard from './DevCard'
import './DevGrid.css'

export default function DevGrid({ devs, jiraBaseUrl }) {
  if (!devs?.length) {
    return <div className="dev-grid-empty">Nenhum dev com issues ativas.</div>
  }

  return (
    <div className="dev-grid">
      {devs.map((dev) => (
        <DevCard key={dev.assignee.account_id} dev={dev} jiraBaseUrl={jiraBaseUrl} />
      ))}
    </div>
  )
}
