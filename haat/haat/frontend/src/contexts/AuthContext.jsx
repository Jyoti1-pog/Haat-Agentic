import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const AUTH_NOT_CONFIGURED = 'Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.'

// ── Normalise Supabase user → app user shape ──────────────────────────────────
function normaliseUser(supabaseUser) {
  if (!supabaseUser) return null
  const meta = supabaseUser.user_metadata ?? {}
  return {
    id:        supabaseUser.id,
    email:     supabaseUser.email,
    name:      meta.full_name ?? meta.name ?? meta.email ?? supabaseUser.email,
    avatar:    meta.avatar_url ?? null,
    onboarded: meta.onboarded ?? false,
  }
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Sync with Supabase session on mount + auth state changes ─────────────
  useEffect(() => {
    if (!supabase?.auth) {
      setUser(null)
      setLoading(false)
      return
    }

    // Get current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(normaliseUser(session?.user ?? null))
      setLoading(false)
    })

    // Listen for sign-in / sign-out / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(normaliseUser(session?.user ?? null))
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Get the current Supabase access token (for API calls) ─────────────────
  const token = useCallback(async () => {
    if (!supabase?.auth) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  // ── register (email + password) ───────────────────────────────────────────
  const register = useCallback(async ({ email, password, name }) => {
    if (!supabase?.auth) throw new Error(AUTH_NOT_CONFIGURED)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (error) throw new Error(error.message)
    return normaliseUser(data.user)
  }, [])

  // ── login (email + password) ──────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    if (!supabase?.auth) throw new Error(AUTH_NOT_CONFIGURED)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    return normaliseUser(data.user)
  }, [])

  // ── loginWithGoogle ───────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(async () => {
    if (!supabase?.auth) throw new Error(AUTH_NOT_CONFIGURED)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/chat`,
      },
    })
    if (error) throw new Error(error.message)
    // Browser will redirect to Google — no return value needed
  }, [])

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (!supabase?.auth) {
      setUser(null)
      return
    }
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  // ── updateProfile ─────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (updates) => {
    if (!supabase?.auth) throw new Error(AUTH_NOT_CONFIGURED)
    const { data, error } = await supabase.auth.updateUser({ data: updates })
    if (error) throw new Error(error.message)
    const updated = normaliseUser(data.user)
    setUser(updated)
    return updated
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, token, register, login, loginWithGoogle, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
