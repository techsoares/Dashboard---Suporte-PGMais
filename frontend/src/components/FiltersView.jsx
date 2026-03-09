import { useState, useEffect } from 'react'
import './FiltersView.css'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function FiltersView({ onFiltersChange, currentFilters }) {
  const [accounts, setAccounts] = useState([])
  const [products, setProducts] = useState([])
  const [assignees, setAssignees] = useState([])
  const [issueTypes, setIssueTypes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFilterOptions()
  }, [])

  const fetchFilterOptions = async () => {
    try {
      const res = await fetch(`${API}/api/dashboard`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      // Extrair opções únicas dos dados
      const uniqueAccounts = [...new Set(data.backlog.map(i => i.account).filter(Boolean))]
      const uniqueProducts = [...new Set(data.backlog.map(i => i.product).filter(Boolean))]
      const uniqueAssignees = [...new Set(data.backlog.map(i => i.assignee?.display_name).filter(Boolean))]
      const uniqueIssueTypes = [...new Set(data.backlog.map(i => i.issue_type.name).filter(Boolean))]

      setAccounts(uniqueAccounts)
      setProducts(uniqueProducts)
      setAssignees(uniqueAssignees)
      setIssueTypes(uniqueIssueTypes)
    } catch (e) {
      console.error('Erro ao carregar opções de filtro:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...currentFilters }
    if (value) {
      newFilters[filterType] = value
    } else {
      delete newFilters[filterType]
    }
    onFiltersChange(newFilters)
  }

  const clearFilters = () => {
    onFiltersChange({})
  }

  if (loading) {
    return (
      <div className="filters-loading">
        <div className="spinner" />
        <p>Carregando opções de filtro...</p>
      </div>
    )
  }

  return (
    <div className="filters-view">
      <h2>Filtros do Dashboard</h2>
      <p>Selecione os filtros desejados para visualizar dados específicos:</p>

      <div className="filters-grid">
        <div className="filter-group">
          <label htmlFor="account-select">Account (Cliente):</label>
          <select
            id="account-select"
            value={currentFilters.account || ''}
            onChange={(e) => handleFilterChange('account', e.target.value)}
          >
            <option value="">Todos</option>
            {accounts.map(account => (
              <option key={account} value={account}>{account}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="product-select">Produtos:</label>
          <select
            id="product-select"
            value={currentFilters.product || ''}
            onChange={(e) => handleFilterChange('product', e.target.value)}
          >
            <option value="">Todos</option>
            {products.map(product => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="assignee-select">Responsável:</label>
          <select
            id="assignee-select"
            value={currentFilters.assignee || ''}
            onChange={(e) => handleFilterChange('assignee', e.target.value)}
          >
            <option value="">Todos</option>
            {assignees.map(assignee => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="issue-type-select">Tipo de Item:</label>
          <select
            id="issue-type-select"
            value={currentFilters.issue_type || ''}
            onChange={(e) => handleFilterChange('issue_type', e.target.value)}
          >
            <option value="">Todos</option>
            {issueTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="filters-actions">
        <button onClick={clearFilters} className="clear-filters-btn">
          Limpar Filtros
        </button>
        <button onClick={() => onFiltersChange(currentFilters)} className="apply-filters-btn">
          Aplicar Filtros
        </button>
      </div>

      <div className="active-filters">
        <h3>Filtros Ativos:</h3>
        {Object.keys(currentFilters).length === 0 ? (
          <p>Nenhum filtro aplicado</p>
        ) : (
          <ul>
            {currentFilters.account && <li>Account: {currentFilters.account}</li>}
            {currentFilters.product && <li>Produto: {currentFilters.product}</li>}
            {currentFilters.assignee && <li>Responsável: {currentFilters.assignee}</li>}
            {currentFilters.issue_type && <li>Tipo: {currentFilters.issue_type}</li>}
          </ul>
        )}
      </div>
    </div>
  )
}