import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart }     from '../contexts/CartContext'
import { useToast }    from '../contexts/ToastContext'

// ── Star SVG ──────────────────────────────────────────────────────────────────
function Star({ filled }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill={filled ? 'var(--brand-saffron)' : 'rgba(255,255,255,0.15)'}>
      <path d="M5 0.5l1.18 2.39 2.64.38-1.91 1.86.45 2.63L5 6.5l-2.36 1.26.45-2.63L1.18 3.27l2.64-.38L5 .5z"/>
    </svg>
  )
}

// ── Wishlist helpers ──────────────────────────────────────────────────────────
function getWishlist() {
  try { return JSON.parse(localStorage.getItem('haat_wishlist') || '[]') } catch { return [] }
}
function setWishlist(ids) {
  try { localStorage.setItem('haat_wishlist', JSON.stringify(ids)) } catch {}
}

// ── Cart flight animation ─────────────────────────────────────────────────────
function flyToCart(imgEl) {
  const cartIcon = document.querySelector('[data-cart-icon]')
  if (!cartIcon || !imgEl) return

  const from = imgEl.getBoundingClientRect()
  const to   = cartIcon.getBoundingClientRect()

  const clone = document.createElement('div')
  clone.style.cssText = [
    'position:fixed',
    `width:60px`, `height:60px`,
    'border-radius:8px', 'overflow:hidden',
    'z-index:500', 'pointer-events:none',
    `top:${from.top + from.height / 2 - 30}px`,
    `left:${from.left + from.width / 2 - 30}px`,
    'background:#111',
  ].join(';')

  const img = document.createElement('img')
  img.src = imgEl.src
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;'
  clone.appendChild(img)
  document.body.appendChild(clone)

  const dx = (to.left + to.width / 2 - 30) - (from.left + from.width / 2 - 30)
  const dy = (to.top  + to.height / 2 - 30) - (from.top  + from.height / 2 - 30)

  const anim = clone.animate([
    { transform: 'translate(0,0) scale(1)',                                  opacity: 1 },
    { transform: `translate(${dx * 0.45}px,${dy * 0.08}px) scale(0.65)`,   opacity: 0.9, offset: 0.35 },
    { transform: `translate(${dx}px,${dy}px) scale(0.15)`,                  opacity: 0.5 },
  ], {
    duration: 760,
    easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
    fill: 'forwards',
  })

  anim.onfinish = () => {
    clone.remove()
    // Bounce the cart badge
    const badge = document.querySelector('[data-cart-badge]')
    if (badge) {
      badge.style.animation = 'none'
      void badge.offsetWidth
      badge.style.animation = 'cartBounce 400ms var(--ease-spring) both'
    }
  }
}

// ── Heart particles ───────────────────────────────────────────────────────────
function HeartParticles({ active }) {
  if (!active) return null
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 2 }}>
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <span
          key={i}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            width: '6px', height: '6px', borderRadius: '50%',
            marginLeft: '-3px', marginTop: '-3px',
            background: i % 2 === 0 ? 'var(--brand-saffron)' : 'var(--brand-gold)',
            animation: 'heartParticle 600ms ease-out both',
            '--deg': `${deg}deg`,
          }}
        />
      ))}
    </div>
  )
}

// ── ProductCard ───────────────────────────────────────────────────────────────
export default function ProductCard({ product, index = 0 }) {
  const navigate = useNavigate()
  const { add }  = useCart()
  const { success: toastSuccess } = useToast()

  const [hovered,    setHovered]    = useState(false)
  const [addedState, setAddedState] = useState('idle')
  const [wishlisted, setWishlisted] = useState(false)
  const [heartAnim,  setHeartAnim]  = useState(false)
  const [particles,  setParticles]  = useState(false)
  const imgRef      = useRef(null)
  const addTimerRef = useRef(null)

  useEffect(() => {
    setWishlisted(getWishlist().includes(product.id))
  }, [product.id])

  useEffect(() => () => clearTimeout(addTimerRef.current), [])

  function handleAddToCart(e) {
    e.stopPropagation()
    if (addedState === 'added') return
    add(product)
    toastSuccess(`${product.name} added to cart`)
    setAddedState('added')
    flyToCart(imgRef.current)
    addTimerRef.current = setTimeout(() => setAddedState('idle'), 1500)
  }

  function handleWishlist(e) {
    e.stopPropagation()
    const list = getWishlist()
    const adding = !wishlisted
    setWishlist(adding ? [...list, product.id] : list.filter(id => id !== product.id))
    setWishlisted(adding)
    if (adding) {
      setHeartAnim(true)
      setParticles(true)
      setTimeout(() => setHeartAnim(false), 450)
      setTimeout(() => setParticles(false), 650)
    }
  }

  const isGI       = product.tags?.includes('GI tag') || product.tags?.some(t => t.includes('GI'))
  const isHandmade = product.seller?.toLowerCase().includes('artisan') ||
                     product.seller?.toLowerCase().includes('handloom') ||
                     product.tags?.some(t => ['handmade','handwoven','handspun','hand-painted','hand-carved','hand-done'].includes(t.toLowerCase()))
  const ratingInt  = Math.round(product.rating ?? 0)

  return (
    <article
      onClick={() => navigate(`/product/${product.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:    'var(--bg-raised)',
        border:        `1px solid ${hovered ? 'var(--border-default)' : 'var(--border-faint)'}`,
        borderRadius:  'var(--radius-xl)',
        overflow:      'hidden',
        cursor:        'pointer',
        display:       'flex',
        flexDirection: 'column',
        transform:     hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow:     hovered ? 'var(--shadow-lg)' : 'none',
        transition:    'transform 250ms var(--ease-default), box-shadow 250ms var(--ease-default), border-color 250ms var(--ease-default)',
        animation:     `fadeUp 400ms var(--ease-out) ${Math.min(index, 6) * 60}ms both`,
      }}
    >
      {/* ── Image area ─────────────────────────────── */}
      <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden' }}>
        <img
          ref={imgRef}
          src={product.image}
          alt={product.name}
          loading="lazy"
          style={{
            width:      '100%',
            height:     '100%',
            objectFit:  'cover',
            transform:  hovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 500ms var(--ease-smooth)',
          }}
          onError={e => { e.target.src = `https://picsum.photos/seed/${product.id}/400/533` }}
        />

        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        {/* Badges */}
        <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {isGI && (
            <span style={{
              background: 'rgba(217,119,6,0.88)', backdropFilter: 'blur(4px)', color: '#fff',
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.07em', padding: '3px 8px',
              borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,255,255,0.15)',
            }}>GI CERTIFIED</span>
          )}
          {isHandmade && (
            <span style={{
              background: 'rgba(22,163,74,0.85)', backdropFilter: 'blur(4px)', color: '#fff',
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.07em', padding: '3px 8px',
              borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,255,255,0.15)',
            }}>HANDMADE</span>
          )}
        </div>

        {/* Wishlist button */}
        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <HeartParticles active={particles} />
          <button
            onClick={handleWishlist}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: wishlisted ? '#EF4444' : 'rgba(255,255,255,0.70)',
              transition: 'color 150ms ease',
              position: 'relative',
              animation: heartAnim ? 'heartPop 450ms ease both' : 'none',
            }}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill={wishlisted ? '#EF4444' : 'none'}
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: 'fill 150ms ease' }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────── */}
      <div style={{ padding: 'var(--space-4)', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <h3 style={{
          fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', margin: 0,
        }}>
          {product.name}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ fontSize: '10px', color: 'var(--brand-saffron)', lineHeight: 1 }}>📍</span>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1 }}>
            {[product.seller, product.city].filter(Boolean).join(', ')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[1,2,3,4,5].map(i => <Star key={i} filled={i <= ratingInt} />)}
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '2px' }}>
            {product.rating?.toFixed(1)}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>({product.reviews})</span>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginTop: 'auto', paddingTop: 'var(--space-2)',
        }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            ₹{product.price?.toLocaleString('en-IN')}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            ${product.priceUSD}
          </span>
        </div>

        <button
          onClick={handleAddToCart}
          style={{
            width: '100%', height: '36px',
            background:   addedState === 'added' ? 'rgba(22,163,74,0.12)' : 'rgba(249,115,22,0.10)',
            border:       `1px solid ${addedState === 'added' ? 'rgba(22,163,74,0.30)' : 'rgba(249,115,22,0.20)'}`,
            borderRadius: 'var(--radius-md)',
            color:        addedState === 'added' ? '#4ADE80' : 'var(--brand-saffron-lt)',
            fontSize: '13px', fontWeight: 600, letterSpacing: '0.01em',
            transition: 'all 150ms ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
          onMouseEnter={e => {
            if (addedState !== 'added') {
              e.currentTarget.style.background  = 'rgba(249,115,22,0.18)'
              e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)'
              e.currentTarget.style.boxShadow   = '0 0 20px rgba(249,115,22,0.15)'
            }
          }}
          onMouseLeave={e => {
            if (addedState !== 'added') {
              e.currentTarget.style.background  = 'rgba(249,115,22,0.10)'
              e.currentTarget.style.borderColor = 'rgba(249,115,22,0.20)'
              e.currentTarget.style.boxShadow   = 'none'
            }
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
          onMouseUp={e =>   { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {addedState === 'added' ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Added
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              Add to Cart
            </>
          )}
        </button>
      </div>
    </article>
  )
}
