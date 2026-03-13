import { useState, useEffect, useMemo } from 'react'
import { API_BASE_URL } from '../apiUrl'
import './AdminView.css'

export default function AdminView({ assignees: fallbackAssignees = [], onBusChange, user }) {
  const [bus, setBus]         = useState([])
  const [selected, setSelected] = useState(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('operacional')
  const [saving, setSaving]   = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('operacional')
  const [creating, setCreating] = useState(false)
  const [error, setError]     = useState('')
  const [jiraUsers, setJiraUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [admins, setAdmins] = useState([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState('bus')
  const [userFilter, setUserFilter] = useState('')
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [editAdminPassword, setEditAdminPassword] = useState('')

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token')
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  }

  const load = () =>
    fetch(`${API_BASE_URL}/api/admin/bus`, {
      headers: getAuthHeaders()
    })
      .then(r => r.json())
      .then(data => { setBus(data); onBusChange?.(data) })
      .catch(() => setError('Não foi possível carregar as BUs.'))

  const loadJiraUsers = () => {
    setLoadingUsers(true)
    fetch(`${API_BASE_URL}/api/jira/users`, {
      headers: getAuthHeaders()
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (Array.isArray(data)) {
          setJiraUsers(data)
        }
      })
      .catch(err => {
        setError('Não foi possível carregar usuários do Jira.')
      })
      .finally(() => setLoadingUsers(false))
  }

  useEffect(() => { load(); loadJiraUsers(); loadAdmins() }, [])

  const loadAdmins = () => {
    fetch(`${API_BASE_URL}/api/admin/admins`, {
      headers: getAuthHeaders()
    })
      .then(r => r.json())
      .then(data => setAdmins(Array.isArray(data) ? data : []))
      .catch(() => setError('Não foi possível carregar admins.'))
  }

  const addAdmin = async () => {
    if (!newAdminEmail.trim() || !newAdminPassword.trim()) {
      setError('Email e senha são obrigatórios')
      return
    }
    setAddingAdmin(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/admins`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: newAdminEmail.trim(), password: newAdminPassword.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Erro ao adicionar admin')
      }
      await loadAdmins()
      setNewAdminEmail('')
      setNewAdminPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingAdmin(false)
    }
  }

  const updateAdminPassword = async (email) => {
    if (!editAdminPassword.trim()) {
      setError('Senha não pode ser vazia')
      return
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/admins/${encodeURIComponent(email)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ password: editAdminPassword.trim() }),
      })
      if (!res.ok) throw new Error()
      setEditingAdmin(null)
      setEditAdminPassword('')
      await loadAdmins()
    } catch {
      setError('Erro ao atualizar senha.')
    }
  }

  const removeAdmin = async (email) => {
    if (!confirm(`Remover admin ${email}?`)) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/admins/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error()
      await loadAdmins()
    } catch {
      setError('Erro ao remover admin.')
    }
  }

  const assignees = jiraUsers.length > 0
    ? jiraUsers.map(u => u.display_name).filter(Boolean)
    : fallbackAssignees

  const filteredAssignees = useMemo(() => {
    if (!userFilter.trim()) return assignees
    const query = userFilter.trim().toLowerCase()
    return assignees.filter(name => name.toLowerCase().includes(query))
  }, [assignees, userFilter])

  // Usuários sem BU
  const usersWithoutBu = useMemo(() => {
    const allMembers = new Set()
    bus.forEach(bu => {
      bu.members.forEach(member => allMembers.add(member))
    })
    return assignees.filter(name => !allMembers.has(name))
  }, [assignees, bus])

  const filteredUsersWithoutBu = useMemo(() => {
    if (!userFilter.trim()) return usersWithoutBu
    const query = userFilter.trim().toLowerCase()
    return usersWithoutBu.filter(name => name.toLowerCase().includes(query))
  }, [usersWithoutBu, userFilter])

  const selectBu = (bu) => {
    setSelected(bu)
    setEditName(bu.name)
    setEditType(bu.bu_type || 'operacional')
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
      const res = await fetch(`${API_BASE_URL}/api/admin/bus/${updated.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: updated.name, members: updated.members, bu_type: updated.bu_type || 'operacional' }),
      })
      if (!res.ok) throw new Error()
      const saved = await res.json()
      const updatedBus = bus.map(bu => bu.id === saved.id ? saved : bu)
      setBus(updatedBus)
      setSelected(saved)
      setEditName(saved.name)
      setEditType(saved.bu_type || 'operacional')
      onBusChange?.(updatedBus)
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleRename = async () => {
    if (!selected || !editName.trim()) return
    await saveBu({ ...selected, name: editName.trim(), bu_type: editType })
  }

  const handleTypeChange = async (newType) => {
    setEditType(newType)
    if (selected) {
      await saveBu({ ...selected, bu_type: newType })
    }
  }

  const createBu = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/bus`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newName.trim(), bu_type: newType }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      const updated = [...bus, created]
      setBus(updated)
      setNewName('')
      setNewType('operacional')
      setSelected(created)
      setEditName(created.name)
      setEditType(created.bu_type || 'operacional')
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
      await fetch(`${API_BASE_URL}/api/admin/bus/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      const updated = bus.filter(b => b.id !== id)
      setBus(updated)
      if (selected?.id === id) setSelected(null)
      onBusChange?.(updated)
    } catch {
      setError('Erro ao remover BU.')
    }
  }

  const handleDragStart = (e, name) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', name)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e, bu) => {
    e.preventDefault()
    const name = e.dataTransfer.getData('text/plain')
    if (!name || !bu) return
    
    const members = bu.members.includes(name)
      ? bu.members
      : [...bu.members, name]
    
    await saveBu({ ...bu, members })
    if (selected?.id === bu.id) {
      setSelected({ ...bu, members })
    }
  }

  return (
    <div className="admin-root">
      <div className="admin-header">
        <h2 className="admin-title">Painel Administrativo</h2>
        <div className="admin-tabs">
          <button 
            className={`admin-tab ${activeTab === 'bus' ? 'active' : ''}`}
            onClick={() => setActiveTab('bus')}
          >
            Unidades de Negócio
          </button>
          <button 
            className={`admin-tab ${activeTab === 'admins' ? 'active' : ''}`}
            onClick={() => setActiveTab('admins')}
          >
            Administradores
          </button>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {activeTab === 'bus' && (
        <>
          <p className="admin-subtitle">
            Arraste usuários para as BUs ou clique para adicionar/remover
            {jiraUsers.length > 0 && <span className="admin-user-count"> — {jiraUsers.length} profissionais ativos no Jira</span>}
            {loadingUsers && <span className="admin-user-count"> — carregando usuários do Jira...</span>}
          </p>

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
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, b)}
                >
                  <div className="admin-bu-item-info">
                    <span className="admin-bu-item-name">
                      {b.name}
                      {b.bu_type === 'gestao' && <span className="admin-bu-type-badge">Gestão</span>}
                    </span>
                    <span className="admin-bu-item-count">{b.members.length} membro{b.members.length !== 1 ? 's' : ''}</span>
                  </div>
                  <button
                    className="admin-bu-delete"
                    onClick={e => { e.stopPropagation(); deleteBu(b.id) }}
                    title="Remover BU"
                  >&#x2715;</button>
                </div>
              ))}

              {/* Usuários sem BU - sempre visível */}
              {usersWithoutBu.length > 0 && (
                <div
                  className={`admin-bu-item admin-bu-item--no-bu ${!selected ? 'active' : ''}`}
                  onClick={() => setSelected(null)}
                >
                  <div className="admin-bu-item-info">
                    <span className="admin-bu-item-name">
                      ⚠️ Sem BU
                    </span>
                    <span className="admin-bu-item-count">{usersWithoutBu.length} usuário{usersWithoutBu.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}

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
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                  className="admin-type-select admin-type-select--small"
                >
                  <option value="operacional">Operacional</option>
                  <option value="gestao">Gestão</option>
                </select>
                <button
                  className="admin-new-bu-btn"
                  onClick={createBu}
                  disabled={creating || !newName.trim()}
                >
                  {creating ? '...' : '+ Criar'}
                </button>
              </div>
            </div>

            {/* Editor de BU ou Usuários sem BU */}
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
                  <select
                    value={editType}
                    onChange={e => handleTypeChange(e.target.value)}
                    className="admin-type-select"
                  >
                    <option value="operacional">Operacional</option>
                    <option value="gestao">Gestão (Diretoria / C-Level)</option>
                  </select>
                  {saving && <span className="admin-saving">salvando...</span>}
                </div>

                <div className="admin-editor-section-label">
                  Todos os usuários — arraste ou clique para adicionar
                  {editType === 'gestao' && <span className="admin-gestao-hint"> — membros desta BU podem despriorizar chamados</span>}
                </div>

                <div className="admin-user-filter">
                  <input
                    type="text"
                    value={userFilter}
                    onChange={e => setUserFilter(e.target.value)}
                    placeholder="Filtrar por nome..."
                    className="admin-user-filter-input"
                  />
                  {userFilter && <button className="admin-user-filter-clear" onClick={() => setUserFilter('')}>✕</button>}
                </div>

                {filteredAssignees.length === 0 && (
                  <p className="admin-empty">Nenhum usuário encontrado.</p>
                )}

                <div className="admin-members-grid">
                  {filteredAssignees.map(name => {
                    const active = selected.members.includes(name)
                    return (
                      <button
                        key={name}
                        className={`admin-member-btn ${active ? 'active' : ''}`}
                        onClick={() => toggleMember(name)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, name)}
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
              <div className="admin-bu-editor">
                <div className="admin-no-bu-header">
                  <h3 className="admin-no-bu-title">Usuários sem BU</h3>
                  <p className="admin-no-bu-desc">
                    {usersWithoutBu.length} profissional{usersWithoutBu.length !== 1 ? 'is' : ''} sem unidade de negócio vinculada
                  </p>
                </div>

                <div className="admin-user-filter">
                  <input
                    type="text"
                    value={userFilter}
                    onChange={e => setUserFilter(e.target.value)}
                    placeholder="Filtrar por nome..."
                    className="admin-user-filter-input"
                  />
                  {userFilter && <button className="admin-user-filter-clear" onClick={() => setUserFilter('')}>✕</button>}
                </div>

                {filteredUsersWithoutBu.length === 0 && (
                  <p className="admin-empty">
                    {userFilter ? 'Nenhum usuário encontrado.' : 'Todos os usuários estão vinculados a uma BU.'}
                  </p>
                )}

                {filteredUsersWithoutBu.length > 0 && (
                  <>
                    <div className="admin-no-bu-hint">
                      <span className="admin-no-bu-hint-icon">👉</span>
                      Arraste os usuários para uma BU na lista ao lado ou selecione uma BU e clique no usuário
                    </div>
                    <div className="admin-members-grid">
                      {filteredUsersWithoutBu.map(name => (
                        <button
                          key={name}
                          className="admin-member-btn admin-member-btn--no-bu"
                          draggable
                          onDragStart={(e) => handleDragStart(e, name)}
                        >
                          <span className="admin-member-dot" />
                          {name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'admins' && (
        <div className="admin-body">
          <div className="admin-admins-section">
            <h3 className="admin-section-title">Administradores do Sistema</h3>
            <p className="admin-section-desc">Admins têm acesso total ao painel administrativo e podem remover priorizações de chamados.</p>
            
            <div className="admin-admins-list">
              {admins.length === 0 && <p className="admin-empty">Nenhum admin cadastrado.</p>}
              {admins.map(admin => (
                <div key={admin.email} className="admin-admin-item">
                  <div className="admin-admin-info">
                    <span className="admin-admin-email">{admin.email}</span>
                    {admin.email === user?.email && <span className="admin-admin-badge">Você</span>}
                  </div>
                  <div className="admin-admin-actions">
                    {editingAdmin === admin.email ? (
                      <>
                        <input
                          type="password"
                          value={editAdminPassword}
                          onChange={e => setEditAdminPassword(e.target.value)}
                          placeholder="Nova senha"
                          className="admin-admin-password-input"
                        />
                        <button
                          className="admin-admin-save"
                          onClick={() => updateAdminPassword(admin.email)}
                        >✓</button>
                        <button
                          className="admin-admin-cancel"
                          onClick={() => { setEditingAdmin(null); setEditAdminPassword('') }}
                        >✕</button>
                      </>
                    ) : (
                      <>
                        <button
                          className="admin-admin-edit"
                          onClick={() => setEditingAdmin(admin.email)}
                          title="Editar senha"
                        >🔑</button>
                        {admin.email !== user?.email && (
                          <button
                            className="admin-admin-remove"
                            onClick={() => removeAdmin(admin.email)}
                            title="Remover admin"
                          >✕</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-add-admin">
              <h4 className="admin-add-admin-title">Adicionar Novo Admin</h4>
              <div className="admin-add-admin-form">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                  placeholder="email@pgmais.com.br"
                  className="admin-add-admin-input"
                />
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={e => setNewAdminPassword(e.target.value)}
                  placeholder="Senha"
                  className="admin-add-admin-input"
                />
                <button
                  className="admin-add-admin-btn"
                  onClick={addAdmin}
                  disabled={addingAdmin || !newAdminEmail.trim() || !newAdminPassword.trim()}
                >
                  {addingAdmin ? 'Adicionando...' : '+ Adicionar Admin'}
                </button>
              </div>
              <small className="admin-add-admin-hint">
                O novo admin poderá fazer login com o email e senha definidos aqui.
              </small>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
