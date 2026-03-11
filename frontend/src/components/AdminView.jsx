import { useState, useEffect } from 'react'
import './AdminView.css'

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    return 'http://localhost:8000'
  const host = window.location.host.replace(':5173', ':8000').replace('-5173.', '-8000.')
  return `${window.location.protocol}//${host}`
}
const API = getApiUrl()

export default function AdminView({ assignees = [], onBusChange }) {
  const [bus, setBus]         = useState([])
  const [selected, setSelected] = useState(null)   // BU selecionada para editar
  const [editName, setEditName] = useState('')
  const [saving, setSaving]   = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError]     = useState('')

  const load = () =>
    fetch(`${API}/api/admin/bus`)
      .then(r => r.json())
      .then(data => { setBus(data); onBusChange?.(data) })
      .catch(() => setError('Não foi possível carregar as BUs.'))

  useEffect(() => { load() }, [])

  const selectBu = (bu) => {
    setSelected(bu)
    setEditName(bu.name)
    setError('')
  }

  const toggleMember = async (name) => {
    if (!selected) return
    const members = selected.members.includes(name)
      ? selected.members.filter(m => m !== name)
      : [...selected.members, name]
    await saveBu({ ...selected, members })
  }

  const saveBu = async (updated) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/bus/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: updated.name, members: updated.members }),
      })
      if (!res.ok) throw new Error()
      const saved = await res.json()
      setBus(prev => prev.map(b => b.id === saved.id ? saved : b))
      setSelected(saved)
      setEditName(saved.name)
      onBusChange?.(bus.map(b => b.id === saved.id ? saved : b))
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleRename = async () => {
    if (!selected || !editName.trim()) return
    await saveBu({ ...selected, name: editName.trim() })
  }

  const createBu = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/bus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      const updated = [...bus, created]
      setBus(updated)
      setNewName('')
      setSelected(created)
      setEditName(created.name)
      onBusChange?.(updated)
    } catch {
      setError('Erro ao criar BU.')
    } finally {
      setCreating(false)
    }
  }

  const deleteBu = async (id) => {
    if (!confirm('Remover esta BU?')) return
    try {
      await fetch(`${API}/api/admin/bus/${id}`, { method: 'DELETE' })
      const updated = bus.filter(b => b.id !== id)
      setBus(updated)
      if (selected?.id === id) setSelected(null)
      onBusChange?.(updated)
    } catch {
      setError('Erro ao remover BU.')
    }
  }

  return (
    <div className="admin-root">
      <div className="admin-header">
        <h2 className="admin-title">Unidades de Negócio</h2>
        <p className="admin-subtitle">Agrupe responsáveis em BUs para usar como filtro no dashboard</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-body">
        {/* Lista de BUs */}
        <div className="admin-bu-list">
          <div className="admin-bu-list-header">BUs cadastradas</div>
          {bus.length === 0 && (
            <p className="admin-empty">Nenhuma BU criada ainda.</p>
          )}
          {bus.map(b => (
            <div
              key={b.id}
              className={`admin-bu-item ${selected?.id === b.id ? 'active' : ''}`}
              onClick={() => selectBu(b)}
            >
              <div className="admin-bu-item-info">
                <span className="admin-bu-item-name">{b.name}</span>
                <span className="admin-bu-item-count">{b.members.length} membro{b.members.length !== 1 ? 's' : ''}</span>
              </div>
              <button
                className="admin-bu-delete"
                onClick={e => { e.stopPropagation(); deleteBu(b.id) }}
                title="Remover BU"
              >&#x2715;</button>
            </div>
          ))}

          {/* Nova BU */}
          <div className="admin-new-bu">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createBu()}
              placeholder="Nome da nova BU..."
              className="admin-new-bu-input"
            />
            <button
              className="admin-new-bu-btn"
              onClick={createBu}
              disabled={creating || !newName.trim()}
            >
              {creating ? '...' : '+ Criar'}
            </button>
          </div>
        </div>

        {/* Editor de BU */}
        {selected ? (
          <div className="admin-bu-editor">
            <div className="admin-editor-header">
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRename()}
                onBlur={handleRename}
                className="admin-editor-name"
              />
              {saving && <span className="admin-saving">salvando...</span>}
            </div>

            <div className="admin-editor-section-label">
              Membros &mdash; clique para adicionar ou remover
            </div>

            {assignees.length === 0 && (
              <p className="admin-empty">Nenhum responsável disponível nos dados do Jira.</p>
            )}

            <div className="admin-members-grid">
              {assignees.map(name => {
                const active = selected.members.includes(name)
                return (
                  <button
                    key={name}
                    className={`admin-member-btn ${active ? 'active' : ''}`}
                    onClick={() => toggleMember(name)}
                  >
                    <span className="admin-member-dot" />
                    {name}
                    {active && <span className="admin-member-check">&#x2713;</span>}
                  </button>
                )
              })}
            </div>

            {selected.members.length > 0 && (
              <div className="admin-members-summary">
                <span className="admin-members-summary-label">Membros da BU:</span>
                {selected.members.map(m => (
                  <span key={m} className="admin-member-tag">{m}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="admin-bu-editor admin-bu-editor--empty">
            <p className="admin-empty">Selecione uma BU para editar seus membros</p>
          </div>
        )}
      </div>
    </div>
  )
}
