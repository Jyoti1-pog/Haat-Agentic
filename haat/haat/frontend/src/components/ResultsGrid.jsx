import { useState, useRef } from 'react'
import ProductCard from './ProductCard.jsx'
import SearchProgress from './SearchProgress.jsx'
import { speakText } from '../lib/api.js'

// ── IntentCard ───────────────────────────────────────────────────────────────
function IntentCard({ parsedIntent }) {
  if (!parsedIntent) return null

  const { categories = [], keywords = [], occasion, priceRange, giftFor, regionPreference } = parsedIntent
  const mainTerms = keywords.slice(0, 4).join(', ') || categories.join(', ') || 'products'

  const chips = [
    categories.length  && { label: 'Category',  value: categories.join(', ') },
    occasion           && { label: 'Occasion',   value: occasion },
    priceRange         && { label: 'Budget',      value: `₹${priceRange.min ?? 0}–₹${priceRange.max ?? '∞'}` },
    giftFor            && { label: 'Gift for',    value: giftFor },
    regionPreference   && { label: 'Region',      value: regionPreference },
  ].filter(Boolean)

  return (
    <div style={IC.card}>
      {/* Tail of speech bubble */}
      <div style={IC.tail} aria-hidden="true" />

      <div style={IC.inner}>
        <span style={IC.robot}>🤖</span>
        <div>
          <p style={IC.main}>
            I understood: You're looking for{' '}
            <strong style={{ color: 'var(--teal)' }}>{mainTerms}</strong>
          </p>
          {chips.length > 0 && (
            <div style={IC.chipRow}>
              {chips.map(c => (
                <span key={c.label} style={IC.chip}>
                  <span style={IC.chipLabel}>{c.label}:</span> {c.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const IC = {
  card: {
    position: 'relative',
    background: '#E6F4F4',
    border: '1.5px solid var(--teal)',
    borderRadius: 'var(--radius-md)',
    padding: '14px 18px',
    marginBottom: 16,
  },
  tail: {
    position: 'absolute', bottom: -10, left: 24,
    width: 0, height: 0,
    borderLeft: '8px solid transparent',
    borderRight: '8px solid transparent',
    borderTop: '10px solid var(--teal)',
  },
  inner: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  robot: { fontSize: '1.2rem', flexShrink: 0, lineHeight: 1.4 },
  main: { fontSize: '0.875rem', color: 'var(--charcoal)', margin: '0 0 8px', lineHeight: 1.5 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    background: '#fff', border: '1px solid #B2D8D8',
    borderRadius: 100, padding: '3px 10px',
    fontSize: '0.75rem', color: 'var(--teal)',
  },
  chipLabel: { fontWeight: 600, color: 'var(--charcoal-light)' },
}

// ── FallbackBanner ────────────────────────────────────────────────────────────
function FallbackBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div style={FB.banner}>
      <span style={FB.icon}>⚡</span>
      <span style={FB.text}>
        Showing curated catalog results — live search temporarily unavailable
      </span>
      <button style={FB.dismiss} onClick={() => setDismissed(true)} title="Dismiss">×</button>
    </div>
  )
}

const FB = {
  banner: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#FFFBEB', border: '1px solid #F6E05E',
    borderRadius: 'var(--radius-sm)', padding: '10px 16px',
    marginBottom: 16, fontSize: '0.82rem', color: '#744210',
  },
  icon: { fontSize: '0.9rem', flexShrink: 0 },
  text: { flex: 1, lineHeight: 1.4 },
  dismiss: {
    background: 'transparent', border: 'none',
    color: '#92400E', fontSize: '1.1rem', cursor: 'pointer',
    padding: '0 2px', lineHeight: 1, flexShrink: 0,
    fontFamily: 'var(--font-body)',
  },
}

// ── NarrationBar ─────────────────────────────────────────────────────────────
function NarrationBar({ narration, source }) {
  const [playState, setPlayState] = useState('idle')
  const ctxRef    = useRef(null)
  const sourceRef = useRef(null)

  async function togglePlay() {
    if (playState === 'playing') {
      sourceRef.current?.stop()
      ctxRef.current?.close()
      setPlayState('idle')
      return
    }
    setPlayState('loading')
    try {
      const arrayBuffer = await speakText(narration)
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current = ctx
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
      const src = ctx.createBufferSource()
      src.buffer = decoded
      src.connect(ctx.destination)
      src.onended = () => { setPlayState('idle'); ctx.close() }
      src.start(0)
      sourceRef.current = src
      setPlayState('playing')
    } catch (err) {
      console.error('[NarrationBar]', err)
      setPlayState('idle')
    }
  }

  return (
    <div style={NB.bar}>
      <div style={NB.body}>
        <p style={NB.text}>{narration}</p>
        <p style={NB.meta}>
          Source:{' '}
          <span style={{ ...NB.badge, ...(source === 'live' ? NB.liveBadge : NB.catalogBadge) }}>
            {source === 'live' ? 'Live Markets' : 'Catalog'}
          </span>
        </p>
      </div>
      <button
        style={{
          ...NB.btn,
          background: playState === 'playing' ? 'var(--teal)' : 'transparent',
          color: playState === 'playing' ? '#fff' : 'var(--teal)',
        }}
        onClick={togglePlay}
        disabled={playState === 'loading'}
        title={playState === 'playing' ? 'Stop' : 'Play narration aloud'}
      >
        {playState === 'loading' ? '⋯' : playState === 'playing' ? '⏹' : <SpeakerIcon />}
        <span style={{ fontSize: '0.8rem' }}>
          {playState === 'loading' ? 'Loading' : playState === 'playing' ? 'Stop' : 'Listen'}
        </span>
      </button>
    </div>
  )
}

function SpeakerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

const NB = {
  bar: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
    background: 'linear-gradient(135deg, var(--saffron-pale) 0%, var(--teal-pale) 100%)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
    padding: '16px 20px', marginBottom: 10,
  },
  body: { flex: 1 },
  text: { fontFamily: 'var(--font-display)', fontSize: '0.97rem', color: 'var(--charcoal)', lineHeight: 1.6, fontStyle: 'italic', margin: '0 0 6px' },
  meta: { margin: 0, fontSize: '0.76rem', color: 'var(--charcoal-muted)', display: 'flex', alignItems: 'center', gap: 6 },
  badge: { padding: '1px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.3px' },
  liveBadge: { background: '#E8F5E9', color: '#2E7D32' },
  catalogBadge: { background: '#EDE7F6', color: '#4527A0' },
  btn: {
    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--teal)', cursor: 'pointer',
    fontSize: '0.82rem', fontWeight: 600, fontFamily: 'var(--font-body)',
    transition: 'background 0.2s, color 0.2s', whiteSpace: 'nowrap',
  },
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={SK.card}>
      <div className="shimmer" style={SK.img} />
      <div style={SK.body}>
        <div className="shimmer" style={{ height: 16, width: '68%', borderRadius: 4 }} />
        <div className="shimmer" style={{ height: 12, width: '95%', borderRadius: 4 }} />
        <div className="shimmer" style={{ height: 12, width: '78%', borderRadius: 4 }} />
        <div className="shimmer" style={{ height: 22, width: '42%', borderRadius: 4, marginTop: 4 }} />
        <div className="shimmer" style={{ height: 36, width: '100%', borderRadius: 8, marginTop: 'auto' }} />
      </div>
    </div>
  )
}

const SK = {
  card: { background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' },
  img: { width: '100%', aspectRatio: '4/3' },
  body: { padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 160 },
}

// ── ResultsGrid ───────────────────────────────────────────────────────────────
export default function ResultsGrid({ results, loading, error, requestedMode }) {
  if (error) {
    return (
      <div style={S.centred}>
        <p style={{ fontSize: '2rem' }}>⚠️</p>
        <p style={{ color: '#E53E3E', fontWeight: 600, fontSize: '1rem' }}>{error}</p>
        <p style={{ color: 'var(--charcoal-muted)', fontSize: '0.85rem' }}>
          Check your connection or try again with a different query.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <section style={S.section}>
        <SearchProgress />
        <div className="products-grid" style={{ opacity: 0.5 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </section>
    )
  }

  if (!results) return null

  const { products = [], narration, parsedIntent, source, totalFound } = results
  const showFallback = requestedMode === 'live' && source === 'catalog'

  if (products.length === 0) {
    return (
      <div style={S.centred}>
        <p style={{ fontSize: '2.5rem' }}>🔍</p>
        <p style={{ fontWeight: 600, fontSize: '1.05rem' }}>No products found</p>
        <p style={{ color: 'var(--charcoal-muted)', fontSize: '0.875rem', maxWidth: 320, textAlign: 'center', lineHeight: 1.6 }}>
          Try broader keywords, remove price filters, or switch to Catalog Search.
        </p>
      </div>
    )
  }

  return (
    <section style={S.section} className="fade-in">

      {/* Fallback banner — only when live mode was requested but catalog was served */}
      {showFallback && <FallbackBanner />}

      {/* Intent card */}
      {parsedIntent && <IntentCard parsedIntent={parsedIntent} />}

      {/* Narration bar */}
      {narration && <NarrationBar narration={narration} source={source} />}

      {/* Result count */}
      <p style={S.countLine}>
        Showing <strong>{products.length}</strong> of <strong>{totalFound}</strong> results
      </p>

      {/* Products */}
      <div className="products-grid">
        {products.map(p => (
          <ProductCard key={p.id ?? p.product_url ?? p.name} product={p} />
        ))}
      </div>
    </section>
  )
}

const S = {
  section: { width: '100%' },
  countLine: { fontSize: '0.82rem', color: 'var(--charcoal-muted)', marginBottom: 18 },
  centred: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, padding: '64px 20px', color: 'var(--charcoal)',
  },
}
