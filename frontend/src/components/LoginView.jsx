import { useState, useEffect } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { API_BASE_URL } from '../apiUrl'
import './LoginView.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function LoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [backendStatus, setBackendStatus] = useState('checking')
  const [showPassword, setShowPassword] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

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
      const loginUrl = `${API_BASE_URL}/api/auth/login`

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

      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))

      onLoginSuccess(data.user)
    } catch (err) {
      if (err.message.includes('Failed to fetch')) {
        setError('Não conseguimos conectar ao servidor. Verifique se o backend está rodando.')
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

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('')
    setGoogleLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      })

      if (!response.ok) {
        let errorMsg = 'Erro ao fazer login com Google'
        try {
          const errorData = await response.json()
          errorMsg = errorData.detail || errorMsg
        } catch {
          errorMsg = `Erro ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMsg)
      }

      const data = await response.json()

      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))

      onLoginSuccess(data.user)
    } catch (err) {
      if (err.message.includes('Failed to fetch')) {
        setError('Não conseguimos conectar ao servidor. Verifique se o backend está rodando.')
      } else {
        setError(err.message || 'Erro ao fazer login com Google')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleGoogleError = () => {
    setError('Falha no login com Google. Tente novamente.')
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
          {backendStatus === 'offline' && <span className="text-small"> (servidor indisponível)</span>}
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

          {isAdminMode && (
            <div className="form-group">
              <label htmlFor="password">Senha do Administrador</label>
              <div className="password-input-group">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
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
          )}

          <button 
            type="button" 
            className="admin-access-btn"
            onClick={() => setIsAdminMode(!isAdminMode)}
            disabled={loading}
          >
            {isAdminMode ? '← Voltar' : '🔐 Acesso Admin'}
          </button>

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

        {GOOGLE_CLIENT_ID && (
          <div className="google-login-section">
            <div className="login-divider">
              <span>ou</span>
            </div>

            {googleLoading ? (
              <div className="google-loading">
                <span className="spinner"></span> Entrando com Google...
              </div>
            ) : (
              <div className="google-btn-wrapper">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  size="large"
                  width="100%"
                  text="signin_with"
                  shape="rectangular"
                  locale="pt-BR"
                />
              </div>
            )}
          </div>
        )}

        <div className="login-demos">
          <p className="login-hint">Use seu email corporativo @pgmais.com.br ou @ciclo para entrar.</p>
        </div>
      </div>
    </div>
  )
}
