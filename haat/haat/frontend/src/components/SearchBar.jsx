import { useState, useRef, useEffect } from 'react'
import { useVoice, VoiceError } from '../hooks/useVoice'
import VoiceSelector from './VoiceSelector'
import { useVoicePreference } from '../hooks/useVoicePreference'

// ── SearchBar ─────────────────────────────────────────────────────────────────
// Props:
//   value      — controlled input value
//   onChange   — (string) => void
//   onSearch   — (string) => void  (called on submit)
//   compact    — boolean  (results page mode — smaller, no voice selector)
//   autoFocus  — boolean
//   showVoiceSelector — boolean (default true unless compact)
export default function SearchBar({
  value = '',
  onChange,
  onSearch,
  compact = false,
  autoFocus = false,
  showVoiceSelector,
}) {
  const { recording, processing, transcript, level, error, errorType, clearError, startRecording, stopRecording } = useVoice()
  const { voiceId } = useVoicePreference()

  const [focused, setFocused] = useState(false)
  const [bars,    setBars]    = useState(() => Array(12).fill(4))
  const inputRef  = useRef(null)
  const barTimer  = useRef(null)

  // Whether to show the VoiceSelector row (default: non-compact only)
  const showSelector = showVoiceSelector !== undefined ? showVoiceSelector : !compact

  // Auto-focus
  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 80)
  }, [autoFocus])

  // Waveform bars while recording
  useEffect(() => {
    if (recording) {
      barTimer.current = setInterval(() => {
        setBars(prev => prev.map(() => {
          const r = 0.6 + Math.random() * 0.8
          return Math.round(Math.min(20, Math.max(3, 3 + (level / 100) * 18 * r)))
        }))
      }, 100)
    } else {
      clearInterval(barTimer.current)
      setBars(Array(12).fill(4))
    }
    return () => clearInterval(barTimer.current)
  }, [recording, level])

  // When transcript arrives → fill input + trigger search
  useEffect(() => {
    if (!processing && transcript) {
      onChange?.(transcript)
      onSearch?.(transcript)
    }
  }, [processing, transcript]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e) {
    e.preventDefault()
    const q = value.trim()
    if (q) onSearch?.(q)
  }

  function handleMicClick() {
    if (processing) return
    clearError()
    recording ? stopRecording() : startRecording()
  }

  const micSize = compact ? 36 : 44
  const radius  = compact ? 'var(--radius-lg)' : 'var(--radius-full)'

  const isDenied = errorType === VoiceError.MIC_DENIED || errorType === VoiceError.MIC_UNAVAILABLE
  const isTranscribeFail = errorType === VoiceError.TRANSCRIBE_FAIL

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>

      {/* ── Voice selector row ──────────────────────── */}
      {showSelector && (
        <VoiceSelector style={{ marginBottom: '4px' }} />
      )}

      {/* ── Search bar ─────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           '6px',
          background:    'var(--bg-raised)',
          border:        `1px solid ${focused ? 'rgba(249,115,22,0.40)' : 'var(--border-default)'}`,
          borderRadius:   radius,
          padding:       compact ? '4px' : '6px',
          boxShadow:     focused
            ? '0 0 0 4px rgba(249,115,22,0.10), var(--shadow-md)'
            : '0 0 0 3px rgba(249,115,22,0.04), var(--shadow-sm)',
          transition:    'border-color 200ms ease, box-shadow 200ms ease',
          width:         '100%',
        }}
      >
        {/* ── Mic button ─────────────────────────────── */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {/* Pulse rings */}
          {recording && [0, 0.45].map((delay, i) => (
            <span key={i} style={{
              position:      'absolute', inset: 0, borderRadius: '50%',
              border:        '1.5px solid rgba(220,38,38,0.45)',
              animation:     `sbPulse 1.4s ease-out ${delay}s infinite`,
              pointerEvents: 'none',
            }} />
          ))}
          {/* Processing spinner */}
          {processing && (
            <span style={{
              position:      'absolute', inset: '-2px', borderRadius: '50%',
              border:        '2px solid var(--border-subtle)',
              borderTop:     '2px solid var(--brand-saffron)',
              animation:     'sbSpin 0.8s linear infinite',
              pointerEvents: 'none',
            }} />
          )}
          <button
            type="button"
            onClick={handleMicClick}
            disabled={processing}
            aria-label={recording ? 'Stop recording' : 'Voice search'}
            style={{
              width:          `${micSize}px`,
              height:         `${micSize}px`,
              borderRadius:   '50%',
              border:         'none',
              background:     recording
                ? '#DC2626'
                : isDenied
                  ? 'var(--bg-subtle)'
                  : 'linear-gradient(135deg, var(--brand-saffron) 0%, var(--brand-gold) 100%)',
              boxShadow:      recording
                ? '0 2px 8px rgba(220,38,38,0.35)'
                : focused
                  ? '0 0 16px rgba(249,115,22,0.40)'
                  : '0 2px 8px rgba(249,115,22,0.30)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              cursor:         processing ? 'default' : 'pointer',
              flexShrink:      0,
              transition:     'background 200ms ease, transform 150ms var(--ease-spring), box-shadow 200ms ease',
              position:       'relative',
              zIndex:          1,
            }}
            onMouseEnter={e => { if (!processing) e.currentTarget.style.transform = 'scale(1.06)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {recording ? (
              <svg width={micSize * 0.33} height={micSize * 0.33} viewBox="0 0 24 24" fill="#fff">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            ) : processing ? (
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand-saffron)' }} />
            ) : isDenied ? (
              <svg width={micSize * 0.38} height={micSize * 0.38} viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            ) : (
              <svg width={micSize * 0.36} height={micSize * 0.36} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8"  y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>
        </div>

        {/* ── Waveform (recording) or Text input ───── */}
        {recording ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', padding: `0 ${compact ? '8px' : '12px'}`, height: `${compact ? 28 : 36}px` }}>
            {bars.map((h, i) => (
              <div key={i} style={{
                width:        '2.5px',
                height:       `${h}px`,
                background:   'var(--brand-saffron)',
                borderRadius: '2px',
                transition:   'height 80ms ease',
                opacity:       0.65 + (h / 20) * 0.35,
              }} />
            ))}
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => onChange?.(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={compact ? 'Search Indian markets...' : 'Try "Diwali sweets for Amma" or "handwoven silk saree"'}
            style={{
              flex:       1,
              background: 'transparent',
              border:     'none',
              outline:    'none',
              color:      'var(--text-primary)',
              fontSize:   compact ? '14px' : '15px',
              fontWeight:  400,
              padding:    `${compact ? '6px 8px' : '12px var(--space-3)'}`,
              caretColor: 'var(--brand-saffron)',
              minWidth:    0,
            }}
          />
        )}

        {/* ── Submit button ─────────────────────────── */}
        <button
          type="submit"
          style={{
            background:   'var(--brand-saffron)',
            color:        '#fff',
            border:       'none',
            borderRadius: compact ? 'var(--radius-md)' : 'var(--radius-full)',
            padding:      compact ? '8px 16px' : '12px 22px',
            fontSize:     compact ? '13px' : '14px',
            fontWeight:    600,
            letterSpacing:'0.01em',
            whiteSpace:   'nowrap',
            flexShrink:    0,
            cursor:       'pointer',
            transition:   'all 150ms var(--ease-default)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-saffron-dk)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(249,115,22,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand-saffron)'; e.currentTarget.style.boxShadow = 'none' }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)' }}
          onMouseUp={e =>   { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {compact ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          ) : 'Search →'}
        </button>
      </form>

      {/* ── Mic permission denied banner ──────────── */}
      {isDenied && (
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '10px',
          padding:      'var(--space-3) var(--space-4)',
          background:   'rgba(249,115,22,0.08)',
          border:       '1px solid rgba(249,115,22,0.20)',
          borderRadius: 'var(--radius-lg)',
          fontSize:     '13px',
          color:        'var(--text-secondary)',
          lineHeight:    1.5,
          animation:    'fadeUp 200ms ease both',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-saffron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>
            {error}
            {' '}
            <a
              href="https://support.google.com/chrome/answer/2693767"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--brand-saffron)', textDecoration: 'underline', fontWeight: 500 }}
            >
              Learn how →
            </a>
          </span>
          <button
            onClick={clearError}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px 4px', fontSize: '16px', flexShrink: 0 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Transcription failed banner ───────────── */}
      {isTranscribeFail && (
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '10px',
          padding:      'var(--space-3) var(--space-4)',
          background:   'rgba(249,115,22,0.06)',
          border:       '1px solid rgba(249,115,22,0.15)',
          borderRadius: 'var(--radius-lg)',
          fontSize:     '13px',
          color:        'var(--text-secondary)',
          animation:    'fadeUp 200ms ease both',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-saffron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8"  y1="23" x2="16" y2="23"/>
          </svg>
          {error}
          <button onClick={clearError} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px 4px', fontSize: '16px', flexShrink: 0 }}>×</button>
        </div>
      )}

      <style>{`
        @keyframes sbPulse { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(2.4);opacity:0} }
        @keyframes sbSpin  { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
