import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCart }  from '../contexts/CartContext'
import { useToast } from '../contexts/ToastContext'

const FREE_SHIPPING_USD = 75
const GIFT_WRAP_USD     = 3.99
const PROMO_CODES       = { WELCOME10: 0.10 }

// ── Qty stepper ───────────────────────────────────────────────────────────────
function Stepper({ value, min = 1, max = 10, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {['−', '+'].map((sym, i) => (
        <button key={sym} onClick={() => onChange(i === 0 ? Math.max(min, value - 1) : Math.min(max, value + 1))}
          style={{
            width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border-default)',
            background: 'var(--bg-overlay)', color: 'var(--text-primary)', fontSize: '16px', fontWeight: 300,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            transition: 'border-color 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
        >{sym}</button>
      ))}
      <span style={{ width: '28px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  )
}

// ── Cart item row ─────────────────────────────────────────────────────────────
function CartItem({ item, onQtyChange, onRemove, giftWrap, onGiftWrapToggle }) {
  const [removeHov, setRemoveHov] = useState(false)

  return (
    <div style={{
      display: 'flex', gap: 'var(--space-4)',
      padding: 'var(--space-5) 0', borderBottom: '1px solid var(--border-faint)',
      animation: 'fadeUp 300ms var(--ease-out) both',
    }}>
      {/* Thumbnail */}
      <Link to={`/product/${item.productId}`}>
        <img src={item.image} alt={item.name} style={{
          width: '80px', height: '100px', borderRadius: 'var(--radius-lg)',
          objectFit: 'cover', border: '1px solid var(--border-faint)',
          display: 'block', flexShrink: 0,
        }}
          onError={e => { e.target.src = `https://picsum.photos/seed/${item.productId}/160/200` }}
        />
      </Link>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Link to={`/product/${item.productId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </p>
        </Link>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
          {[item.seller, item.city].filter(Boolean).join(', ')}
        </p>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            ₹{(item.price * item.qty).toLocaleString('en-IN')}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            ${((item.price / 83.5) * item.qty).toFixed(2)}
          </span>
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Stepper value={item.qty} onChange={onQtyChange} />

          <button onClick={onRemove}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: removeHov ? 'var(--error)' : 'var(--text-tertiary)',
              transition: 'color 150ms ease', padding: 0,
            }}
            onMouseEnter={() => setRemoveHov(true)}
            onMouseLeave={() => setRemoveHov(false)}
          >
            Remove
          </button>

          {/* Gift wrap toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={giftWrap} onChange={onGiftWrapToggle}
              style={{ accentColor: 'var(--brand-saffron)', width: '13px', height: '13px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: giftWrap ? 'var(--brand-saffron-lt)' : 'var(--text-tertiary)', transition: 'color 150ms' }}>
              🎁 Gift wrap (+${GIFT_WRAP_USD.toFixed(2)})
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}

// ── CartPage ──────────────────────────────────────────────────────────────────
export default function CartPage() {
  const navigate = useNavigate()
  const { items, count, totalINR, totalUSD, remove, updateQty } = useCart()
  const { success: toastOk, info: toastInfo } = useToast()

  const [giftWraps,  setGiftWraps]  = useState({}) // productId → bool
  const [promo,      setPromo]      = useState('')
  const [promoInput, setPromoInput] = useState('')
  const [promoErr,   setPromoErr]   = useState('')
  const [discount,   setDiscount]   = useState(0)

  const giftWrapCount = Object.values(giftWraps).filter(Boolean).length
  const giftWrapUSD   = giftWrapCount * GIFT_WRAP_USD

  const baseUSD      = totalUSD
  const discountUSD  = +(baseUSD * discount).toFixed(2)
  const shippingUSD  = (baseUSD - discountUSD) >= FREE_SHIPPING_USD ? 0 : 12.99
  const finalUSD     = +(baseUSD - discountUSD + shippingUSD + giftWrapUSD).toFixed(2)
  const freeProgress = Math.min(100, ((baseUSD - discountUSD) / FREE_SHIPPING_USD) * 100)
  const toFree       = Math.max(0, FREE_SHIPPING_USD - (baseUSD - discountUSD))

  function applyPromo() {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    const disc = PROMO_CODES[code]
    if (disc) {
      setDiscount(disc)
      setPromo(code)
      setPromoErr('')
      setPromoInput('')
      toastOk(`Promo "${code}" applied — ${(disc * 100).toFixed(0)}% off!`)
    } else {
      setPromoErr('Invalid promo code.')
    }
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (count === 0) return (
    <div style={{
      minHeight: '80vh', paddingTop: 'calc(var(--nav-height) + 48px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 'var(--space-4)', textAlign: 'center', padding: 'calc(var(--nav-height) + 48px) var(--space-6) var(--space-16)',
    }}>
      <span style={{ fontSize: '72px', lineHeight: 1 }}>🛒</span>
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
        Your cart is empty
      </h2>
      <p style={{ fontSize: '16px', color: 'var(--text-secondary)', margin: 0 }}>
        Discover authentic Indian products below.
      </p>
      <button onClick={() => navigate('/')} style={{
        marginTop: 'var(--space-2)',
        background: 'var(--brand-saffron)', color: '#fff', border: 'none',
        borderRadius: 'var(--radius-full)', padding: '12px 28px',
        fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        transition: 'opacity 150ms ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >
        Start browsing →
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto', padding: 'calc(var(--nav-height) + 40px) var(--space-6) var(--space-16)' }}>

      {/* Page header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Your Cart
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', margin: 0 }}>
          {count} item{count !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── LEFT: Items ─────────────────────────── */}
        <div style={{ flex: '1 1 400px', minWidth: '280px' }}>

          {/* Free shipping progress */}
          <div style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border-faint)',
            borderRadius: 'var(--radius-xl)', padding: 'var(--space-4) var(--space-5)',
            marginBottom: 'var(--space-5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', color: shippingUSD === 0 ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 500 }}>
                {shippingUSD === 0
                  ? '🎉 Free shipping unlocked!'
                  : `$${toFree.toFixed(2)} more for free shipping`
                }
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                ${(baseUSD - discountUSD).toFixed(2)} / $75
              </span>
            </div>
            <div style={{ height: '4px', background: 'var(--border-faint)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${freeProgress}%`,
                background: shippingUSD === 0 ? 'var(--success)' : 'var(--brand-saffron)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 400ms var(--ease-out)',
              }} />
            </div>
          </div>

          {/* Items */}
          {items.map(item => (
            <CartItem
              key={item.productId}
              item={item}
              giftWrap={!!giftWraps[item.productId]}
              onQtyChange={qty => updateQty(item.productId, qty)}
              onRemove={() => {
                remove(item.productId)
                toastInfo(`${item.name} removed`)
              }}
              onGiftWrapToggle={() => setGiftWraps(prev => ({ ...prev, [item.productId]: !prev[item.productId] }))}
            />
          ))}
        </div>

        {/* ── RIGHT: Summary ──────────────────────── */}
        <div style={{ flex: '0 0 320px', minWidth: '280px', position: 'sticky', top: 'calc(var(--nav-height) + 24px)' }}>
          <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 var(--space-5)' }}>
              Order Summary
            </h2>

            {/* Line items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: 'var(--space-4)' }}>
              <SummaryLine label="Subtotal (INR)" value={`₹${totalINR.toLocaleString('en-IN')}`} />
              <SummaryLine label="Subtotal (USD)" value={`$${baseUSD.toFixed(2)}`} mono dim />
              {giftWrapCount > 0 && (
                <SummaryLine label={`Gift wrap (×${giftWrapCount})`} value={`+$${giftWrapUSD.toFixed(2)}`} />
              )}
              {discount > 0 && (
                <SummaryLine label={`Promo ${promo} (−${(discount*100).toFixed(0)}%)`} value={`−$${discountUSD.toFixed(2)}`} green />
              )}
              <SummaryLine
                label="Shipping"
                value={shippingUSD === 0 ? 'Free 🎉' : `$${shippingUSD.toFixed(2)}`}
                green={shippingUSD === 0}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Import duties
                  <span title="Depends on destination country" style={{ cursor: 'help', marginLeft: '4px', opacity: 0.6 }}>ℹ️</span>
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>At checkout</span>
              </div>
            </div>

            {/* Divider + total */}
            <div style={{ borderTop: '1px solid var(--border-faint)', paddingTop: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Total</span>
                <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  ${finalUSD.toFixed(2)} USD
                </span>
              </div>
            </div>

            {/* Promo code */}
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={promoInput}
                  onChange={e => { setPromoInput(e.target.value); setPromoErr('') }}
                  onKeyDown={e => { if (e.key === 'Enter') applyPromo() }}
                  placeholder="Promo code (try WELCOME10)"
                  disabled={!!promo}
                  style={{
                    flex: 1, background: 'var(--bg-subtle)', border: `1px solid ${promoErr ? 'var(--error)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)', padding: '10px 14px',
                    fontSize: '14px', color: 'var(--text-primary)', outline: 'none',
                    transition: 'border-color 150ms ease',
                  }}
                  onFocus={e => { if (!promo) e.target.style.borderColor = 'rgba(249,115,22,0.40)' }}
                  onBlur={e => { e.target.style.borderColor = promoErr ? 'var(--error)' : 'var(--border-subtle)' }}
                />
                <button onClick={applyPromo} disabled={!!promo || !promoInput.trim()}
                  style={{
                    background: promo ? 'rgba(22,163,74,0.15)' : 'var(--brand-saffron)',
                    color: promo ? 'var(--success)' : '#fff', border: 'none',
                    borderRadius: 'var(--radius-md)', padding: '10px 18px',
                    fontSize: '13px', fontWeight: 600, cursor: promo ? 'default' : 'pointer',
                    whiteSpace: 'nowrap', transition: 'all 150ms ease',
                  }}
                >
                  {promo ? '✓' : 'Apply'}
                </button>
              </div>
              {promoErr && <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px', margin: '4px 0 0' }}>{promoErr}</p>}
            </div>

            {/* Checkout button */}
            <button onClick={() => navigate('/checkout')} style={{
              width: '100%', height: '52px', background: 'var(--brand-saffron)',
              color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)',
              fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 0 24px rgba(249,115,22,0.20)',
              transition: 'box-shadow 150ms ease, background 150ms ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-saffron-dk)'; e.currentTarget.style.boxShadow = '0 0 40px rgba(249,115,22,0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand-saffron)'; e.currentTarget.style.boxShadow = '0 0 24px rgba(249,115,22,0.20)' }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              Checkout Securely →
            </button>

            {/* Trust strip */}
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 'var(--space-3)', margin: 'var(--space-3) 0 0' }}>
              🔒 256-bit SSL · Powered by Stripe
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryLine({ label, value, mono, dim, green }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{
        fontSize: '13px',
        fontWeight: green ? 600 : 400,
        color: green ? 'var(--success)' : dim ? 'var(--text-tertiary)' : 'var(--text-primary)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      }}>
        {value}
      </span>
    </div>
  )
}
