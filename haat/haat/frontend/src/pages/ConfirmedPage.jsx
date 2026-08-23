import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

// ── ConfirmedPage ──────────────────────────────────────────────────────────────
// Full-screen order confirmation with animated checkmark + confetti rain

const CONFETTI_COLORS = [
  '#F97316', '#FB923C', '#FBBF24', '#F59E0B',
  '#22C55E', '#4ADE80', '#FFF7ED', '#FED7AA',
  '#FCA5A5', '#86EFAC',
]

function generateConfetti() {
  return Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,                   // vw %
    delay: Math.random() * 1.4,               // seconds
    duration: 2.2 + Math.random() * 1.8,      // seconds
    size: 6 + Math.random() * 5,              // px
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    drift: (Math.random() - 0.5) * 80,        // px x-drift
    rotation: Math.floor(Math.random() * 360),
    isCircle: Math.random() > 0.5,
  }))
}

function Confetti() {
  const [pieces, setPieces] = useState(() => generateConfetti())

  useEffect(() => {
    const id = setTimeout(() => setPieces([]), 5000)
    return () => clearTimeout(id)
  }, [])

  if (pieces.length === 0) return null

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 300, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}vw`,
            top: '-20px',
            width:  `${p.size}px`,
            height: p.isCircle ? `${p.size}px` : `${p.size * 1.6}px`,
            borderRadius: p.isCircle ? '50%' : '2px',
            background: p.color,
            opacity: 0.9,
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in both`,
            '--drift': `${p.drift}px`,
            '--rot': `${p.rotation}deg`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0)      translateX(0)               rotate(0deg);    opacity: 0.9; }
          10%  { opacity: 1; }
          100% { transform: translateY(110vh)  translateX(var(--drift))    rotate(calc(var(--rot) * 4)); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Animated checkmark ─────────────────────────────────────────────────────────
function CheckmarkCircle() {
  return (
    <div style={{
      position: 'relative',
      width: '96px',
      height: '96px',
      flexShrink: 0,
    }}>
      {/* Outer glow pulse */}
      {[0, 0.5].map((delay, i) => (
        <span key={i} style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'rgba(249,115,22,0.15)',
          animation: `confirmPulse 2s ease-out ${delay}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}
      {/* Circle bg */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(249,115,22,0.20), rgba(251,191,36,0.15))',
        border: '2px solid rgba(249,115,22,0.40)',
        animation: 'confirmScaleIn 500ms cubic-bezier(0.34,1.56,0.64,1) both',
      }} />
      {/* SVG checkmark */}
      <svg
        width="96" height="96" viewBox="0 0 96 96"
        style={{ position: 'absolute', inset: 0, animation: 'confirmScaleIn 500ms 100ms cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <polyline
          points="28,50 42,64 68,36"
          fill="none"
          stroke="var(--brand-saffron)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 60,
            strokeDashoffset: 60,
            animation: 'checkDraw 600ms 250ms ease-out forwards',
          }}
        />
      </svg>
      <style>{`
        @keyframes confirmScaleIn {
          from { transform: scale(0.4); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes checkDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes confirmPulse {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Share row ──────────────────────────────────────────────────────────────────
function ShareRow({ orderId }) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/confirmed?order=${orderId}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => {})
  }

  const tweetText = encodeURIComponent(`Just ordered authentic Indian handicrafts from @haatindia! 🇮🇳✨ Order ${orderId}`)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Share</span>
      {/* Twitter/X */}
      <a
        href={`https://twitter.com/intent/tweet?text=${tweetText}`}
        target="_blank"
        rel="noreferrer"
        style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        𝕏
      </a>
      {/* WhatsApp share */}
      <a
        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`I just ordered from haat! Order ${orderId} 🛍️`)}`}
        target="_blank"
        rel="noreferrer"
        style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#25D366', textDecoration: 'none', fontSize: '16px',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#25D366'; e.currentTarget.style.background = 'rgba(37,211,102,0.08)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
      {/* Copy link */}
      <button
        onClick={copyLink}
        style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: copied ? 'rgba(34,197,94,0.12)' : 'var(--bg-raised)',
          border: `1px solid ${copied ? '#22C55E' : 'var(--border-subtle)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: copied ? '#22C55E' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 150ms ease',
          fontSize: '14px',
        }}
        title={copied ? 'Copied!' : 'Copy link'}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        )}
      </button>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function ConfirmedPage() {
  const navigate = useNavigate()
  const { state } = useLocation()

  // Fallback data if landed directly (dev)
  const orderId    = state?.orderId    || 'HT-' + Math.floor(100000 + Math.random() * 900000)
  const items      = state?.items      || []
  const totals     = state?.totals     || { finalUSD: 0 }
  const shipping   = state?.shipping   || {}
  const shippingMethod = state?.shippingMethod || { label: 'Standard Shipping' }
  const estimated  = state?.estimatedDelivery || 'Apr 3 – Apr 7, 2026'
  const payMethod  = state?.payMethod  || 'card'

  const [visible, setVisible] = useState(false)
  useEffect(() => {
    setTimeout(() => setVisible(true), 50)
    window.scrollTo(0, 0)
  }, [])

  const whatsappTrackUrl = `https://api.whatsapp.com/send?phone=919999999999&text=${encodeURIComponent(`Hi! I'd like to track my order ${orderId}`)}`

  return (
    <>
      <Confetti />

      {/* ── Minimal nav ─────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: '60px',
        background: 'rgba(8,8,8,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>haat.</span>
        </a>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        paddingTop: '60px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '60px 24px 80px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '560px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 500ms ease, transform 500ms ease',
        }}>

          {/* Success animation */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', paddingTop: '20px' }}>
            <CheckmarkCircle />
            <div style={{ textAlign: 'center' }}>
              <h1 style={{
                fontSize: '36px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                margin: '0 0 8px',
                background: 'linear-gradient(135deg, var(--brand-saffron), var(--brand-gold))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.1,
              }}>
                Order Confirmed! ✦
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Your authentic Indian treasures are being packed with care.
              </p>
            </div>
          </div>

          {/* Order ID pill */}
          <div style={{
            padding: '10px 20px',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Order</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--brand-saffron)', letterSpacing: '0.06em' }}>
              {orderId}
            </span>
          </div>

          {/* Estimated delivery */}
          <div style={{
            width: '100%',
            padding: '16px 20px',
            background: 'rgba(249,115,22,0.06)',
            border: '1px solid rgba(249,115,22,0.18)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
              background: 'rgba(249,115,22,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: '20px',
            }}>
              📦
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                {shippingMethod.label}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Estimated {estimated}
              </div>
            </div>
          </div>

          {/* Items card */}
          {items.length > 0 && (
            <div style={{
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {items.length} item{items.length !== 1 ? 's' : ''} · ${totals.finalUSD?.toFixed(2)}
                </span>
              </div>
              {items.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    animation: `fadeUp 300ms ${i * 60}ms both`,
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: '48px', height: '58px', objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
                    onError={e => { e.target.src = `https://picsum.photos/seed/${item.id}/48/58` }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {item.seller?.name || item.city} · Qty {item.qty}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', flexShrink: 0 }}>
                    ${((item.priceUSD || item.price / 84) * item.qty).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delivery address recap */}
          {shipping.fullName && (
            <div style={{
              width: '100%',
              padding: '14px 20px',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Delivering to: </span>
              {shipping.fullName}, {[shipping.address, shipping.city, shipping.country].filter(Boolean).join(', ')}
            </div>
          )}

          {/* CTA buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* WhatsApp track */}
            <a
              href={whatsappTrackUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '14px 28px',
                background: '#25D366',
                color: '#fff',
                borderRadius: 'var(--radius-lg)',
                fontWeight: 700,
                fontSize: '15px',
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(37,211,102,0.30)',
                transition: 'all 150ms ease',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1ebe5d'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#25D366'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              📱 Track via WhatsApp
            </a>

            {/* Continue Shopping */}
            <button
              onClick={() => navigate('/')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '14px 28px',
                background: 'transparent',
                color: 'var(--brand-saffron)',
                border: '1.5px solid rgba(249,115,22,0.40)',
                borderRadius: 'var(--radius-lg)',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.08)'; e.currentTarget.style.borderColor = 'var(--brand-saffron)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.40)' }}
            >
              Continue Shopping →
            </button>
          </div>

          {/* Share row */}
          <ShareRow orderId={orderId} />

          {/* Footer note */}
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7, margin: 0, maxWidth: '400px' }}>
            A confirmation email has been sent to <span style={{ color: 'var(--text-secondary)' }}>{shipping.email || 'your email'}</span>.
            Questions? <a href="mailto:support@haatindia.com" style={{ color: 'var(--brand-saffron)', textDecoration: 'none' }}>support@haatindia.com</a>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
