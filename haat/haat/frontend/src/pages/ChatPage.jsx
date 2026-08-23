import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { useTTS } from '../hooks/useTTS'

// ── Constants ──────────────────────────────────────────────────────────────────
const SESSION_KEY   = 'haat_session_id'
const HISTORY_KEY   = 'haat_chat_messages'
const SAVE_HIST_KEY = 'haat_save_history'
const VOICE_EN_KEY  = 'haat_voice_enabled'

const EXAMPLE_PROMPTS = [
  'Diwali gift hamper for my parents under ₹2,000',
  'Authentic Kanjivaram saree for a wedding',
  'Kashmiri dry fruits for Eid',
  'Handmade pottery for housewarming',
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function getSessionId() { return localStorage.getItem(SESSION_KEY) ?? null }
function saveSessionId(id) { localStorage.setItem(SESSION_KEY, id) }
function clearSessionId() { localStorage.removeItem(SESSION_KEY) }

function greet(user) {
  if (!user) return 'What are you looking for today?'
  const hour = new Date().getHours()
  const time = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const first = user.name?.split(' ')[0]
  return first ? `${time}, ${first} 🙏` : `${time} 🙏`
}

function formatPrice(p) {
  if (!p && p !== 0) return ''
  return `₹${p.toLocaleString('en-IN')}`
}

// Simple markdown-lite renderer: bold, italic, inline code, headers, lists, tables
function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line
    if (!line.trim()) { i++; continue }

    // H3
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} style={{ margin: '16px 0 6px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
          {inlineFormat(line.slice(4))}
        </h3>
      )
      i++; continue
    }

    // H2
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} style={{ margin: '18px 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
          {inlineFormat(line.slice(3))}
        </h2>
      )
      i++; continue
    }

    // Horizontal rule
    if (line.trim() === '---') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border-faint)', margin: '12px 0' }} />)
      i++; continue
    }

    // Table — collect rows
    if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i])
        i++
      }
      // Filter out separator row (|---|---|)
      const dataRows = rows.filter(r => !/^\|[\s\-|]+\|$/.test(r.trim()))
      if (dataRows.length > 0) {
        const header = dataRows[0].split('|').filter(Boolean).map(c => c.trim())
        const body   = dataRows.slice(1)
        elements.push(
          <div key={`t${i}`} style={{ overflowX: 'auto', margin: '8px 0' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  {header.map((h, j) => (
                    <th key={j} style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>
                      {inlineFormat(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => {
                  const cells = row.split('|').filter(Boolean).map(c => c.trim())
                  return (
                    <tr key={ri} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                      {cells.map((cell, ci) => (
                        <td key={ci} style={{ padding: '7px 12px', color: ci === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', verticalAlign: 'top' }}>
                          {inlineFormat(cell)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      }
      continue
    }

    // Unordered list — collect items
    if (line.match(/^[-*] /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={`ul${i}`} style={{ margin: '6px 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {items.map((item, j) => (
            <li key={j} style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {inlineFormat(item)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Normal paragraph
    elements.push(
      <p key={i} style={{ margin: '4px 0', fontSize: '14px', lineHeight: 1.65, color: 'var(--text-secondary)' }}>
        {inlineFormat(line)}
      </p>
    )
    i++
  }

  return elements
}

function inlineFormat(text) {
  // Bold **text** and *italic* and `code`
  const parts = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0, m
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m[2]}</strong>)
    else if (m[3]) parts.push(<em key={m.index} style={{ fontStyle: 'italic' }}>{m[3]}</em>)
    else if (m[4]) parts.push(<code key={m.index} style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--brand-saffron)' }}>{m[4]}</code>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

// ── ProductCard ────────────────────────────────────────────────────────────────
function ProductCard({ product, onAddToCart }) {
  const [added, setAdded] = useState(false)

  function handleAdd() {
    onAddToCart(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div style={{
      background:   'var(--bg-raised)',
      border:       '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      overflow:     'hidden',
      display:      'flex',
      flexDirection:'column',
      transition:   'border-color 200ms ease, box-shadow 200ms ease',
      cursor:       'pointer',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = 'rgba(249,115,22,0.25)'
      e.currentTarget.style.boxShadow   = '0 4px 24px rgba(0,0,0,0.25)'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = 'var(--border-subtle)'
      e.currentTarget.style.boxShadow   = 'none'
    }}
    >
      {/* Image */}
      <div className="product-card-img" style={{ position: 'relative', paddingTop: '65%', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
        )}
        {/* Source badge */}
        {product.source === 'live' && (
          <span style={{
            position: 'absolute', top: '8px', right: '8px',
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)',
            color: 'rgba(34,197,94,0.9)', fontSize: '10px', fontWeight: 600,
            padding: '2px 7px', borderRadius: '999px',
          }}>● LIVE</span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {product.name}
        </p>
        {(product.city || product.state) && (
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)' }}>
            {[product.city, product.state].filter(Boolean).join(', ')}
          </p>
        )}
        {product.rating && (
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="11" height="11" viewBox="0 0 24 24"
              fill="rgba(161,161,170,0.7)" stroke="rgba(161,161,170,0.5)"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {product.rating} · {product.reviews?.toLocaleString()} reviews
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--brand-saffron)' }}>
            {formatPrice(product.price)}
          </span>
          <button
            onClick={handleAdd}
            style={{
              padding:      '6px 12px',
              background:   added ? 'rgba(34,197,94,0.15)' : 'rgba(249,115,22,0.12)',
              border:       `1px solid ${added ? 'rgba(34,197,94,0.25)' : 'rgba(249,115,22,0.25)'}`,
              borderRadius: 'var(--radius-md)',
              color:        added ? 'rgba(34,197,94,0.9)' : 'var(--brand-saffron)',
              fontSize:     '12px',
              fontWeight:    600,
              cursor:        'pointer',
              transition:    'all 200ms ease',
              whiteSpace:    'nowrap',
            }}
          >
            {added ? '✓ Added' : '+ Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ChatMessage ────────────────────────────────────────────────────────────────
function ChatMessage({ msg, onAddToCart, onSuggestionClick }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0', animation: 'msgIn 180ms ease both' }}>
        <div className="chat-user-bubble" style={{
          maxWidth: '72%',
          background: 'rgba(249,115,22,0.12)',
          border: '1px solid rgba(249,115,22,0.20)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)',
          padding: '12px 16px',
          fontSize: '14px',
          color: 'var(--text-primary)',
          lineHeight: 1.55,
        }}>
          {msg.content}
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '4px 0', alignItems: 'flex-start', animation: 'msgIn 220ms ease both' }}>
      {/* Avatar */}
      <div style={{
        width: '32px', height: '32px', flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(249,115,22,0.20) 0%, rgba(251,191,36,0.15) 100%)',
        border: '1px solid rgba(249,115,22,0.25)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px',
      }}>
        हा
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Text */}
        <div style={{ lineHeight: 1.65 }}>
          {renderMarkdown(msg.content)}
        </div>

        {/* Products grid */}
        {msg.products?.length > 0 && (
          <div className="chat-product-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '10px',
            marginTop: '16px',
          }}>
            {msg.products.map(p => (
              <ProductCard key={p.id ?? p.name} product={p} onAddToCart={onAddToCart} />
            ))}
          </div>
        )}

        {/* Suggestions */}
        {msg.suggestions?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
            {msg.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick(s)}
                style={{
                  padding:      '7px 13px',
                  background:   'var(--bg-raised)',
                  border:       '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize:     '12px',
                  color:        'var(--text-secondary)',
                  cursor:       'pointer',
                  transition:   'all 150ms ease',
                  textAlign:    'left',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(249,115,22,0.30)'
                  e.currentTarget.style.color       = 'var(--text-primary)'
                  e.currentTarget.style.background  = 'rgba(249,115,22,0.05)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                  e.currentTarget.style.color       = 'var(--text-secondary)'
                  e.currentTarget.style.background  = 'var(--bg-raised)'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Typing indicator ───────────────────────────────────────────────────────────
function TypingIndicator({ status }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '4px 0' }}>
      <div style={{
        width: '32px', height: '32px', flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(249,115,22,0.20) 0%, rgba(251,191,36,0.15) 100%)',
        border: '1px solid rgba(249,115,22,0.25)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px',
      }}>
        हा
      </div>
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          {status}
        </span>
        <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {[0, 1, 2].map(d => (
            <span key={d} style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: 'var(--brand-saffron)',
              opacity: 0.6,
              animation: `bounce 1.2s ease infinite ${d * 0.2}s`,
            }} />
          ))}
        </span>
      </div>
    </div>
  )
}

// ── ChatInput ──────────────────────────────────────────────────────────────────
function ChatInput({ onSend, loading, placeholder, autoFocus, onVoiceToggle, voiceMode, voiceSupported = true }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [value])

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || loading) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '8px',
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-2xl)',
      padding: '10px 10px 10px 18px',
      boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
      transition: 'border-color 200ms ease, box-shadow 200ms ease',
    }}
    onFocusCapture={e => {
      e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)'
      e.currentTarget.style.boxShadow   = '0 2px 20px rgba(249,115,22,0.08), 0 2px 16px rgba(0,0,0,0.25)'
    }}
    onBlurCapture={e => {
      e.currentTarget.style.borderColor = 'var(--border-default)'
      e.currentTarget.style.boxShadow   = '0 2px 16px rgba(0,0,0,0.25)'
    }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
        }}
        placeholder={placeholder ?? 'Ask me anything…'}
        autoFocus={autoFocus}
        rows={1}
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          outline: 'none',
          resize: 'none',
          fontSize: '15px',
          color: 'var(--text-primary)',
          caretColor: 'var(--brand-saffron)',
          lineHeight: 1.55,
          overflowY: 'hidden',
          fontFamily: 'inherit',
          padding: '2px 0',
        }}
      />

      {/* Voice toggle — only shown when supported (Chrome/Edge) */}
      {onVoiceToggle && voiceSupported && (
        <button
          onClick={onVoiceToggle}
          title={voiceMode ? 'Switch to text' : 'Switch to voice'}
          style={{
            width: '38px', height: '38px', flexShrink: 0,
            background: voiceMode ? 'rgba(249,115,22,0.15)' : 'none',
            border: voiceMode ? '1px solid rgba(249,115,22,0.30)' : '1px solid transparent',
            borderRadius: 'var(--radius-lg)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: voiceMode ? 'var(--brand-saffron)' : 'var(--text-tertiary)',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => { if (!voiceMode) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' } }}
          onMouseLeave={e => { if (!voiceMode) { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'none' } }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
      )}

      {/* Send */}
      <button
        onClick={submit}
        disabled={!value.trim() || loading}
        style={{
          width: '38px', height: '38px', flexShrink: 0,
          background: (!value.trim() || loading) ? 'rgba(249,115,22,0.25)' : 'var(--brand-saffron)',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          cursor: (!value.trim() || loading) ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 150ms ease, transform 100ms ease',
          color: '#fff',
        }}
        onMouseEnter={e => { if (value.trim() && !loading) e.currentTarget.style.transform = 'scale(1.06)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {loading ? (
          <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        )}
      </button>
    </div>
  )
}

// ── VoiceOverlay ───────────────────────────────────────────────────────────────
function VoiceOverlay({ recState, volume = 0, speaking, onMicToggle, onClose, voiceError }) {
  const isRecording  = recState === 'recording'
  const isProcessing = recState === 'processing'
  const isRequesting = recState === 'requesting'
  const busy         = isProcessing || speaking

  // Scale rings with real mic volume (0–100)
  const s1 = 1 + (volume / 100) * 0.45
  const s2 = 1 + (volume / 100) * 0.80
  const s3 = 1 + (volume / 100) * 1.25

  let statusText = 'Tap to speak'
  if (isRequesting)  statusText = 'Starting…'
  else if (isRecording)  statusText = 'Listening…'
  else if (isProcessing) statusText = 'Processing…'
  else if (speaking)     statusText = 'Speaking…'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(4,4,4,0.97)',
      backdropFilter: 'blur(24px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'fadeUp 200ms ease both',
    }}>
      {/* Close */}
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Exit voice
      </button>

      {/* Ambient glow */}
      <div className="voice-ambient-glow" style={{
        position: 'absolute',
        width: '420px', height: '420px',
        borderRadius: '50%',
        background: isRecording
          ? 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 65%)'
          : speaking
            ? 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)'
            : 'radial-gradient(circle, rgba(249,115,22,0.03) 0%, transparent 65%)',
        transition: 'background 400ms ease',
        pointerEvents: 'none',
      }} />

      {/* Live volume rings while recording */}
      {isRecording && (
        <>
          <div style={{ position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', border: '1px solid rgba(249,115,22,0.13)', transform: `scale(${s3})`, transition: 'transform 80ms ease', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', border: '1px solid rgba(249,115,22,0.20)', transform: `scale(${s2})`, transition: 'transform 80ms ease', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', border: '1px solid rgba(249,115,22,0.32)', transform: `scale(${s1})`, transition: 'transform 80ms ease', pointerEvents: 'none' }} />
        </>
      )}

      {/* Speaking waveform */}
      {speaking && (
        <div style={{ position: 'absolute', display: 'flex', gap: '5px', alignItems: 'center' }}>
          {[2, 5, 8, 5, 10, 7, 4, 8, 3].map((h, i) => (
            <div key={i} style={{
              width: '3px',
              height: `${6 + h * 4}px`,
              background: 'rgba(99,102,241,0.65)',
              borderRadius: '2px',
              animation: `waveBar 0.9s ease-in-out infinite ${i * 0.09}s`,
            }} />
          ))}
        </div>
      )}

      {/* Mic button */}
      <button
        onClick={onMicToggle}
        disabled={busy}
        style={{
          width: '84px', height: '84px',
          borderRadius: '50%',
          background: isRecording
            ? 'rgba(239,68,68,0.12)'
            : busy
              ? 'rgba(249,115,22,0.08)'
              : 'rgba(249,115,22,0.10)',
          border: isRecording
            ? '1.5px solid rgba(239,68,68,0.45)'
            : '1.5px solid rgba(249,115,22,0.35)',
          cursor: busy ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isRecording ? 'rgba(239,68,68,0.85)' : 'var(--brand-saffron)',
          transition: 'all 250ms ease',
          outline: 'none',
        }}
        onMouseEnter={e => { if (!busy && !isRecording) e.currentTarget.style.background = 'rgba(249,115,22,0.17)' }}
        onMouseLeave={e => { if (!busy && !isRecording) e.currentTarget.style.background = 'rgba(249,115,22,0.10)' }}
      >
        {isProcessing ? (
          <span style={{ width: '26px', height: '26px', border: '2px solid rgba(249,115,22,0.25)', borderTop: '2px solid var(--brand-saffron)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
        ) : (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        )}
      </button>

      {/* Status text */}
      <p style={{
        marginTop: '28px', fontSize: '15px', fontWeight: 500,
        letterSpacing: '-0.2px',
        color: isRecording ? 'rgba(239,68,68,0.75)' : speaking ? 'rgba(99,102,241,0.8)' : 'var(--text-secondary)',
        transition: 'color 300ms ease',
      }}>
        {statusText}
      </p>

      {/* Error */}
      {voiceError && (
        <div style={{
          marginTop: '12px',
          padding: '10px 16px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.20)',
          borderRadius: 'var(--radius-lg)',
          fontSize: '12px', color: 'rgba(239,68,68,0.8)',
          maxWidth: '300px', textAlign: 'center',
        }}>
          {voiceError}
        </div>
      )}

      <p style={{ position: 'absolute', bottom: '32px', fontSize: '12px', color: 'var(--text-tertiary)', letterSpacing: '0.2px' }}>
        {isRecording ? 'Tap mic to stop · Chrome & Edge only' : 'Powered by Web Speech API + ElevenLabs'}
      </p>
    </div>
  )
}

// ── ChatPage ───────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user, loading: authLoading } = useAuth()
  const { add: addItem, count: cartCount, totalINR: cartTotal } = useCart()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [messages,   setMessages]   = useState(() => {
    try {
      if (localStorage.getItem(SAVE_HIST_KEY) === 'true') {
        const saved = localStorage.getItem(HISTORY_KEY)
        return saved ? JSON.parse(saved) : []
      }
    } catch {}
    return []
  })
  const [loading,    setLoading]    = useState(false)
  const [status,     setStatus]     = useState('Thinking…')
  const [sessionId,  setSessionId]  = useState(() => getSessionId())
  const [cartNotif,  setCartNotif]  = useState(null)
  const [voiceMode,  setVoiceMode]  = useState(false)
  const [voiceError, setVoiceError] = useState(null)

  // Voice — reads IDs and enabled flag set in Settings
  const activeVoiceId = (() => { try { return localStorage.getItem('haat_voice') || 'pNInz6obpgDQGcFmaJgB' } catch { return 'pNInz6obpgDQGcFmaJgB' } })()
  const ttsEnabled    = (() => { try { return localStorage.getItem(VOICE_EN_KEY) !== 'false' } catch { return true } })()
  const { speak: _speak, stop: stopSpeech, speaking } = useTTS({ voiceId: activeVoiceId })
  const speak = ttsEnabled ? _speak : () => {}

  const messagesEndRef = useRef(null)
  const hasMessages = messages.length > 0

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Persist messages to localStorage when save-history is enabled
  useEffect(() => {
    try {
      if (localStorage.getItem(SAVE_HIST_KEY) === 'true') {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(messages))
      }
    } catch {}
  }, [messages])

  // Fire ?q= URL param as the first message once auth is ready
  useEffect(() => {
    if (authLoading) return
    const q = searchParams.get('q')
    if (!q) return
    setSearchParams({}, { replace: true })   // clean the URL
    sendMessage(q)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  // Clear voice error after 4 seconds
  useEffect(() => {
    if (!voiceError) return
    const t = setTimeout(() => setVoiceError(null), 4000)
    return () => clearTimeout(t)
  }, [voiceError])

  // Send a message (used by both text input and voice)
  const sendMessage = useCallback(async (text) => {
    stopSpeech()   // interrupt any ongoing TTS
    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setStatus('Thinking…')

    const token = localStorage.getItem('haat_token')
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const statusTimer = setTimeout(() => setStatus('Searching markets…'), 900)

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text, sessionId }),
      })
      clearTimeout(statusTimer)

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')

      if (data.sessionId) { saveSessionId(data.sessionId); setSessionId(data.sessionId) }

      const assistantMsg = {
        role:        'assistant',
        content:     data.message,
        products:    data.products    ?? null,
        suggestions: data.suggestions ?? [],
      }
      setMessages(prev => [...prev, assistantMsg])

      // Auto-speak response when in voice mode
      if (voiceMode) speak(data.message)

      // Sync AI-added cart items to frontend cart context
      if (data.cart?.items?.length) {
        data.cart.items.forEach(item => addItem(item, item.qty ?? 1))
      }

    } catch (err) {
      const errMsg = `Sorry, I ran into an issue: ${err.message}. Please try again.`
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg, products: null, suggestions: [] }])
      if (voiceMode) speak(errMsg)
    } finally {
      setLoading(false)
    }
  }, [sessionId, voiceMode, speak, stopSpeech, addItem])

  // Voice recorder → ElevenLabs Scribe (Pro)
  const { state: recState, volume: micVolume, toggle: toggleMic, isSupported: voiceSupported } = useVoiceRecorder({
    onTranscript: (text) => sendMessage(text),
    onError:      (msg)  => setVoiceError(msg),
  })

  function handleAddToCart(product) {
    addItem(product)
    setCartNotif(product.name)
    setTimeout(() => setCartNotif(null), 2500)
  }

  function handleNewChat() {
    if (sessionId) {
      fetch(`/api/chat/${sessionId}`, { method: 'DELETE' }).catch(() => {})
      clearSessionId()
      setSessionId(null)
    }
    setMessages([])
  }

  // Wait for auth to load so greeting is correct
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: '24px', height: '24px', border: '2px solid rgba(249,115,22,0.3)', borderTop: '2px solid var(--brand-saffron)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div className="page-enter" style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: '56px',
        background: hasMessages ? 'rgba(8,8,8,0.85)' : 'transparent',
        backdropFilter: hasMessages ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: hasMessages ? 'blur(20px)' : 'none',
        borderBottom: hasMessages ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '8px',
        transition: 'background 300ms ease, border-color 300ms ease',
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
          <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>haat.</span>
        </Link>

        <div style={{ flex: 1 }} />

        {/* New chat */}
        {hasMessages && (
          <button
            onClick={handleNewChat}
            style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '6px 12px', fontSize: '12px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 150ms ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New chat
          </button>
        )}

        {/* Cart */}
        <Link
          to="/cart"
          style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '8px', color: 'var(--text-secondary)', textDecoration: 'none' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
          {cartCount > 0 && (
            <span style={{
              position: 'absolute', top: '3px', right: '3px',
              width: '15px', height: '15px', borderRadius: '50%',
              background: 'var(--brand-saffron)', border: '1.5px solid var(--bg-base)',
              fontSize: '9px', fontWeight: 700, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </Link>

        {/* Auth */}
        {user ? (
          <div style={{
            width: '30px', height: '30px',
            background: 'linear-gradient(135deg, var(--brand-saffron) 0%, var(--brand-gold) 100%)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: '#fff', cursor: 'pointer',
            flexShrink: 0,
          }}
          onClick={() => navigate('/')}
          title={user.name ?? user.email}
          >
            {(user.name ?? user.email ?? '?')[0].toUpperCase()}
          </div>
        ) : (
          <Link to="/login" style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 500, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', color: 'var(--brand-saffron)', textDecoration: 'none', transition: 'background 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.20)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.12)'}
          >
            Sign in
          </Link>
        )}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {!hasMessages && (
        <div className="chat-empty" style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px 120px',
          animation: 'fadeUp 300ms var(--ease-out) both',
        }}>
          {/* Ambient glow */}
          <div style={{
            position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
            width: '500px', height: '300px',
            background: 'radial-gradient(ellipse, rgba(249,115,22,0.05) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Greeting */}
          <h1 style={{
            fontSize: 'clamp(24px, 5vw, 36px)',
            fontWeight: 700,
            letterSpacing: '-0.8px',
            color: 'var(--text-primary)',
            textAlign: 'center',
            marginBottom: '8px',
          }}>
            {greet(user)}
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: '40px', maxWidth: '380px', lineHeight: 1.5 }}>
            {user
              ? `Shop anything Indian — from ${user.homeState ?? 'your hometown'} and beyond.`
              : 'Shop anything from India\'s markets. I\'ll find it for you.'}
          </p>

          {/* Input */}
          <div className="chat-input-wrap" style={{ width: '100%', maxWidth: '620px', marginBottom: '28px' }}>
            <ChatInput
              onSend={sendMessage}
              loading={loading}
              placeholder="Try: 'Diwali sweets gift box under ₹1,500'…"
              autoFocus
              onVoiceToggle={() => setVoiceMode(true)}
              voiceMode={voiceMode}
              voiceSupported={voiceSupported}
            />
          </div>

          {/* Example prompts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '560px' }}>
            {EXAMPLE_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => sendMessage(p)}
                style={{
                  padding:      '8px 14px',
                  background:   'var(--bg-raised)',
                  border:       '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize:     '13px',
                  color:        'var(--text-secondary)',
                  cursor:       'pointer',
                  transition:   'all 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.30)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(249,115,22,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────────── */}
      {hasMessages && (
        <div className="chat-messages-scroll" style={{
          flex: 1,
          overflowY: 'auto',
          paddingTop: '72px',
          paddingBottom: '140px',
        }}>
          <div className="chat-messages-inner" style={{ maxWidth: '720px', margin: '0 auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {messages.map((msg, i) => (
              <ChatMessage
                key={i}
                msg={msg}
                onAddToCart={handleAddToCart}
                onSuggestionClick={sendMessage}
              />
            ))}
            {loading && <TypingIndicator status={status} />}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* ── Sticky bottom input (active state) ──────────────────────── */}
      {hasMessages && (
        <div className="chat-bottom" style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, var(--bg-base) 60%, transparent)',
          padding: '16px 20px 24px',
          zIndex: 40,
        }}>
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            {/* Cart bar — shown when cart has items */}
            {cartCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 14px',
                marginBottom: '10px',
                background: 'rgba(249,115,22,0.08)',
                border: '1px solid rgba(249,115,22,0.18)',
                borderRadius: 'var(--radius-xl)',
                animation: 'msgIn 200ms ease both',
              }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cartCount} item{cartCount > 1 ? 's' : ''}</strong>
                  <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                  <span style={{ color: 'var(--brand-saffron)', fontWeight: 600 }}>₹{cartTotal.toLocaleString('en-IN')}</span>
                </span>
                <Link
                  to="/checkout"
                  style={{
                    fontSize: '12px', fontWeight: 600,
                    color: '#fff',
                    background: 'var(--brand-saffron)',
                    padding: '5px 13px',
                    borderRadius: 'var(--radius-full)',
                    textDecoration: 'none',
                    transition: 'opacity 150ms ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Checkout →
                </Link>
              </div>
            )}

            <ChatInput
              onSend={sendMessage}
              loading={loading}
              placeholder="Ask a follow-up, or refine your search…"
              onVoiceToggle={() => setVoiceMode(true)}
              voiceMode={voiceMode}
              voiceSupported={voiceSupported}
            />
            <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
              haat may show products from multiple Indian markets · Prices in INR
            </p>
          </div>
        </div>
      )}

      {/* ── Cart notification ─────────────────────────────────────────── */}
      {cartNotif && (
        <div className="chat-cart-notif" style={{
          position: 'fixed',
          bottom: hasMessages ? '100px' : '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(34,197,94,0.15)',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 18px',
          fontSize: '13px',
          color: 'rgba(34,197,94,0.9)',
          fontWeight: 500,
          zIndex: 60,
          animation: 'fadeUp 200ms ease both',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          ✓ {cartNotif} added to cart
        </div>
      )}

      {/* ── Voice overlay ─────────────────────────────────────────────── */}
      {voiceMode && (
        <VoiceOverlay
          recState={recState}
          volume={micVolume}
          speaking={speaking}
          onMicToggle={toggleMic}
          onClose={() => { setVoiceMode(false); stopSpeech() }}
          voiceError={voiceError}
        />
      )}

      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes bounce     { 0%, 80%, 100% { transform: scale(0); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }
        @keyframes fadeUp     { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes msgIn      { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes waveBar    { 0%, 100% { transform: scaleY(0.35); opacity: 0.4; } 50% { transform: scaleY(1); opacity: 1; } }
        @keyframes voicePulse { 0% { transform: scale(1);   opacity: 0.8; }
                                100% { transform: scale(2.2); opacity: 0; } }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .chat-empty          { padding: 56px 16px 96px !important; }
          .chat-input-wrap     { max-width: 100% !important; }
          .chat-user-bubble    { max-width: 86% !important; }
          .chat-bottom         { padding: 12px 12px 16px !important; }
          .chat-messages-inner { padding: 0 12px !important; }
          .chat-cart-notif     { white-space: normal !important; max-width: calc(100vw - 40px) !important; text-align: center; }
          .voice-ambient-glow  { width: 280px !important; height: 280px !important; }
        }
        @media (max-width: 480px) {
          .chat-product-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .product-card-img  { padding-top: 70% !important; }
        }
      `}</style>
    </div>
  )
}
