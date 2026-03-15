import { useState } from 'react'
import { API_BASE_URL } from '../apiUrl'
import './AdminSettings.css'

export default function AdminSettings({ user, onClose }) {
  const [activeTab, setActiveTab] = useState('admins')
  const [admins, setAdmins] = useState([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token')
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }
  }

  const loadAdmins = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/admins`, {
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setAdmins(data)
      }
    } catch (err) {
      setError('Erro ao carregar admins: ' + err.message)
    }
  }

  const addAdmin = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/admins`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: newAdminEmail.toLowerCase().trim(),
          password: newAdminPassword,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Erro ao adicionar admin')
      }

      setSuccess('Admin adicionado com sucesso!')
      setNewAdminEmail('')
      setNewAdminPassword('')
      loadAdmins()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteAdmin = async (email) => {
    if (!confirm(`Tem certeza que deseja remover ${email} como admin?`)) return

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/admins/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (!res.ok) throw new Error('Erro ao remover admin')

      setSuccess('Admin removido com sucesso!')
      loadAdmins()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="admin-settings">
      <div className="admin-settings-header">
        <h2>⚙️ Configurações de Admin</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'admins' ? 'active' : ''}`}
          onClick={() => { setActiveTab('admins'); loadAdmins() }}
        >
          👤 Administradores
        </button>
      </div>

      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {activeTab === 'admins' && (
        <div className="admin-section">
          <div className="admin-form">
            <h3>Adicionar Novo Admin</h3>
            <form onSubmit={addAdmin}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="novo-admin@pgmais.com.br"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Senha</label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Senha segura"
                  required
                  disabled={loading}
                />
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Adicionando...' : 'Adicionar Admin'}
              </button>
            </form>
          </div>

          <div className="admin-list">
            <h3>Administradores Atuais</h3>
            {admins.length === 0 ? (
              <p className="empty">Nenhum admin registrado</p>
            ) : (
              <ul>
                {admins.map((admin) => (
                  <li key={admin.email}>
                    <span className="admin-email">{admin.email}</span>
                    {admin.email !== user?.email && (
                      <button
                        className="delete-btn"
                        onClick={() => deleteAdmin(admin.email)}
                      >
                        Remover
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
