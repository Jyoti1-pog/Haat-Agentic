import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// ── Input field ────────────────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, autoFocus, error }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          background:   'var(--bg-raised)',
          border:       `1px solid ${error ? 'rgba(239,68,68,0.6)' : focused ? 'rgba(249,115,22,0.5)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-lg)',
          padding:      '12px 16px',
          fontSize:     '15px',
          color:        'var(--text-primary)',
          outline:      'none',
          width:        '100%',
          boxSizing:    'border-box',
          caretColor:   'var(--brand-saffron)',
          boxShadow:    focused ? '0 0 0 3px rgba(249,115,22,0.08)' : 'none',
          transition:   'border-color 180ms ease, box-shadow 180ms ease',
        }}
      />
      {error && (
        <span style={{ fontSize: '12px', color: 'rgba(239,68,68,0.9)' }}>{error}</span>
      )}
    </div>
  )
}

// ── AuthPage ───────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login, register, loginWithGoogle, user } = useAuth()

  // Tab: 'login' or 'signup'
  const defaultTab = location.pathname === '/signup' ? 'signup' : 'login'
  const [tab, setTab] = useState(defaultTab)

  // Form state
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [errors,   setErrors]   = useState({})
  const [loading,  setLoading]  = useState(false)
  const [apiError, setApiError] = useState('')

  // Redirect destination after auth
  const from = location.state?.from ?? '/chat'

  // Already logged in → redirect
  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user, navigate, from])

  function clearErrors() {
    setErrors({})
    setApiError('')
  }

  function validate() {
    const e = {}
    if (tab === 'signup' && !name.trim()) e.name = 'Name is required'
    if (!email.trim())           e.email    = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email'
    if (!password)               e.password = 'Password is required'
    else if (password.length < 6) e.password = 'At least 6 characters'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    clearErrors()

    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      if (tab === 'signup') {
        const newUser = await register({ email, password, name })
        // New users → onboarding
        navigate(newUser.onboarded ? from : '/onboarding', { replace: true })
      } else {
        const loggedIn = await login({ email, password })
        navigate(loggedIn.onboarded ? from : '/onboarding', { replace: true })
      }
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:     'var(--bg-base)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '24px 16px',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '400px',
        background: 'radial-gradient(ellipse, rgba(249,115,22,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width:        '100%',
        maxWidth:     '400px',
        animation:    'fadeUp 300ms var(--ease-out) both',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '24px', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff',
              }}>haat.</span>
            </div>
          </Link>
          <p style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-tertiary)' }}>
            {tab === 'signup' ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background:   'var(--bg-raised)',
          border:       '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-2xl)',
          padding:      '32px',
          boxShadow:    'var(--shadow-lg)',
        }}>

          {/* Tab switcher */}
          <div style={{
            display:        'flex',
            background:     'var(--bg-subtle)',
            borderRadius:   'var(--radius-lg)',
            padding:        '3px',
            marginBottom:   '28px',
          }}>
            {['login', 'signup'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); clearErrors() }}
                style={{
                  flex:         1,
                  padding:      '8px',
                  borderRadius: 'var(--radius-md)',
                  border:       'none',
                  background:   tab === t ? 'var(--bg-raised)' : 'transparent',
                  color:        tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize:     '14px',
                  fontWeight:   tab === t ? 600 : 400,
                  cursor:       'pointer',
                  transition:   'all 150ms ease',
                  boxShadow:    tab === t ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={async () => {
              setLoading(true)
              try { await loginWithGoogle() }
              catch (err) { setApiError(err.message); setLoading(false) }
            }}
            disabled={loading}
            style={{
              width: '100%', padding: '11px 16px', marginBottom: '4px',
              background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', fontSize: '14px', fontWeight: 500,
              color: 'var(--text-primary)', cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              transition: 'border-color 150ms ease, background 150ms ease',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
          >
            {/* Google G mark */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-faint)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-faint)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {tab === 'signup' && (
              <Field
                label="Your name"
                value={name}
                onChange={setName}
                placeholder="How should we call you?"
                autoFocus
                error={errors.name}
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoFocus={tab === 'login'}
              error={errors.email}
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
              error={errors.password}
            />

            {/* API error */}
            {apiError && (
              <div style={{
                padding:      '10px 14px',
                background:   'rgba(239,68,68,0.08)',
                border:       '1px solid rgba(239,68,68,0.20)',
                borderRadius: 'var(--radius-md)',
                fontSize:     '13px',
                color:        'rgba(239,68,68,0.9)',
              }}>
                {apiError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop:    '4px',
                padding:      '13px',
                background:   loading ? 'rgba(249,115,22,0.5)' : 'var(--brand-saffron)',
                color:        '#fff',
                border:       'none',
                borderRadius: 'var(--radius-lg)',
                fontSize:     '15px',
                fontWeight:    600,
                cursor:       loading ? 'default' : 'pointer',
                transition:   'all 150ms ease',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                gap:          '8px',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--brand-saffron-dk)' }}
              onMouseLeave={e => { e.currentTarget.style.background = loading ? 'rgba(249,115,22,0.5)' : 'var(--brand-saffron)' }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid #fff',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  {tab === 'signup' ? 'Creating account…' : 'Logging in…'}
                </>
              ) : (
                tab === 'signup' ? 'Create account →' : 'Log in →'
              )}
            </button>
          </form>
        </div>

        {/* Guest option */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={() => navigate('/chat')}
            style={{
              background: 'none',
              border:     'none',
              color:      'var(--text-tertiary)',
              fontSize:   '13px',
              cursor:     'pointer',
              textDecoration: 'underline',
              textDecorationColor: 'rgba(255,255,255,0.15)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            Continue as guest →
          </button>
        </div>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
