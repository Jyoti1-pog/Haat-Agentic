import { useState } from 'react'
import { useVoicePreference } from '../hooks/useVoicePreference'
import { useVoice } from '../hooks/useVoice'

// ── VoiceSelector ─────────────────────────────────────────────────────────────
// Small row: 🔊 Voice: [Aarav] [Priya]  Test Voice
export default function VoiceSelector({ style }) {
  const { voiceId, voices, selectVoice } = useVoicePreference()
  const { speak, playing } = useVoice()
  const [testing, setTesting] = useState(false)

  async function handleTest() {
    if (testing || playing) return
    const voice = voices.find(v => v.id === voiceId) ?? voices[0]
    setTesting(true)
    try {
      await speak(
        'Namaste! Welcome to haat. I am your guide to authentic Indian markets around the world.',
        voiceId,
      )
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      justifyContent: 'flex-end',
      gap:         '8px',
      flexWrap:    'wrap',
      ...style,
    }}>
      {/* Label */}
      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
        🔊 Voice:
      </span>

      {/* Voice pills */}
      {voices.map(v => {
        const active = v.id === voiceId
        return (
          <button
            key={v.id}
            onClick={() => selectVoice(v.id)}
            title={v.desc}
            style={{
              padding:      '3px 12px',
              borderRadius: 'var(--radius-full)',
              border:       `1px solid ${active ? 'var(--brand-saffron)' : 'var(--border-subtle)'}`,
              background:   active ? 'rgba(249,115,22,0.08)' : 'transparent',
              color:        active ? 'var(--brand-saffron-lt)' : 'var(--text-tertiary)',
              fontSize:     '12px',
              fontWeight:   active ? 600 : 400,
              cursor:       'pointer',
              transition:   'all 150ms ease',
              whiteSpace:   'nowrap',
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.borderColor = 'var(--border-default)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.borderColor = 'var(--border-subtle)'
                e.currentTarget.style.color = 'var(--text-tertiary)'
              }
            }}
          >
            {v.name}
          </button>
        )
      })}

      {/* Test Voice */}
      <button
        onClick={handleTest}
        disabled={testing || playing}
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         '4px',
          padding:     '3px 10px',
          borderRadius:'var(--radius-full)',
          border:      '1px solid var(--border-subtle)',
          background:  'transparent',
          color:       'var(--text-tertiary)',
          fontSize:    '12px',
          cursor:      testing || playing ? 'default' : 'pointer',
          opacity:     testing || playing ? 0.6 : 1,
          transition:  'all 150ms ease',
          whiteSpace:  'nowrap',
        }}
        onMouseEnter={e => { if (!testing && !playing) e.currentTarget.style.color = 'var(--text-secondary)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
      >
        {testing || playing ? (
          <>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              border: '1.5px solid var(--border-subtle)',
              borderTop: '1.5px solid var(--brand-saffron)',
              display: 'inline-block',
              animation: 'spin 0.7s linear infinite',
              flexShrink: 0,
            }} />
            Playing…
          </>
        ) : 'Test voice'}
      </button>
    </div>
  )
}
