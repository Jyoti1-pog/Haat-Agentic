import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import SearchBar   from '../components/SearchBar'
import ProductCard from '../components/ProductCard'
import { useVoice, VoiceError } from '../hooks/useVoice'
import { useVoicePreference } from '../hooks/useVoicePreference'
import { searchProducts } from '../lib/api'
import { useLoading } from '../contexts/LoadingContext'

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES  = ['All', 'Sweets', 'Clothing', 'Sarees', 'Spices', 'Handicrafts']
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance'  },
  { value: 'price_asc', label: 'Price ↑'    },
  { value: 'price_desc','label': 'Price ↓'  },
  { value: 'rating',    label: 'Rating'     },
]

const AGENT_STEPS = [
  'Understanding your request...',
  'Searching 500+ Indian sellers...',
  'Ranking by relevance and quality...',
  'Preparing your results...',
]

const ALT_SUGGESTIONS = [
  'Kanjivaram silk saree',
  'Diwali sweets under ₹500',
  'Kashmiri handicrafts',
  'Men\'s kurta cotton',
]

// ── DualRangeSlider ───────────────────────────────────────────────────────────
function DualRangeSlider({ min, max, value, onChange, step = 500 }) {
  const [lo, hi] = value
  const pLo = ((lo - min) / (max - min)) * 100
  const pHi = ((hi - min) / (max - min)) * 100

  return (
    <div style={{ padding: '8px 0 0' }}>
      <div style={{ position: 'relative', height: '28px' }}>
        {/* Track */}
        <div style={{
          position:   'absolute',
          top:        '50%',
          transform:  'translateY(-50%)',
          left:        0,
          right:       0,
          height:     '3px',
          background: 'var(--border-default)',
          borderRadius:'2px',
          pointerEvents:'none',
        }}>
          <div style={{
            position:   'absolute',
            top:         0,
            bottom:      0,
            left:       `${pLo}%`,
            right:      `${100 - pHi}%`,
            background: 'var(--brand-saffron)',
            borderRadius:'2px',
          }} />
        </div>

        {/* Min handle */}
        <input
          type="range"
          min={min} max={max} step={step}
          value={lo}
          onChange={e => {
            const v = Math.min(Number(e.target.value), hi - step)
            onChange([v, hi])
          }}
          style={sliderInputStyle}
        />
        {/* Max handle */}
        <input
          type="range"
          min={min} max={max} step={step}
          value={hi}
          onChange={e => {
            const v = Math.max(Number(e.target.value), lo + step)
            onChange([lo, v])
          }}
          style={sliderInputStyle}
        />
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          <div>₹{lo.toLocaleString('en-IN')}</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>${Math.round(lo / 83.5)}</div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
          <div>₹{hi.toLocaleString('en-IN')}</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>${Math.round(hi / 83.5)}</div>
        </div>
      </div>
    </div>
  )
}

const sliderInputStyle = {
  position:   'absolute',
  inset:       0,
  width:      '100%',
  height:     '100%',
  opacity:     0,
  cursor:     'pointer',
  margin:      0,
  padding:     0,
  appearance: 'none',
  WebkitAppearance: 'none',
  pointerEvents: 'auto',
}

// ── Agent loading panel ───────────────────────────────────────────────────────
function AgentPanel({ query }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1000),
      setTimeout(() => setStep(2), 2200),
      setTimeout(() => setStep(3), 3600),
    ]
    return () => timers.forEach(clearTimeout)
  }, [query])

  const progress = [0, 28, 56, 78, 100][step] ?? 0

  return (
    <div style={{
      background:   'var(--bg-raised)',
      border:       '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding:      'var(--space-6)',
      marginBottom: 'var(--space-6)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width:        '6px',
              height:       '6px',
              borderRadius: '50%',
              background:   'var(--brand-saffron)',
              animation:    `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
        <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
          haat AI is searching...
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height:       '3px',
        background:   'var(--border-faint)',
        borderRadius: '2px',
        marginBottom: 'var(--space-5)',
        overflow:     'hidden',
      }}>
        <div style={{
          height:           '100%',
          width:            `${progress}%`,
          background:       'var(--brand-saffron)',
          borderRadius:     '2px',
          transition:       'width 700ms var(--ease-out)',
          position:         'relative',
          overflow:         'hidden',
        }}>
          <div className="progress-shine" />
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {AGENT_STEPS.map((label, i) => {
          const done    = i < step
          const current = i === step
          const waiting = i > step
          return (
            <div key={i} style={{
              display:    'flex',
              alignItems: 'center',
              gap:        '10px',
              opacity:    waiting ? 0.35 : 1,
              animation:  current ? 'fadeUp 300ms ease both' : 'none',
              transition: 'opacity 300ms ease',
            }}>
              {done ? (
                <span style={{
                  width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
              ) : current ? (
                <span style={{
                  width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                  border: '2px solid var(--border-subtle)', borderTop: '2px solid var(--brand-saffron)',
                  animation: 'sbSpin 0.7s linear infinite', display: 'inline-block',
                }} />
              ) : (
                <span style={{
                  width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                  border: '1px solid var(--border-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-tertiary)' }} />
                </span>
              )}
              <span style={{ fontSize: '14px', color: done ? 'var(--text-secondary)' : current ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: current ? 500 : 400 }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border-faint)' }}>
      <div className="skeleton" style={{ aspectRatio: '3/4' }} />
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="skeleton" style={{ height: '14px', width: '80%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '12px', width: '55%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '12px', width: '38%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '36px', borderRadius: '8px', marginTop: '6px' }} />
      </div>
    </div>
  )
}

// ── Filter pill ───────────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:    active ? 'rgba(249,115,22,0.15)' : 'var(--bg-subtle)',
        border:        `1px solid ${active ? 'rgba(249,115,22,0.35)' : 'var(--border-subtle)'}`,
        borderRadius:  'var(--radius-full)',
        color:         active ? 'var(--brand-saffron-lt)' : 'var(--text-secondary)',
        fontSize:      '13px',
        fontWeight:    active ? 600 : 400,
        padding:       '6px 14px',
        cursor:        'pointer',
        whiteSpace:    'nowrap',
        transition:    'all 150ms ease',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background    = 'rgba(249,115,22,0.07)'
          e.currentTarget.style.borderColor   = 'rgba(249,115,22,0.20)'
          e.currentTarget.style.color         = 'var(--brand-saffron-lt)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background    = 'var(--bg-subtle)'
          e.currentTarget.style.borderColor   = 'var(--border-subtle)'
          e.currentTarget.style.color         = 'var(--text-secondary)'
        }
      }}
    >
      {label}
    </button>
  )
}

// ── Collapsible filter section ─────────────────────────────────────────────────
function FilterSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--border-faint)', paddingBottom: 'var(--space-4)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          width:          '100%',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          padding:        'var(--space-3) 0',
          color:          'var(--text-secondary)',
          fontSize:       '13px',
          fontWeight:      600,
          letterSpacing:  '0.02em',
          textTransform:  'uppercase',
        }}
      >
        {title}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div style={{ paddingBottom: 'var(--space-2)' }}>{children}</div>}
    </div>
  )
}

// ── Narration Player ──────────────────────────────────────────────────────────
function NarrationPlayer({ text, voiceId, voiceName, onClose, onUnavailable }) {
  const { playing, speak, stopPlaying, errorType } = useVoice()
  const [volume,  setVolume]  = useState(0.8)
  const [started, setStarted] = useState(false)
  const [bars,    setBars]    = useState(Array(5).fill(4))
  const barTimer = useRef(null)

  // auto-play once on mount, silently degrade on failure
  useEffect(() => {
    if (!started && text) {
      setStarted(true)
      speak(text, voiceId).catch(() => {})
    }
  }, [text, voiceId]) // eslint-disable-line

  // surface TTS failure to parent so it can show a toast
  useEffect(() => {
    if (errorType === VoiceError.SPEAK_FAIL) {
      onUnavailable?.()
    }
  }, [errorType]) // eslint-disable-line

  // bar animation while playing
  useEffect(() => {
    if (playing) {
      barTimer.current = setInterval(() => {
        setBars(prev => prev.map(() => Math.round(4 + Math.random() * 16)))
      }, 120)
    } else {
      clearInterval(barTimer.current)
      setBars(Array(5).fill(4))
    }
    return () => clearInterval(barTimer.current)
  }, [playing])

  const short = text?.length > 44 ? text.slice(0, 41) + '...' : text

  return (
    <div style={{
      position:       'fixed',
      bottom:         'var(--space-6)',
      left:           '50%',
      transform:      'translateX(-50%)',
      zIndex:          50,
      background:     'var(--bg-overlay)',
      border:         '1px solid var(--border-default)',
      borderRadius:   'var(--radius-2xl)',
      padding:        'var(--space-3) var(--space-5)',
      boxShadow:      'var(--shadow-lg)',
      display:        'flex',
      alignItems:     'center',
      gap:            'var(--space-3)',
      minWidth:       '280px',
      maxWidth:       '480px',
      animation:      'fadeUp 300ms var(--ease-out) both',
    }}>
      {/* Speaker icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-saffron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>

      {/* Voice name */}
      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
        {voiceName || 'Aarav'}
      </span>

      {/* Waveform or text */}
      {playing ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '20px', flexShrink: 0 }}>
          {bars.map((h, i) => (
            <div key={i} style={{
              width: '3px', height: `${h}px`,
              background: 'var(--brand-saffron)',
              borderRadius: '2px', transition: 'height 100ms ease',
            }} />
          ))}
        </div>
      ) : (
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {short}
        </span>
      )}

      {/* Play/Pause */}
      <button
        onClick={() => playing ? stopPlaying() : speak(text, voiceId).catch(() => {})}
        style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: 'var(--brand-saffron)', border: 'none',
          color: '#fff', cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'opacity 150ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.80' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'    }}
      >
        {playing ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff">
            <rect x="6"  y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        )}
      </button>

      {/* Volume */}
      <input
        type="range" min="0" max="1" step="0.05"
        value={volume}
        onChange={e => setVolume(Number(e.target.value))}
        style={{ width: '70px', accentColor: 'var(--brand-saffron)', cursor: 'pointer' }}
      />

      {/* Close */}
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0, fontSize: '16px', lineHeight: 1 }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
        aria-label="Close narration"
      >×</button>
    </div>
  )
}

// ── Intent card ───────────────────────────────────────────────────────────────
function IntentCard({ intent, onEdit, onRemoveOccasion, onRemoveRegion, onRemoveBudget }) {
  if (!intent?.summary) return null
  return (
    <div style={{
      background:   'rgba(249,115,22,0.06)',
      border:       '1px solid rgba(249,115,22,0.15)',
      borderRadius: 'var(--radius-lg)',
      padding:      'var(--space-3) var(--space-4)',
      marginBottom: 'var(--space-4)',
      display:      'flex',
      alignItems:   'center',
      justifyContent:'space-between',
      gap:          'var(--space-3)',
      flexWrap:     'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', flex: 1 }}>
        <span style={{ fontSize: '13px', color: 'var(--brand-saffron-lt)', fontWeight: 500 }}>
          ✦ {intent.summary}
        </span>
        {intent.occasion && (
          <span style={intentChipStyle}>
            🎉 {intent.occasion}
            <button onClick={onRemoveOccasion} style={intentChipXStyle}>×</button>
          </span>
        )}
        {intent.region && (
          <span style={intentChipStyle}>
            📍 {intent.region}
            <button onClick={onRemoveRegion} style={intentChipXStyle}>×</button>
          </span>
        )}
        {intent.budget?.max && (
          <span style={intentChipStyle}>
            ₹ under {intent.budget.max.toLocaleString('en-IN')}
            <button onClick={onRemoveBudget} style={intentChipXStyle}>×</button>
          </span>
        )}
      </div>
      <button
        onClick={onEdit}
        style={{ fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-saffron-lt)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'    }}
      >
        Edit ✏️
      </button>
    </div>
  )
}

const intentChipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  fontSize: '12px', color: 'var(--text-secondary)',
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-full)', padding: '2px 8px',
}
const intentChipXStyle = {
  background: 'none', border: 'none', color: 'var(--text-tertiary)',
  cursor: 'pointer', padding: '0 2px', lineHeight: 1, fontSize: '13px',
}

// ── Sort + apply filters ──────────────────────────────────────────────────────
function applyFilters(products, { catFilter, priceRange, specialFilters, sortBy }) {
  let result = [...products]

  // Category
  if (catFilter && catFilter !== 'All') {
    result = result.filter(p => p.category === catFilter.toLowerCase())
  }

  // Price range
  const [lo, hi] = priceRange
  result = result.filter(p => p.price >= lo && p.price <= hi)

  // Special
  if (specialFilters.gi) {
    result = result.filter(p => p.tags?.some(t => t.toLowerCase().includes('gi')))
  }
  if (specialFilters.handmade) {
    result = result.filter(p => {
      const tags = p.tags?.map(t => t.toLowerCase()) ?? []
      return (
        tags.some(t => ['handmade','handwoven','handspun','hand-painted','hand-carved'].includes(t)) ||
        p.seller?.toLowerCase().includes('artisan') ||
        p.seller?.toLowerCase().includes('handloom')
      )
    })
  }
  if (specialFilters.highRating) {
    result = result.filter(p => (p.rating ?? 0) >= 4.5)
  }

  // Sort
  if (sortBy === 'price_asc')  result.sort((a, b) => a.price - b.price)
  if (sortBy === 'price_desc') result.sort((a, b) => b.price - a.price)
  if (sortBy === 'rating')     result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

  return result
}

// ── SearchPage ────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const searchBarRef = useRef(null)
  const { startLoading, stopLoading } = useLoading()

  // URL-driven state
  const urlQuery    = searchParams.get('q')        ?? ''
  const urlCategory = searchParams.get('category') ?? ''

  // Search state
  const [inputValue, setInputValue] = useState(urlQuery)
  const [loading,    setLoading]    = useState(false)
  const [rawProducts, setRawProducts] = useState([])
  const [intent,     setIntent]     = useState(null)
  const [narration,  setNarration]  = useState('')
  const [total,      setTotal]      = useState(0)
  const [error,      setError]      = useState(null)

  // Filter state
  const [catFilter,      setCatFilter]      = useState(urlCategory ? urlCategory.charAt(0).toUpperCase() + urlCategory.slice(1) : 'All')
  const [priceRange,     setPriceRange]     = useState([0, 20000])
  const [specialFilters, setSpecialFilters] = useState({ gi: false, handmade: false, highRating: false })
  const [sortBy,         setSortBy]         = useState('relevance')
  const [intentState,    setIntentState]    = useState(null)

  // Voice preference for narration player
  const { voiceId, selectedVoice } = useVoicePreference()

  // Narration player
  const [showNarration, setShowNarration] = useState(false)

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Derived filtered/sorted products
  const displayProducts = applyFilters(rawProducts, { catFilter, priceRange, specialFilters, sortBy })

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q, cat) => {
    if (!q?.trim()) return
    setLoading(true)
    startLoading()
    setError(null)
    setShowNarration(false)
    try {
      const data = await searchProducts(q, cat && cat !== 'All' ? cat.toLowerCase() : null)
      setRawProducts(data.products ?? [])
      setTotal(data.total ?? (data.products?.length ?? 0))
      setIntent(data.intent ?? null)
      setIntentState(data.intent ?? null)
      setNarration(data.narration ?? '')
      if (data.narration) {
        setTimeout(() => setShowNarration(true), 600)
      }
    } catch (err) {
      setError(err.message)
      setRawProducts([])
    } finally {
      setLoading(false)
      stopLoading()
    }
  }, [startLoading, stopLoading])

  // Fetch when URL params change
  useEffect(() => {
    if (urlQuery) {
      setInputValue(urlQuery)
      doSearch(urlQuery, urlCategory)
    }
  }, [urlQuery, urlCategory, doSearch])

  // ── Handle new search ──────────────────────────────────────────────────────
  function handleSearch(q) {
    const trimmed = q.trim()
    if (!trimmed) return
    const params = { q: trimmed }
    if (catFilter && catFilter !== 'All') params.category = catFilter.toLowerCase()
    setSearchParams(params)
  }

  // ── Intent chip removal ────────────────────────────────────────────────────
  function removeOccasion() {
    setIntentState(prev => prev ? { ...prev, occasion: null } : prev)
  }
  function removeRegion() {
    setIntentState(prev => prev ? { ...prev, region: null } : prev)
  }
  function removeBudget() {
    setIntentState(prev => prev ? { ...prev, budget: null } : prev)
    // also remove price constraint
    setPriceRange([0, 20000])
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Sticky search strip ─────────────────────── */}
      <div style={{
        position:   'sticky',
        top:        'var(--nav-height)',
        zIndex:      40,
        background: 'rgba(8,8,8,0.90)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-faint)',
        padding:    'var(--space-3) var(--space-6)',
      }}>
        <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ flex: 1 }} ref={searchBarRef}>
            <SearchBar
              value={inputValue}
              onChange={setInputValue}
              onSearch={handleSearch}
              compact
              autoFocus={!urlQuery}
            />
          </div>
          {/* Mobile filter toggle */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              display:     'none',
              background:  sidebarOpen ? 'rgba(249,115,22,0.15)' : 'var(--bg-raised)',
              border:      `1px solid ${sidebarOpen ? 'rgba(249,115,22,0.35)' : 'var(--border-subtle)'}`,
              borderRadius:'var(--radius-md)',
              color:       sidebarOpen ? 'var(--brand-saffron-lt)' : 'var(--text-secondary)',
              padding:     '8px 14px',
              fontSize:    '13px',
              fontWeight:   500,
              cursor:      'pointer',
              whiteSpace:  'nowrap',
              flexShrink:   0,
            }}
            className="mobile-filter-btn"
          >
            Filters {displayProducts.length !== rawProducts.length ? `(${displayProducts.length})` : ''}
          </button>
        </div>
      </div>

      {/* ── Main layout ─────────────────────────────── */}
      <div style={{
        maxWidth:    'var(--container-xl)',
        margin:      '0 auto',
        padding:     'var(--space-6)',
        display:     'flex',
        gap:         'var(--space-6)',
        minHeight:   'auto',
        alignItems:  'flex-start',
      }}>

        {/* ── SIDEBAR ───────────────────────────────── */}
        <aside style={{
          width:        '240px',
          flexShrink:    0,
          position:     'sticky',
          top:          'calc(var(--nav-height) + 60px)',
          maxHeight:    'calc(100vh - var(--nav-height) - 80px)',
          overflowY:    'auto',
        }}
          className="search-sidebar"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Filters</span>
            <button
              onClick={() => {
                setCatFilter('All')
                setPriceRange([0, 20000])
                setSpecialFilters({ gi: false, handmade: false, highRating: false })
              }}
              style={{ fontSize: '13px', color: 'var(--brand-saffron)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Clear all
            </button>
          </div>

          {/* Count */}
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>
            Showing {displayProducts.length} of {rawProducts.length} results
          </p>

          {/* Category */}
          <FilterSection title="Category">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '4px' }}>
              {CATEGORIES.map(cat => (
                <FilterPill
                  key={cat}
                  label={cat}
                  active={catFilter === cat}
                  onClick={() => setCatFilter(cat)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Price */}
          <FilterSection title="Price Range">
            <DualRangeSlider
              min={0} max={20000}
              value={priceRange}
              onChange={setPriceRange}
            />
          </FilterSection>

          {/* Special */}
          <FilterSection title="Special">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
              <FilterPill
                label="✦ GI Certified"
                active={specialFilters.gi}
                onClick={() => setSpecialFilters(p => ({ ...p, gi: !p.gi }))}
              />
              <FilterPill
                label="♻ Handmade"
                active={specialFilters.handmade}
                onClick={() => setSpecialFilters(p => ({ ...p, handmade: !p.handmade }))}
              />
              <FilterPill
                label="⭐ 4.5+ Rating"
                active={specialFilters.highRating}
                onClick={() => setSpecialFilters(p => ({ ...p, highRating: !p.highRating }))}
              />
            </div>
          </FilterSection>
        </aside>

        {/* ── RESULTS ───────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Intent card */}
          {!loading && intentState && (
            <IntentCard
              intent={intentState}
              onEdit={() => searchBarRef.current?.querySelector('input')?.focus()}
              onRemoveOccasion={removeOccasion}
              onRemoveRegion={removeRegion}
              onRemoveBudget={removeBudget}
            />
          )}

          {loading ? (
            <>
              <AgentPanel query={urlQuery} />
              <div style={{
                display:             'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap:                 '16px',
              }}>
                {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
              </div>
            </>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
              <p style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>⚠️</p>
              <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                Search failed
              </h3>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{error}</p>
            </div>
          ) : displayProducts.length === 0 && urlQuery ? (
            /* No results */
            <div style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
              <p style={{ fontSize: '56px', marginBottom: 'var(--space-5)' }}>🔍</p>
              <h3 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                Nothing found for "{urlQuery}"
              </h3>
              <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                Try adjusting your search or browse a category
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
                {ALT_SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => handleSearch(s)} style={{
                    background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.20)',
                    borderRadius: 'var(--radius-full)', padding: '8px 16px',
                    fontSize: '13px', color: 'var(--brand-saffron-lt)', cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}>
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={() => navigate('/search')}
                style={{
                  background: 'var(--brand-saffron)', color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-full)', padding: '12px 28px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Browse all products →
              </button>
            </div>
          ) : rawProducts.length > 0 ? (
            <>
              {/* Sort bar */}
              <div style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
                marginBottom:   'var(--space-5)',
                gap:            'var(--space-4)',
                flexWrap:       'wrap',
              }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{displayProducts.length}</strong>
                  {' '}results{urlQuery ? ` for "${urlQuery}"` : ''}
                </span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{
                    background:   'var(--bg-overlay)',
                    border:       '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color:        'var(--text-primary)',
                    padding:      '8px 12px',
                    fontSize:     '13px',
                    cursor:       'pointer',
                    outline:      'none',
                    appearance:   'none',
                    WebkitAppearance: 'none',
                    paddingRight: '28px',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A1A1AA' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                  }}
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Product grid */}
              <div
                style={{
                  display:             'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap:                 '16px',
                }}
              >
                {displayProducts.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    index={Math.min(i, 6)}
                  />
                ))}
              </div>
            </>
          ) : !urlQuery ? (
            /* Empty state — no query yet */
            <div style={{ textAlign: 'center', padding: 'var(--space-20) 0' }}>
              <p style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🛍️</p>
              <h3 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                What are you looking for?
              </h3>
              <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
                Search above or use your voice to discover authentic Indian products
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Narration player ────────────────────────── */}
      {showNarration && narration && (
        <NarrationPlayer
          text={narration}
          voiceId={voiceId}
          voiceName={selectedVoice?.name}
          onClose={() => setShowNarration(false)}
        />
      )}

      {/* ── Mobile sidebar drawer ───────────────────── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 45,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position:   'absolute',
              bottom:      0,
              left:        0,
              right:       0,
              background: 'var(--bg-overlay)',
              borderTop:  '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
              padding:    'var(--space-6)',
              maxHeight:  '70vh',
              overflowY:  'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Filters</span>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-5)' }}>
              {CATEGORIES.map(cat => (
                <FilterPill key={cat} label={cat} active={catFilter === cat} onClick={() => { setCatFilter(cat); setSidebarOpen(false) }} />
              ))}
            </div>

            <DualRangeSlider min={0} max={20000} value={priceRange} onChange={setPriceRange} />

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
              <FilterPill label="✦ GI Certified" active={specialFilters.gi} onClick={() => setSpecialFilters(p => ({ ...p, gi: !p.gi }))} />
              <FilterPill label="♻ Handmade" active={specialFilters.handmade} onClick={() => setSpecialFilters(p => ({ ...p, handmade: !p.handmade }))} />
              <FilterPill label="⭐ 4.5+ Rating" active={specialFilters.highRating} onClick={() => setSpecialFilters(p => ({ ...p, highRating: !p.highRating }))} />
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                marginTop: 'var(--space-5)', width: '100%', padding: '12px',
                background: 'var(--brand-saffron)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius-full)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Show {displayProducts.length} results
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sbSpin { to { transform: rotate(360deg); } }

        .search-sidebar::-webkit-scrollbar { width: 4px; }
        .search-sidebar::-webkit-scrollbar-track { background: transparent; }
        .search-sidebar::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 2px; }

        @media (max-width: 768px) {
          .search-sidebar    { display: none !important; }
          .mobile-filter-btn { display: block !important; }
        }
        @media (max-width: 640px) {
          .search-sidebar { display: none !important; }
        }
      `}</style>
    </>
  )
}
