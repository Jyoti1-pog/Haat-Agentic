import { useState, useRef, useCallback } from 'react'
import { transcribeAudio } from '../lib/api.js'

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export default function VoiceSearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('')
  const [inputMode, setInputMode] = useState('text')      // 'text' | 'voice'
  const [searchMode, setSearchMode] = useState('catalog') // 'catalog' | 'live'
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [micError, setMicError] = useState('')

  const recorderRef  = useRef(null)
  const chunksRef    = useRef([])
  const stopTimerRef = useRef(null)

  const triggerSearch = useCallback((q) => {
    const trimmed = (q ?? query).trim()
    if (trimmed) onSearch(trimmed, searchMode)
  }, [query, searchMode, onSearch])

  // ── Voice recording ────────────────────────────────────────────────────
  async function startRecording() {
    setMicError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setTranscribing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType })
          const { text } = await transcribeAudio(blob)
          if (text?.trim()) {
            setQuery(text.trim())
            triggerSearch(text.trim())
          }
        } catch (err) {
          setMicError('Transcription failed — try again or type your search.')
          console.error('[Voice]', err)
        } finally {
          setTranscribing(false)
        }
      }

      recorder.start(250)
      recorderRef.current = recorder
      setRecording(true)
      stopTimerRef.current = setTimeout(stopRecording, 12_000) // auto-stop after 12s
    } catch (err) {
      setMicError('Microphone access denied. Please allow it in browser settings.')
    }
  }

  function stopRecording() {
    clearTimeout(stopTimerRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    setRecording(false)
  }

  return (
    <div style={S.wrap}>

      {/* ── Mode toggle row ─────────────────────────────────────────────── */}
      <div style={S.modeRow}>
        <span style={{ ...S.modeLabel, color: searchMode === 'catalog' ? 'var(--teal)' : 'var(--charcoal-muted)' }}>
          Catalog Search
        </span>

        <button
          role="switch"
          aria-checked={searchMode === 'live'}
          style={{ ...S.toggle, background: searchMode === 'live' ? 'var(--teal)' : '#D0C8BF' }}
          onClick={() => setSearchMode(m => m === 'catalog' ? 'live' : 'catalog')}
        >
          <span style={{
            ...S.knob,
            transform: searchMode === 'live' ? 'translateX(22px)' : 'translateX(2px)',
          }} />
        </button>

        <span style={{ ...S.modeLabel, color: searchMode === 'live' ? 'var(--teal)' : 'var(--charcoal-muted)' }}>
          Live Search
          {searchMode === 'live' && <span style={S.liveBadge}> TinyFish</span>}
        </span>
      </div>

      {/* ── Search input row ─────────────────────────────────────────────── */}
      <div style={{
        ...S.inputRow,
        borderColor: recording ? '#E53E3E' : 'var(--border)',
        boxShadow: recording
          ? '0 0 0 3px rgba(229,62,62,0.15), var(--shadow-md)'
          : 'var(--shadow-md)',
      }}>

        {/* Mode toggle icon */}
        <button
          style={{ ...S.iconBtn, color: inputMode === 'voice' ? 'var(--saffron)' : 'var(--charcoal-muted)' }}
          onClick={() => { setInputMode(m => m === 'text' ? 'voice' : 'text'); setMicError('') }}
          title={inputMode === 'text' ? 'Switch to voice search' : 'Switch to text search'}
        >
          <MicIcon />
        </button>

        {/* Input area */}
        {inputMode === 'text' ? (
          <input
            style={S.input}
            placeholder={'Try: \u201cBaranasi silk saree for Diwali under \u20b95000\u201d or \u201cspices from Kerala\u201d'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && triggerSearch()}
          />
        ) : (
          <div style={S.voiceArea}>
            {recording ? (
              <span style={S.recordingLabel}>
                <span className="rec-dot" /> Listening… speak now
              </span>
            ) : transcribing ? (
              <span style={S.transcribingLabel}>Transcribing…</span>
            ) : query ? (
              <span style={S.voiceResult}>"{query}"</span>
            ) : (
              <span style={S.voiceHint}>Tap the mic and describe what you're looking for</span>
            )}
          </div>
        )}

        {/* Right action button */}
        {inputMode === 'voice' ? (
          <button
            className={recording ? 'mic-active' : ''}
            style={{ ...S.micBtn, background: recording ? '#E53E3E' : 'var(--saffron)' }}
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
            title={recording ? 'Stop recording' : 'Start recording'}
          >
            {recording ? '■' : <MicIcon />}
          </button>
        ) : (
          <button
            style={{ ...S.searchBtn, opacity: loading || !query.trim() ? 0.6 : 1 }}
            onClick={() => triggerSearch()}
            disabled={loading || !query.trim()}
          >
            {loading ? <span className="spinner" /> : <><SearchIcon /> Search</>}
          </button>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {micError && <p style={S.errorText}>{micError}</p>}
    </div>
  )
}

const S = {
  wrap: { width: '100%', maxWidth: 740, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },

  modeRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  modeLabel: { fontSize: '0.82rem', fontWeight: 500, transition: 'color 0.2s' },
  toggle: {
    width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
    position: 'relative', padding: 0, flexShrink: 0, transition: 'background 0.25s',
  },
  knob: {
    position: 'absolute', top: 2, width: 22, height: 22,
    borderRadius: '50%', background: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'transform 0.25s',
    display: 'block',
  },
  liveBadge: {
    background: 'var(--teal)', color: '#fff',
    fontSize: '0.65rem', fontWeight: 700,
    padding: '1px 6px', borderRadius: 4, marginLeft: 4,
    verticalAlign: 'middle', letterSpacing: '0.5px',
  },

  inputRow: {
    display: 'flex', alignItems: 'center',
    background: '#fff', borderRadius: 'var(--radius-md)',
    border: '2px solid', overflow: 'hidden',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  iconBtn: {
    background: 'transparent', border: 'none',
    padding: '0 16px', height: 62, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRight: '1px solid var(--border)', flexShrink: 0,
    transition: 'color 0.2s',
  },
  input: {
    flex: 1, height: 62, border: 'none', outline: 'none',
    fontSize: '0.97rem', color: 'var(--charcoal)',
    background: 'transparent', padding: '0 16px',
    fontFamily: 'var(--font-body)',
  },
  voiceArea: {
    flex: 1, height: 62, display: 'flex',
    alignItems: 'center', padding: '0 16px',
  },
  recordingLabel: {
    display: 'flex', alignItems: 'center', gap: 8,
    color: '#E53E3E', fontSize: '0.9rem', fontWeight: 500,
  },
  transcribingLabel: { color: 'var(--teal)', fontSize: '0.9rem', fontStyle: 'italic' },
  voiceResult: { color: 'var(--charcoal)', fontSize: '0.9rem', fontStyle: 'italic' },
  voiceHint: { color: 'var(--charcoal-muted)', fontSize: '0.9rem' },

  micBtn: {
    flexShrink: 0, width: 58, height: 62, border: 'none',
    color: '#fff', cursor: 'pointer', fontSize: '1rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.2s',
  },
  searchBtn: {
    flexShrink: 0, height: 62, padding: '0 28px',
    background: 'var(--saffron)', color: '#fff', border: 'none',
    fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8,
    fontFamily: 'var(--font-body)', transition: 'background 0.2s',
  },

  errorText: { fontSize: '0.82rem', color: '#E53E3E', textAlign: 'center', margin: 0 },
}
