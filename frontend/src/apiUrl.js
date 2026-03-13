/**
 * Resolve a URL base da API do backend.
 *
 * Prioridade:
 *   1. Variável de ambiente VITE_API_URL (definida no .env)
 *   2. localhost:8000 quando rodando localmente
 *   3. Derivação automática do host atual (Codespaces / tunnels)
 */
export function getApiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL

  const { hostname, host, protocol } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000'
  }

  const backendHost = host.replace(':5173', ':8000').replace('-5173.', '-8000.')
  return `${protocol}//${backendHost}`
}

export const API_BASE_URL = getApiUrl()
