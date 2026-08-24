import { useState, useEffect, useRef } from 'react'
import { useVoice } from '../hooks/useVoice'

const SIZES = { lg: 56, sm: 44 }
const NUM_BARS = 20

// ── VoiceMic ──────────────────────────────────────────────────────────────────
// Props: { onTranscript(text), size='lg' }
export default function VoiceMic({ onTranscript, size = 'lg' }) {
  const {
    recording, processing, transcript, level,
    startRecording, stopRecording,
  } = useVoice()

  const [bars,           setBars]           = useState(() => Array(NUM_BARS).fill(4))
  const [showTranscript, setShowTranscript] = useState(false)
  const intervalRef = useRef(null)
  const dim = SIZES[size] ?? SIZES.lg

  // ── Waveform bars update ───────────────────────────────────────────────────
  useEffect(() => {
    if (recording) {
      intervalRef.current = setInterval(() => {
        setBars(prev => prev.map(() => {
          const rand = 0.7 + Math.random() * 0.6
          const h    = 4 + (level / 100) * 36 * rand
          return Math.round(Math.min(40, Math.max(4, h)))
        }))
      }, 100)
    } else {
      clearInterval(intervalRef.current)
      setBars(Array(NUM_BARS).fill(4))
    }
    return () => clearInterval(intervalRef.current)
  }, [recording, level])

  // ── Fire onTranscript once we have text ───────────────────────────────────
  useEffect(() => {
    if (!processing && transcript) {
      setShowTranscript(true)
      const t = setTimeout(() => {
        setShowTranscript(false)
        onTranscript?.(transcript)
      }, 900)
      return () => clearTimeout(t)
    }
  }, [processing, transcript, onTranscript])

  function handleClick() {
    if (processing) return
    if (recording) stopRecording()
    else startRecording()
  }

  // ── Determine button style ─────────────────────────────────────────────────
  const buttonBg = recording
    ? '#DC2626'
    : processing
      ? 'transparent'
      : 'linear-gradient(135deg, var(--brand-saffron) 0%, var(--brand-gold) 100%)'

  const buttonBorder = processing
    ? '2px solid rgba(255,255,255,0.10)'
    : 'none'

  const buttonShadow = recording
    ? '0 2px 12px rgba(220,38,38,0.40)'
    : processing
      ? 'none'
      : '0 2px 12px rgba(249,115,22,0.30)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>

      {/* ── Button + pulse rings ──────────────────── */}
      <div style={{ position: 'relative', width: dim, height: dim, flexShrink: 0 }}>

        {/* Pulse rings (recording only) */}
        {recording && [0, 0.4, 0.8].map((delay, i) => (
          <span
            key={i}
            style={{
              position:     'absolute',
              inset:         0,
              borderRadius: '50%',
              border:       '2px solid rgba(220,38,38,0.50)',
              animation:    `micPulseRing 1.5s ease-out ${delay}s infinite`,
              pointerEvents:'none',
            }}
          />
        ))}

        {/* Processing spinner ring */}
        {processing && (
          <span style={{
            position:     'absolute',
            inset:        '-3px',
            borderRadius: '50%',
            border:       '2px solid var(--border-subtle)',
            borderTop:    '2px solid var(--brand-saffron)',
            animation:    'micSpin 0.8s linear infinite',
            pointerEvents:'none',
          }} />
        )}

        {/* Main button */}
        <button
          onClick={handleClick}
          disabled={processing}
          aria-label={recording ? 'Stop recording' : 'Start voice search'}
          style={{
            width:          `${dim}px`,
            height:         `${dim}px`,
            borderRadius:   '50%',
            border:         buttonBorder,
            background:     buttonBg,
            boxShadow:      buttonShadow,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            cursor:         processing ? 'default' : 'pointer',
            transition:     'transform 150ms var(--ease-spring), background 200ms ease',
            position:       'relative',
            zIndex:          1,
          }}
          onMouseEnter={e => { if (!processing) e.currentTarget.style.transform = 'scale(1.05)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseDown={e => { if (!processing) e.currentTarget.style.transform = 'scale(0.96)' }}
          onMouseUp={e => { if (!processing) e.currentTarget.style.transform = 'scale(1.05)' }}
        >
          {recording ? (
            // Stop icon
            <svg width={dim * 0.32} height={dim * 0.32} viewBox="0 0 24 24" fill="#fff">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          ) : processing ? (
            // Spinner inner dot
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-saffron)' }} />
          ) : (
            // Mic icon
            <svg width={dim * 0.32} height={dim * 0.32} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8"  y1="23" x2="16" y2="23"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Waveform bars (recording only) ──────────── */}
      {recording && (
        <div style={{
          display:    'flex',
          alignItems: 'flex-end',
          gap:        '2px',
          height:     '40px',
        }}>
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                width:        '3px',
                height:       `${h}px`,
                background:   'var(--brand-saffron)',
                borderRadius: '2px',
                transition:   'height 80ms ease',
                opacity:      0.7 + (h / 40) * 0.3,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Transcript flash ─────────────────────────── */}
      {showTranscript && transcript && (
        <div style={{
          fontSize:     '13px',
          color:        'var(--brand-saffron-lt)',
          fontWeight:    500,
          maxWidth:     '200px',
          textAlign:    'center',
          lineHeight:    1.4,
          animation:    'fadeUp 200ms ease both',
          padding:      '4px 10px',
          background:   'rgba(249,115,22,0.08)',
          borderRadius: 'var(--radius-full)',
          border:       '1px solid rgba(249,115,22,0.20)',
        }}>
          "{transcript}"
        </div>
      )}

      <style>{`
        @keyframes micPulseRing {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(2.5); opacity: 0;   }
        }
        @keyframes micSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
