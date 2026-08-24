import axios from 'axios'
import { supabase } from './supabase'
import { searchMockCatalog } from './mockCatalog'

// Local dev: Vite proxies /api → localhost:3001 (no VITE_API_URL needed)
// Production: set VITE_API_URL=https://haat-backend.onrender.com in Netlify env vars
const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
const LOCAL_DEV_FALLBACK = import.meta.env.DEV && !import.meta.env.VITE_API_URL
const FORCE_LOCAL_MODE = LOCAL_DEV_FALLBACK && import.meta.env.VITE_FRONTEND_ONLY !== 'false'
let backendDownUntil = 0

const client = axios.create({ baseURL: BASE, timeout: 60_000 })

function isConnectionFailure(err) {
  const msg = String(err?.message ?? '')
  return !err?.response || /network error|econnrefused|err_network|failed to fetch/i.test(msg)
}

function shouldBypassBackend() {
  return FORCE_LOCAL_MODE || (LOCAL_DEV_FALLBACK && Date.now() < backendDownUntil)
}

async function withLocalFallback(requestFn, fallbackFn) {
  if (shouldBypassBackend()) {
    return fallbackFn()
  }

  try {
    return await requestFn()
  } catch (err) {
    if (LOCAL_DEV_FALLBACK && isConnectionFailure(err)) {
      // Avoid spamming Vite proxy errors for every request while backend is offline.
      backendDownUntil = Date.now() + 120_000
      return fallbackFn()
    }
    throw err
  }
}

// Attach Supabase access token to every request automatically
client.interceptors.request.use(async config => {
  if (supabase?.auth) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  }
  return config
})

export const searchProducts = (query, mode = 'catalog') =>
  withLocalFallback(
    () => client.post('/search', { query, mode }).then(r => r.data),
    () => Promise.resolve(searchMockCatalog(query, mode))
  )

export const agentShop = (query, sessionId) =>
  client.post('/agent/shop', { query, sessionId }).then(r => r.data)

export const transcribeAudio = audioBlob => {
  const form = new FormData()
  form.append('audio', audioBlob, 'recording.webm')
  return client.post('/voice/transcribe', form).then(r => r.data)
}

export const speakText = text =>
  client.post('/voice/speak', { text }, { responseType: 'arraybuffer' })
    .then(r => r.data)
