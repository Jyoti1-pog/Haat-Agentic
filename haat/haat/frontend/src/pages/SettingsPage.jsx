import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme }  from '../contexts/ThemeContext'
import { useAuth }   from '../contexts/AuthContext'

// ── localStorage keys (single source of truth) ────────────────────────────────
export const SAVE_HISTORY_KEY = 'haat_save_history'
export const VOICE_ENABLED_KEY = 'haat_voice_enabled'
export const VOICE_ID_KEY = 'haat_voice'
const HISTORY_KEY = 'haat_chat_messages'

function readBool(key, fallback = true) {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === 'true'
  } catch { return fallback }
}

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({ on, onChange, label, description }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{label}</p>
        {description && (
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{description}</p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        style={{
          flexShrink: 0,
          width: '42px', height: '24px',
          borderRadius: '999px',
          border: 'none',
          background: on ? 'var(--brand-saffron)' : 'var(--bg-subtle)',
          outline: on ? '2px solid rgba(249,115,22,0.25)' : '2px solid transparent',
          cursor: 'pointer',
          padding: 0,
          position: 'relative',
          transition: 'background 200ms ease, outline 200ms ease',
        }}
      >
        <span style={{
          position: 'absolute',
          top: '3px',
          left: on ? '21px' : '3px',
          width: '18px', height: '18px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'left 180ms var(--ease-spring)',
        }} />
      </button>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: '1px solid var(--border-faint)',
      }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          {title}
        </p>
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {children}
      </div>
    </div>
  )
}

// ── Divider ────────────────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height: '1px', background: 'var(--border-faint)', margin: '0 -20px' }} />
}

// ── Theme option card ──────────────────────────────────────────────────────────
function ThemeCard({ value, label, icon, active, onClick }) {
  return (
    <button
      onClick={() => onClick(value)}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '14px 8px',
        borderRadius: 'var(--radius-lg)',
        border: active ? '1.5px solid var(--brand-saffron)' : '1.5px solid var(--border-subtle)',
        background: active ? 'rgba(249,115,22,0.06)' : 'var(--bg-subtle)',
        cursor: 'pointer',
        transition: 'border-color 150ms ease, background 150ms ease',
        outline: 'none',
      }}
    >
      {/* Mini preview */}
      <div style={{
        width: '44px', height: '32px',
        borderRadius: '6px',
        border: '1px solid var(--border-faint)',
        background: value === 'dark' ? '#111'
          : value === 'light' ? '#f5f5f5'
          : 'linear-gradient(135deg, #111 50%, #f5f5f5 50%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? 'var(--brand-saffron)' : 'var(--text-secondary)' }}>
        {label}
      </span>
      {active && (
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--brand-saffron)',
        }} />
      )}
    </button>
  )
}

// ── Voice option ───────────────────────────────────────────────────────────────
const VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Aarav', desc: 'Warm · Indian male' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Priya', desc: 'Clear · Indian female' },
]

// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user, logout }    = useAuth()
  const navigate            = useNavigate()

  // Chat history
  const [saveHistory, setSaveHistory] = useState(() => readBool(SAVE_HISTORY_KEY, false))

  // Voice
  const [voiceEnabled, setVoiceEnabled] = useState(() => readBool(VOICE_ENABLED_KEY, true))
  const [voiceId, setVoiceId]           = useState(() => {
    try { return localStorage.getItem(VOICE_ID_KEY) || VOICES[0].id } catch { return VOICES[0].id }
  })

  // Clear history state
  const [historyCleared, setHistoryCleared] = useState(false)

  function persistBool(key, val) {
    try { localStorage.setItem(key, String(val)) } catch {}
  }

  function handleSaveHistory(val) {
    setSaveHistory(val)
    persistBool(SAVE_HISTORY_KEY, val)
    if (!val) {
      // If turning off, clear any saved messages
      try { localStorage.removeItem('haat_chat_messages') } catch {}
    }
  }

  function handleVoiceEnabled(val) {
    setVoiceEnabled(val)
    persistBool(VOICE_ENABLED_KEY, val)
  }

  function handleVoiceId(id) {
    setVoiceId(id)
    try { localStorage.setItem(VOICE_ID_KEY, id) } catch {}
  }

  function handleClearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY)
      localStorage.removeItem('haat_session_id')
    } catch {}
    setHistoryCleared(true)
    setTimeout(() => setHistoryCleared(false), 2500)
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: 'var(--nav-height)', background: 'var(--bg-base)' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--space-10) var(--space-6) var(--space-20)' }}>

        {/* Header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{
            fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 800,
            letterSpacing: '-1px', lineHeight: 1.15, margin: 0,
            color: 'var(--text-primary)',
          }}>
            Settings
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--text-tertiary)' }}>
            Personalise your haat experience.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* ── Appearance ─────────────────────────────────────── */}
          <Section title="Appearance">
            <div>
              <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Theme</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <ThemeCard
                  value="dark" label="Dark" active={theme === 'dark'} onClick={setTheme}
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
                />
                <ThemeCard
                  value="light" label="Light" active={theme === 'light'} onClick={setTheme}
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>}
                />
                <ThemeCard
                  value="system" label="System" active={theme === 'system'} onClick={setTheme}
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(120,120,120,0.6)" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
                />
              </div>
              <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {theme === 'system' ? 'Follows your operating system setting.' : `Using ${theme} mode.`}
              </p>
            </div>
          </Section>

          {/* ── Chat ────────────────────────────────────────────── */}
          <Section title="Chat">
            <Toggle
              on={saveHistory}
              onChange={handleSaveHistory}
              label="Remember chat history"
              description="Your conversations are saved locally in this browser. Nothing leaves your device."
            />
            <Divider />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Clear history</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Remove all saved messages and reset the current session.
                </p>
              </div>
              <button
                onClick={handleClearHistory}
                style={{
                  flexShrink: 0,
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: historyCleared ? '1px solid rgba(34,197,94,0.30)' : '1px solid var(--border-default)',
                  background: historyCleared ? 'rgba(34,197,94,0.08)' : 'var(--bg-subtle)',
                  color: historyCleared ? 'rgba(34,197,94,0.85)' : 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {historyCleared ? '✓ Cleared' : 'Clear'}
              </button>
            </div>
          </Section>

          {/* ── Voice ────────────────────────────────────────────── */}
          <Section title="Voice">
            <Toggle
              on={voiceEnabled}
              onChange={handleVoiceEnabled}
              label="Voice responses"
              description="haat reads product recommendations aloud using ElevenLabs AI voices."
            />
            {voiceEnabled && (
              <>
                <Divider />
                <div>
                  <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Voice</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {VOICES.map(v => (
                      <button
                        key={v.id}
                        onClick={() => handleVoiceId(v.id)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-lg)',
                          border: voiceId === v.id ? '1.5px solid rgba(249,115,22,0.40)' : '1.5px solid var(--border-subtle)',
                          background: voiceId === v.id ? 'rgba(249,115,22,0.06)' : 'var(--bg-subtle)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'border-color 150ms ease, background 150ms ease',
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{v.name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-tertiary)' }}>{v.desc}</p>
                        </div>
                        {voiceId === v.id && (
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: 'var(--brand-saffron)', flexShrink: 0,
                          }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Section>

          {/* ── Account ─────────────────────────────────────────── */}
          <Section title="Account">
            {user ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--brand-saffron) 0%, var(--brand-gold) 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700, color: '#fff',
                  }}>
                    {(user.name ?? user.email ?? '?')[0].toUpperCase()}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name ?? 'You'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>{user.email}</p>
                  </div>
                </div>
                <Divider />
                <button
                  onClick={async () => { await logout(); navigate('/') }}
                  style={{
                    width: '100%', padding: '11px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid rgba(239,68,68,0.20)',
                    background: 'rgba(239,68,68,0.06)',
                    color: 'rgba(239,68,68,0.85)',
                    fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background 150ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.10)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link
                  to="/login"
                  style={{
                    flex: 1, textAlign: 'center', padding: '11px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '14px', fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  style={{
                    flex: 1, textAlign: 'center', padding: '11px',
                    borderRadius: 'var(--radius-lg)',
                    border: 'none',
                    background: 'var(--brand-saffron)',
                    color: '#fff',
                    fontSize: '14px', fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Sign up
                </Link>
              </div>
            )}
          </Section>

          {/* ── Legal ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '16px', padding: '8px 4px', justifyContent: 'center' }}>
            {[['Privacy Policy', '/privacy'], ['Terms of Use', '/terms']].map(([label, path]) => (
              <Link
                key={path}
                to={path}
                style={{ fontSize: '12px', color: 'var(--text-tertiary)', textDecoration: 'none', transition: 'color 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
              >
                {label}
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
