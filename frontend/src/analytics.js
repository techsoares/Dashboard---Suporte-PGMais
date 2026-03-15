import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com'

// Só inicializa se a chave estiver configurada
if (KEY) {
  posthog.init(KEY, {
    api_host: HOST,
    autocapture: false,       // só eventos explícitos — evita ruído
    capture_pageview: false,  // controlamos manualmente
    persistence: 'localStorage',
  })
}

export function identify(email) {
  if (!KEY || !email) return
  posthog.identify(email)
}

export function track(event, props = {}) {
  if (!KEY) return
  posthog.capture(event, props)
}
