import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../apiUrl'
import './LoginView.css'

export default function LoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [backendStatus, setBackendStatus] = useState('checking')
  const [showPassword, setShowPassword] = useState(false)

  // Verificar conectividade com backend
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        if (res.ok) {
          setBackendStatus('online')
        } else {
          setBackendStatus('offline')
        }
      } catch (err) {
        console.error('Backend check error:', err)
        setBackendStatus('offline')
      }
    }
    checkBackend()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      console.log('Tentando login com:', email)
      console.log('API Base URL:', API_BASE_URL)

      const loginUrl = `${API_BASE_URL}/api/auth/login`
      console.log('Login URL:', loginUrl)

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password: password || '',
        }),
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)

      if (!response.ok) {
        let errorMsg = 'Erro ao fazer login'
        try {
          const errorData = await response.json()
          errorMsg = errorData.detail || errorMsg
        } catch (e) {
          errorMsg = `Erro ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMsg)
      }

      const data = await response.json()
      console.log('Login bem-sucedido:', data.user)

      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))

      onLoginSuccess(data.user)
    } catch (err) {
      console.error('Login error:', err)
      if (err.message.includes('Failed to fetch')) {
        setError('Não conseguimos conectar ao servidor. Verifique se o backend está rodando em ' + API_BASE_URL)
      } else {
        setError(err.message || 'Erro ao fazer login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = (demoEmail, demoPassword) => {
    setEmail(demoEmail)
    setPassword(demoPassword)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>📊 PGMais Dashboard</h1>
          <p>Gerenciador de Demandas</p>
        </div>

        {/* Backend Status */}
        <div className={`backend-status ${backendStatus}`}>
          <span className={`status-dot ${backendStatus}`}></span>
          {backendStatus === 'online' ? '✓ Backend online' : '✗ Backend offline'}
          {backendStatus === 'offline' && <span className="text-small"> ({API_BASE_URL})</span>}
        </div>

        {error && (
          <div className="login-error">
            <strong>❌ Erro:</strong> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Corporativo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@pgmais.com.br ou @ciclo"
              disabled={loading}
              required
            />
            <small>Use email terminado em @pgmais.com.br ou @ciclo</small>
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Senha {' '}
              <span className="text-optional">
                (opcional para usuários normais)
              </span>
            </label>
            <div className="password-input-group">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para login sem senha"
                disabled={loading}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading || backendStatus === 'offline'} className="login-button">
            {loading ? (
              <>
                <span className="spinner"></span> Entrando...
              </>
            ) : (
              'Entrar ao Dashboard'
            )}
          </button>
        </form>

        {/* Demo Users */}
        <div className="login-demos">
          <p><strong>🔑 Credenciais de Demo:</strong></p>

          <div className="demo-buttons">
            <button
              type="button"
              className="demo-btn admin"
              onClick={() => handleDemoLogin('andressa.soares@pgmais.com.br', 'Admin@2025')}
              disabled={loading}
            >
              <span>👤 Admin</span>
              <span className="email-small">andressa.soares@pgmais.com.br</span>
            </button>

            <button
              type="button"
              className="demo-btn user"
              onClick={() => handleDemoLogin('usuario@pgmais.com.br', '')}
              disabled={loading}
            >
              <span>👥 Usuário Normal</span>
              <span className="email-small">usuario@pgmais.com.br</span>
            </button>

            <button
              type="button"
              className="demo-btn ciclo"
              onClick={() => handleDemoLogin('teste@ciclo', '')}
              disabled={loading}
            >
              <span>🏢 Ciclo User</span>
              <span className="email-small">teste@ciclo</span>
            </button>
          </div>
        </div>

        <div className="login-info">
          <p>💡 <strong>Dica:</strong> Qualquer email @pgmais.com.br ou @ciclo funciona!</p>
        </div>
      </div>
    </div>
  )
}
