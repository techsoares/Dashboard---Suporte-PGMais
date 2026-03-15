import { useEffect } from 'react'
import { API_BASE_URL } from '../apiUrl'

export default function SSOCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Obtém o token da URL (ex: ?token=xyz ou ?code=xyz)
        const params = new URLSearchParams(window.location.search)
        const token = params.get('token') || params.get('code')
        const email = params.get('email')

        if (token && email) {
          // Se temos token e email do SSO
          localStorage.setItem('access_token', token)
          
          // Buscar dados do usuário
          const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
          })

          if (response.ok) {
            const user = await response.json()
            localStorage.setItem('user', JSON.stringify(user))
            
            // Redirecionar para dashboard
            window.location.href = '/'
          } else {
            throw new Error('Falha ao buscar dados do usuário')
          }
        } else {
          throw new Error('Token ou email não fornecido')
        }
      } catch (error) {
        console.error('Erro no callback SSO:', error)
        // Redirecionar para login em caso de erro
        window.location.href = '/'
      }
    }

    handleCallback()
  }, [])

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px'
        }}>⏳</div>
        <h2>Processando login...</h2>
        <p>Por favor aguarde</p>
      </div>
    </div>
  )
}
