import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { useCart }  from '../contexts/CartContext'
import { useToast } from '../contexts/ToastContext'

// ── Constants ─────────────────────────────────────────────────────────────────
const API = 'http://localhost:3001/api'

const SHIPPING_ROWS = [
  { region: '🇺🇸 USA',        standard: '7–14 days', express: '3–5 days',  free: '₹5,000+' },
  { region: '🇬🇧 UK',         standard: '5–10 days', express: '2–4 days',  free: '₹4,000+' },
  { region: '🇨🇦 Canada',     standard: '8–14 days', express: '4–6 days',  free: '₹6,000+' },
  { region: '🇦🇺 Australia',  standard: '8–14 days', express: '4–7 days',  free: '₹6,000+' },
  { region: '🇦🇪 UAE',        standard: '4–7 days',  express: '2–3 days',  free: '₹3,000+' },
  { region: '🇸🇬 Singapore',  standard: '5–9 days',  express: '2–4 days',  free: '₹4,000+' },
  { region: '🇮🇳 India',      standard: '2–4 days',  express: '1–2 days',  free: '₹1,000+' },
]

const MOCK_REVIEWS = [
  { name: 'Priya S.',   flag: '🇺🇸', code: 'USA', date: 'Dec 2024', rating: 5, verified: true,
    text: 'Absolutely stunning quality. My mother in Chennai cried when she saw the photos — she said it reminded her of what she wore at her own wedding. Arrived perfectly wrapped.' },
  { name: 'Aditi M.',   flag: '🇬🇧', code: 'UK',  date: 'Nov 2024', rating: 5, verified: true,
    text: "Worth every penny. Ships faster than expected, gorgeous packaging, and the craftsmanship is exactly what you can't find in UK stores. Will order again." },
  { name: 'Kavita R.',  flag: '🇦🇪', code: 'UAE', date: 'Oct 2024', rating: 4, verified: true,
    text: 'Beautiful artisanship. Exactly as described and photographed. Customs in UAE was smooth with the DDP option. Highly recommend.' },
  { name: 'Anjali P.',  flag: '🇸🇬', code: 'SG',  date: 'Sep 2024', rating: 5, verified: true,
    text: 'Perfect gift for my mother back home. The quality is exceptional — you can feel the hand work in every detail. Haat makes gifting easy from Singapore.' },
  { name: 'Deepa N.',   flag: '🇺🇸', code: 'USA', date: 'Aug 2024', rating: 5, verified: false,
    text: "Couldn't be happier. The craftsmanship reminds me of my grandmother's home. This is exactly why haat exists." },
  { name: 'Meera K.',   flag: '🇬🇧', code: 'UK',  date: 'Aug 2024', rating: 4, verified: true,
    text: 'Solid quality, arrived in perfect condition. Customs was straightforward with their pre-paid duty option. Minor delay, but worth it.' },
]

const COUNTRY_FILTERS = ['All', '🇺🇸 USA', '🇬🇧 UK', '🇦🇪 UAE', '🇸🇬 SG']

// ── Helpers ───────────────────────────────────────────────────────────────────
function getImages(product) {
  return [
    product.image,
    `https://picsum.photos/seed/${product.id}b/600/800`,
    `https://picsum.photos/seed/${product.id}c/600/800`,
    `https://picsum.photos/seed/${product.id}d/600/800`,
  ]
}
function getWishlist()     { try { return JSON.parse(localStorage.getItem('haat_wishlist') || '[]') } catch { return [] } }
function saveWishlist(ids) { try { localStorage.setItem('haat_wishlist', JSON.stringify(ids)) } catch {} }

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars({ rating, size = 14 }) {
  return (
    <span style={{ display: 'inline-flex', gap: '2px', flexShrink: 0 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 10 10"
          fill={i <= Math.round(rating) ? 'var(--brand-saffron)' : 'rgba(255,255,255,0.15)'}>
          <path d="M5 .5l1.18 2.39 2.64.38-1.91 1.86.45 2.63L5 6.5 2.64 7.76l.45-2.63L1.18 3.27l2.64-.38L5 .5z"/>
        </svg>
      ))}
    </span>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ bg, border, color, children }) {
  return (
    <span style={{
      background: bg, border: `1px solid ${border}`, color,
      fontSize: '12px', fontWeight: 500,
      padding: '4px 12px', borderRadius: 'var(--radius-full)',
      display: 'inline-flex', alignItems: 'center', gap: '4px',
    }}>
      {children}
    </span>
  )
}

// ── Qty stepper ───────────────────────────────────────────────────────────────
function QtyStepper({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Qty</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {[{ sym: '−', fn: () => onChange(Math.max(1,  value - 1)) },
          { sym: '+', fn: () => onChange(Math.min(10, value + 1)) }].map(({ sym, fn }, i) => (
          <button key={sym} onClick={fn} style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
            color: 'var(--text-primary)', fontSize: '18px', fontWeight: 300,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'border-color 150ms ease', lineHeight: 1,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
          >{sym}</button>
        ))}
        <span style={{ width: '32px', textAlign: 'center', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {value}
        </span>
      </div>
    </div>
  )
}

// ── Rating bars ───────────────────────────────────────────────────────────────
function RatingBars({ rating, total }) {
  const dist = [
    { star: 5, pct: 68 }, { star: 4, pct: 20 },
    { star: 3, pct: 7  }, { star: 2, pct: 3  }, { star: 1, pct: 2 },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {dist.map(({ star, pct }) => (
        <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '8px', textAlign: 'right' }}>{star}</span>
          <svg width="11" height="11" viewBox="0 0 10 10" fill="var(--brand-saffron)">
            <path d="M5 .5l1.18 2.39 2.64.38-1.91 1.86.45 2.63L5 6.5 2.64 7.76l.45-2.63L1.18 3.27l2.64-.38L5 .5z"/>
          </svg>
          <div style={{ width: '160px', height: '4px', background: 'var(--border-default)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand-saffron)', borderRadius: '2px', transition: 'width 700ms var(--ease-out)' }} />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', width: '32px' }}>{Math.round(total * pct / 100)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-10)', flexWrap: 'wrap' }}>
      <div style={{ flex: '0 0 min(55%, 540px)', minWidth: '280px' }}>
        <div className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 'var(--radius-2xl)' }} />
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ width: '72px', height: '90px', borderRadius: 'var(--radius-md)', flexShrink: 0 }} />)}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '8px' }}>
        {[100, 200, 36, 70, 52, 52, 52].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: i === 1 ? '40px' : '15px', width: `${w}px`, borderRadius: '4px' }} />
        ))}
      </div>
    </div>
  )
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const prev = useCallback(() => setIdx(i => (i - 1 + images.length) % images.length), [images.length])
  const next  = useCallback(() => setIdx(i => (i + 1) % images.length), [images.length])

  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose, prev, next])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.95)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'lbFade 150ms ease both',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: '20px', right: '24px',
        background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)',
        color: '#fff', width: '40px', height: '40px', borderRadius: '50%',
        fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, zIndex: 1,
      }}>×</button>

      {images.length > 1 && <>
        <button onClick={e => { e.stopPropagation(); prev() }} style={{
          position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', zIndex: 1,
          background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', width: '44px', height: '44px', borderRadius: '50%',
          fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>
        <button onClick={e => { e.stopPropagation(); next() }} style={{
          position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', zIndex: 1,
          background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', width: '44px', height: '44px', borderRadius: '50%',
          fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>→</button>
      </>}

      <img src={images[idx]} alt="" onClick={e => e.stopPropagation()}
        style={{
          maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain',
          borderRadius: 'var(--radius-xl)',
          animation: 'lbZoom 200ms var(--ease-out) both',
          userSelect: 'none',
        }}
        onError={e => { e.target.src = `https://picsum.photos/seed/lb${idx}/600/800` }}
      />

      <div style={{ position: 'absolute', bottom: '24px', display: 'flex', gap: '8px' }}>
        {images.map((_, i) => (
          <button key={i} onClick={e => { e.stopPropagation(); setIdx(i) }} style={{
            width: '8px', height: '8px', borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
            background: i === idx ? 'var(--brand-saffron)' : 'rgba(255,255,255,0.30)',
            transition: 'background 150ms ease',
          }} />
        ))}
      </div>
    </div>
  )
}

// ── Tab strip with sliding indicator ─────────────────────────────────────────
function TabStrip({ tabs, active, onChange }) {
  const tabEls = useRef([])
  const [ind, setInd] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const el = tabEls.current[active]
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth })
  }, [active])

  return (
    <div style={{ position: 'relative', display: 'flex', borderBottom: '1px solid var(--border-faint)', overflowX: 'auto' }}>
      {tabs.map((tab, i) => (
        <button key={tab}
          ref={el => { tabEls.current[i] = el }}
          onClick={() => onChange(i)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 'var(--space-4) var(--space-5)', whiteSpace: 'nowrap',
            fontSize: '14px', fontWeight: 500,
            color: active === i ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={e => { if (active !== i) e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { if (active !== i) e.currentTarget.style.color = 'var(--text-secondary)' }}
        >{tab}</button>
      ))}
      <div style={{
        position: 'absolute', bottom: '-1px', height: '2px',
        background: 'var(--brand-saffron)', borderRadius: '2px 2px 0 0',
        left: `${ind.left}px`, width: `${ind.width}px`,
        transition: 'left 220ms var(--ease-default), width 220ms var(--ease-default)',
      }} />
    </div>
  )
}

// ── ProductPage ───────────────────────────────────────────────────────────────
export default function ProductPage() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { add }    = useCart()
  const { success: toastSuccess } = useToast()

  const [product,      setProduct]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [related,      setRelated]      = useState([])
  const [activeImg,    setActiveImg]    = useState(0)
  const [lightbox,     setLightbox]     = useState(false)
  const [activeTab,    setActiveTab]    = useState(0)
  const [qty,          setQty]          = useState(1)
  const [showUSD,      setShowUSD]      = useState(false)
  const [wishlisted,   setWishlisted]   = useState(false)
  const [reviewFilter, setReviewFilter] = useState('All')
  const [imgHovered,   setImgHovered]   = useState(false)
  const [addedCart,    setAddedCart]    = useState(false)
  const addTimer = useRef(null)

  // Fetch product
  useEffect(() => {
    setLoading(true); setError(null); setActiveImg(0); setActiveTab(0)
    fetch(`${API}/products/${id}`)
      .then(r => { if (!r.ok) throw new Error('Product not found'); return r.json() })
      .then(data => { setProduct(data); setWishlisted(getWishlist().includes(data.id)) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  // Fetch related
  useEffect(() => {
    if (!product?.category) return
    fetch(`${API}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `best ${product.category}`, category: product.category }),
    })
      .then(r => r.json())
      .then(data => setRelated((data.products ?? []).filter(p => p.id !== product.id).slice(0, 4)))
      .catch(() => {})
  }, [product?.category, product?.id])

  useEffect(() => () => clearTimeout(addTimer.current), [])

  function toggleWishlist() {
    const list = getWishlist()
    const next = wishlisted ? list.filter(i => i !== product.id) : [...list, product.id]
    saveWishlist(next); setWishlisted(!wishlisted)
    toastSuccess(wishlisted ? 'Removed from wishlist' : 'Saved to wishlist')
  }

  function handleAddToCart() {
    for (let i = 0; i < qty; i++) add(product)
    toastSuccess(`${product.name} added to cart`)
    setAddedCart(true)
    clearTimeout(addTimer.current)
    addTimer.current = setTimeout(() => setAddedCart(false), 2000)
  }

  function handleBuyNow() {
    for (let i = 0; i < qty; i++) add(product)
    navigate('/cart')
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto', padding: 'calc(var(--nav-height) + 40px) var(--space-6) var(--space-12)' }}>
      <ProductSkeleton />
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', padding: 'var(--space-6)' }}>
      <span style={{ fontSize: '48px' }}>🔍</span>
      <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)' }}>{error}</h2>
      <button onClick={() => navigate(-1)} style={{ background: 'var(--brand-saffron)', color: '#fff', border: 'none', borderRadius: 'var(--radius-full)', padding: '10px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
        ← Go Back
      </button>
    </div>
  )

  // ── Derived values ─────────────────────────────────────────────────────────
  const images  = getImages(product)
  const isGI    = product.tags?.some(t => t.toLowerCase().includes('gi'))
  const isHM    = product.seller?.toLowerCase().includes('artisan') || product.seller?.toLowerCase().includes('handloom') ||
                  product.tags?.some(t => ['handmade','handwoven','handspun','hand-painted','hand-carved'].includes(t.toLowerCase()))
  const tabs    = ['Description', 'The Story', 'Shipping', `Reviews (${product.reviews})`]
  const story1  = (product.description ?? '').split('.')[0] + '.'
  const artPhot = `https://picsum.photos/seed/${(product.seller ?? 'art').replace(/\s+/g,'')}/300/400`
  const filteredRevs = reviewFilter === 'All' ? MOCK_REVIEWS : MOCK_REVIEWS.filter(r => reviewFilter.includes(r.code))

  return (
    <>
      <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto', padding: 'calc(var(--nav-height) + 40px) var(--space-6) var(--space-12)' }}>

        {/* ══════════════════════════════════════════
            TWO-COLUMN LAYOUT
        ══════════════════════════════════════════ */}
        <div style={{ display: 'flex', gap: 'clamp(24px, 4vw, 60px)', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ── LEFT: GALLERY ────────────────────── */}
          <div style={{ flex: '0 0 min(55%, 540px)', minWidth: '280px' }}>

            {/* Main image */}
            <div
              onClick={() => setLightbox(true)}
              onMouseEnter={() => setImgHovered(true)}
              onMouseLeave={() => setImgHovered(false)}
              style={{
                aspectRatio: '3/4', borderRadius: 'var(--radius-2xl)', overflow: 'hidden',
                background: 'var(--bg-raised)', border: '1px solid var(--border-faint)',
                cursor: 'zoom-in', position: 'relative',
              }}
            >
              <img src={images[activeImg]} alt={product.name}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                  transform: imgHovered ? 'scale(1.04)' : 'scale(1)',
                  transition: 'transform 500ms var(--ease-smooth)',
                }}
                onError={e => { e.target.src = `https://picsum.photos/seed/${product.id}/600/800` }}
              />
              <div style={{
                position: 'absolute', bottom: '16px', right: '16px',
                background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 'var(--radius-full)', padding: '4px 10px',
                fontSize: '11px', color: 'rgba(255,255,255,0.65)', pointerEvents: 'none',
              }}>
                🔍 Click to zoom
              </div>
            </div>

            {/* Thumbnails */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', overflowX: 'auto', paddingBottom: '2px' }}>
              {images.map((img, i) => (
                <div key={i} onClick={() => setActiveImg(i)} style={{
                  width: '72px', height: '90px', flexShrink: 0,
                  borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  border: `2px solid ${activeImg === i ? 'var(--brand-saffron)' : 'transparent'}`,
                  opacity: activeImg === i ? 1 : 0.45, cursor: 'pointer',
                  transition: 'opacity 150ms ease, border-color 150ms ease',
                }}
                  onMouseEnter={e => { if (activeImg !== i) e.currentTarget.style.opacity = '0.80' }}
                  onMouseLeave={e => { if (activeImg !== i) e.currentTarget.style.opacity = '0.45' }}
                >
                  <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={e => { e.target.src = `https://picsum.photos/seed/${product.id}${i}/300/400` }} />
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: BUY BOX ───────────────────── */}
          <div style={{ flex: 1, minWidth: '260px', paddingTop: '4px' }}>

            {/* Breadcrumb */}
            <nav style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { label: 'Home',          to: '/' },
                { label: (product.category?.charAt(0).toUpperCase() + product.category?.slice(1)) || '', to: `/search?category=${product.category}` },
                { label: product.name.length > 28 ? product.name.slice(0, 26) + '…' : product.name, to: null },
              ].map((crumb, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {i > 0 && <span style={{ color: 'var(--border-default)' }}>/</span>}
                  {crumb.to
                    ? <Link to={crumb.to} style={{ color: 'var(--text-tertiary)', transition: 'color 150ms' }}
                        onMouseEnter={e => { e.target.style.color = 'var(--brand-saffron-lt)' }}
                        onMouseLeave={e => { e.target.style.color = 'var(--text-tertiary)' }}
                      >{crumb.label}</Link>
                    : <span style={{ color: 'var(--text-secondary)' }}>{crumb.label}</span>
                  }
                </span>
              ))}
            </nav>

            {/* Artisan line */}
            <p style={{ fontSize: '13px', color: 'var(--brand-saffron-lt)', fontWeight: 500, marginBottom: 'var(--space-2)', cursor: 'pointer', margin: '0 0 var(--space-2)' }}
              onMouseEnter={e => { e.target.style.textDecoration = 'underline' }}
              onMouseLeave={e => { e.target.style.textDecoration = 'none' }}>
              👤 {product.seller} · {product.city}, {product.state}
            </p>

            {/* Name */}
            <h1 style={{
              fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, lineHeight: 1.25,
              letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: '0 0 var(--space-3)',
            }}>
              {product.name}
            </h1>

            {/* Rating row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
              <Stars rating={product.rating ?? 0} size={14} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {product.rating?.toFixed(1)}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                onMouseEnter={e => { e.target.style.textDecoration = 'underline' }}
                onMouseLeave={e => { e.target.style.textDecoration = 'none' }}
                onClick={() => setActiveTab(3)}>
                ({product.reviews} reviews)
              </span>
              <span style={{ fontSize: '12px', color: 'var(--success)', background: 'var(--success-subtle)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                Verified ✓
              </span>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              {isGI  && <Badge bg="rgba(217,119,6,0.12)"  border="rgba(217,119,6,0.25)"  color="#D97706">🏷 GI Certified</Badge>}
              {isHM  && <Badge bg="rgba(22,163,74,0.12)"  border="rgba(22,163,74,0.25)"  color="#16A34A">🤲 Handmade</Badge>}
              {product.subcategory && <Badge bg="var(--bg-overlay)" border="var(--border-subtle)" color="var(--text-secondary)">{product.subcategory}</Badge>}
              {product.region      && <Badge bg="var(--bg-overlay)" border="var(--border-subtle)" color="var(--text-secondary)">📍 {product.region}</Badge>}
            </div>

            {/* Price */}
            <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border-faint)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: '4px' }}>
                {showUSD
                  ? <span style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', animation: 'fadeUp 150ms ease both' }}>
                      ${product.priceUSD} USD
                    </span>
                  : <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      ₹{product.price?.toLocaleString('en-IN')}
                    </span>
                }
                <button onClick={() => setShowUSD(v => !v)} style={{
                  background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-full)', fontSize: '12px', color: 'var(--text-secondary)',
                  padding: '4px 10px', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font-mono)',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  ₹ INR ⇄ $ USD
                </button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>Inclusive of all taxes</p>
            </div>

            {/* Shipping card */}
            <div style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border-faint)',
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-4)',
              marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '5px',
            }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                🚚 Ships from {product.city} in 1–2 business days
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                🌍 Estimated delivery: 7–14 days (USA), 5–10 days (UK)
              </p>
            </div>

            {/* Qty */}
            <div style={{ marginTop: 'var(--space-5)' }}>
              <QtyStepper value={qty} onChange={setQty} />
            </div>

            {/* CTA buttons */}
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

              {/* Add to Cart */}
              <button onClick={handleAddToCart} style={{
                width: '100%', height: '52px', border: 'none', borderRadius: 'var(--radius-lg)',
                background: addedCart ? 'rgba(22,163,74,0.90)' : 'var(--brand-saffron)',
                color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                boxShadow: addedCart ? '0 1px 2px rgba(0,0,0,0.4), 0 0 24px rgba(22,163,74,0.25)' : '0 1px 2px rgba(0,0,0,0.4), 0 0 24px rgba(249,115,22,0.20)',
                transition: 'all 200ms ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
                onMouseEnter={e => { if (!addedCart) { e.currentTarget.style.background = 'var(--brand-saffron-dk)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.4), 0 0 32px rgba(249,115,22,0.32)' } }}
                onMouseLeave={e => { if (!addedCart) { e.currentTarget.style.background = 'var(--brand-saffron)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.4), 0 0 24px rgba(249,115,22,0.20)' } }}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                {addedCart ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Added to Cart!
                  </>
                ) : `Add to Cart${qty > 1 ? ` (×${qty})` : ''}`}
              </button>

              {/* Buy Now */}
              <button onClick={handleBuyNow} style={{
                width: '100%', height: '52px', borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-subtle)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-overlay)' }}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                Buy Now
              </button>

              {/* Save / Wishlist */}
              <button onClick={toggleWishlist} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '14px', color: wishlisted ? '#EF4444' : 'var(--text-tertiary)',
                transition: 'color 150ms ease', alignSelf: 'center',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = wishlisted ? '#EF4444' : 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.color = wishlisted ? '#EF4444' : 'var(--text-tertiary)' }}
              >
                {wishlisted ? '♥ Saved' : '♡ Save to Wishlist'}
              </button>
            </div>

            {/* Trust strip */}
            <div style={{
              marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--border-faint)',
              display: 'flex', justifyContent: 'center', gap: 'var(--space-4)', flexWrap: 'wrap',
            }}>
              {['🔒 Secure Payment', '↩ 30-day Returns', '✓ Verified Seller'].map(t => (
                <span key={t} style={{ fontSize: '12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            TABS
        ══════════════════════════════════════════ */}
        <div style={{ marginTop: 'var(--space-12)', borderTop: '1px solid var(--border-faint)' }}>
          <TabStrip tabs={tabs} active={activeTab} onChange={setActiveTab} />

          <div style={{ padding: 'var(--space-8) 0', maxWidth: '880px' }}>

            {/* ── Description ───────────────────── */}
            {activeTab === 0 && (
              <div>
                <p style={{ fontSize: '16px', lineHeight: 1.75, color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                  {product.description}
                </p>
                <table style={{ borderCollapse: 'collapse', maxWidth: '520px' }}>
                  <tbody>
                    {[
                      product.material    && ['Material',  product.material],
                      product.weight      && ['Weight',    product.weight],
                      product.subcategory && ['Type',      product.subcategory],
                      product.city        && ['Origin',    `${product.city}, ${product.state}`],
                      product.occasions?.length && ['Occasions', product.occasions.join(', ')],
                    ].filter(Boolean).map(([k, v], i) => (
                      <tr key={k} style={{ background: i % 2 === 0 ? 'var(--bg-raised)' : 'transparent' }}>
                        <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500, minWidth: '110px' }}>{k}</td>
                        <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── The Story ─────────────────────── */}
            {activeTab === 1 && (
              <div style={{ display: 'flex', gap: 'var(--space-10)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <blockquote style={{
                    fontSize: '18px', lineHeight: 1.8, color: 'var(--text-secondary)',
                    fontStyle: 'italic', fontFamily: 'Georgia, serif',
                    borderLeft: '3px solid var(--brand-saffron)',
                    paddingLeft: 'var(--space-5)', margin: '0 0 var(--space-6)',
                  }}>
                    "{story1}"
                  </blockquote>
                  <p style={{ fontSize: '15px', lineHeight: 1.75, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                    The tradition of <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{product.subcategory}</strong> in{' '}
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{product.state}</strong> spans centuries,
                    passed through generations of artisan families who have refined this craft into an art form.
                    Each piece from <em>{product.seller}</em> carries the fingerprints of skilled hands
                    and a lineage of cultural memory that cannot be replicated by machines.
                  </p>
                  <p style={{ fontSize: '15px', lineHeight: 1.75, color: 'var(--text-secondary)' }}>
                    When you purchase this piece, you sustain a living heritage — supporting a family in {product.city}
                    and carrying a fragment of India across the world.
                  </p>
                </div>
                <div style={{ flex: '0 0 200px', minWidth: '160px' }}>
                  <img src={artPhot} alt={product.seller} style={{
                    width: '100%', borderRadius: 'var(--radius-xl)', objectFit: 'cover',
                    aspectRatio: '3/4', border: '1px solid var(--border-faint)', display: 'block',
                  }}
                    onError={e => { e.target.src = `https://picsum.photos/seed/${product.id}art/300/400` }}
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px', textAlign: 'center' }}>
                    {product.seller} · {product.city}
                  </p>
                </div>
              </div>
            )}

            {/* ── Shipping ──────────────────────── */}
            {activeTab === 2 && (
              <div>
                <div style={{
                  background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.20)',
                  borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
                  marginBottom: 'var(--space-6)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                  💡 <strong style={{ color: '#D97706' }}>DDP (Delivered Duty Paid)</strong> — Pay import duties upfront.
                  No surprise charges at delivery. Your package clears customs seamlessly.
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '460px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                        {['Region', 'Standard', 'Express', 'Free Shipping'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'left', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SHIPPING_ROWS.map((row, i) => (
                        <tr key={row.region} style={{ borderBottom: '1px solid var(--border-faint)', background: i % 2 !== 0 ? 'var(--bg-raised)' : 'transparent' }}>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{row.region}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{row.standard}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{row.express}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--success)' }}>{row.free}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Reviews ───────────────────────── */}
            {activeTab === 3 && (
              <div>
                <div style={{ display: 'flex', gap: 'var(--space-12)', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: '56px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                      {product.rating?.toFixed(1)}
                    </div>
                    <Stars rating={product.rating ?? 0} size={16} />
                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                      {product.reviews} reviews
                    </p>
                  </div>
                  <RatingBars rating={product.rating} total={product.reviews} />
                </div>

                {/* Country filter */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
                  {COUNTRY_FILTERS.map(f => (
                    <button key={f} onClick={() => setReviewFilter(f)} style={{
                      background:   reviewFilter === f ? 'rgba(249,115,22,0.15)' : 'var(--bg-subtle)',
                      border:       `1px solid ${reviewFilter === f ? 'rgba(249,115,22,0.35)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-full)',
                      color:        reviewFilter === f ? 'var(--brand-saffron-lt)' : 'var(--text-secondary)',
                      fontSize:     '13px', padding: '6px 14px', cursor: 'pointer',
                      fontWeight:   reviewFilter === f ? 600 : 400, transition: 'all 150ms ease',
                    }}>{f}</button>
                  ))}
                </div>

                {/* Review list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {filteredRevs.map((r, i) => (
                    <div key={i} style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--border-faint)',
                      borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)',
                      animation: `fadeUp 300ms var(--ease-out) ${i * 50}ms both`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--brand-saffron), var(--brand-gold))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px', fontWeight: 700, color: '#fff',
                          }}>{r.name[0]}</div>
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{r.name}</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>{r.flag} {r.code} · {r.date}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Stars rating={r.rating} size={12} />
                          {r.verified && (
                            <span style={{ fontSize: '11px', color: 'var(--success)', background: 'var(--success-subtle)', padding: '2px 7px', borderRadius: 'var(--radius-full)' }}>
                              Verified ✓
                            </span>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--text-secondary)', margin: 0 }}>{r.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          ARTISAN CARD
      ══════════════════════════════════════════ */}
      <section style={{
        background: 'var(--bg-raised)',
        borderTop: '1px solid var(--border-faint)', borderBottom: '1px solid var(--border-faint)',
        padding: 'var(--space-12) var(--space-6)',
      }}>
        <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
          <img src={artPhot} alt={product.seller} style={{
            width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover',
            border: '3px solid var(--brand-saffron)', flexShrink: 0,
          }}
            onError={e => { e.target.src = `https://picsum.photos/seed/${product.id}a2/300/300` }}
          />
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.10em', color: 'var(--brand-saffron)', textTransform: 'uppercase', marginBottom: 'var(--space-2)', margin: '0 0 var(--space-2)' }}>ARTISAN</p>
            <h3 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{product.seller}</h3>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
              {product.subcategory} · {product.city}
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', maxWidth: '520px', margin: 0 }}>
              {story1} Trusted by thousands of diaspora customers across the globe.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          RELATED PRODUCTS
      ══════════════════════════════════════════ */}
      {related.length > 0 && (
        <section style={{ maxWidth: 'var(--container-xl)', margin: '0 auto', padding: 'var(--space-12) var(--space-6)' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 'var(--space-8)' }}>
            More like this
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox images={images} startIndex={activeImg} onClose={() => setLightbox(false)} />}

      <style>{`
        @keyframes lbFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lbZoom { from { transform: scale(0.88); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </>
  )
}
