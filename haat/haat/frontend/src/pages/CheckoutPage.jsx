import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { useToast } from '../contexts/ToastContext'

// ── CheckoutPage ───────────────────────────────────────────────────────────────
// Distraction-free 3-step checkout: Shipping → Payment → Review

const SHIPPING_METHODS = [
  {
    id: 'standard',
    label: 'Standard Shipping',
    desc: '10–14 business days',
    price: 0,
    note: 'Free on orders over $75',
  },
  {
    id: 'express',
    label: 'Express Shipping',
    desc: '5–7 business days',
    price: 14.99,
    note: 'DHL Express',
  },
  {
    id: 'ddp',
    label: 'DDP (Duties Paid)',
    desc: '7–10 business days',
    price: 24.99,
    note: 'All customs & duties included',
  },
]

const COUNTRY_CODES = [
  { code: '+1',   flag: '🇺🇸', label: 'US' },
  { code: '+44',  flag: '🇬🇧', label: 'GB' },
  { code: '+61',  flag: '🇦🇺', label: 'AU' },
  { code: '+971', flag: '🇦🇪', label: 'AE' },
  { code: '+65',  flag: '🇸🇬', label: 'SG' },
  { code: '+60',  flag: '🇲🇾', label: 'MY' },
  { code: '+64',  flag: '🇳🇿', label: 'NZ' },
  { code: '+49',  flag: '🇩🇪', label: 'DE' },
  { code: '+33',  flag: '🇫🇷', label: 'FR' },
  { code: '+91',  flag: '🇮🇳', label: 'IN' },
]

function detectCardType(num) {
  const n = num.replace(/\s/g, '')
  if (/^4/.test(n)) return 'visa'
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard'
  if (/^3[47]/.test(n)) return 'amex'
  return null
}

function formatCardNumber(val) {
  const digits = val.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(val) {
  const digits = val.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2)
  return digits
}

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepBar({ step }) {
  const steps = ['Shipping', 'Payment', 'Review']
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
      padding: '16px 24px',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      {steps.map((label, i) => {
        const idx = i + 1
        const done    = idx < step
        const current = idx === step
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <div style={{
                width: '48px',
                height: '1px',
                background: done ? 'var(--brand-saffron)' : 'var(--border-subtle)',
                transition: 'background 300ms ease',
              }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                transition: 'all 300ms ease',
                background: done
                  ? 'var(--brand-saffron)'
                  : current
                    ? 'rgba(249,115,22,0.15)'
                    : 'var(--bg-raised)',
                border: done
                  ? '2px solid var(--brand-saffron)'
                  : current
                    ? '2px solid var(--brand-saffron)'
                    : '2px solid var(--border-subtle)',
                color: done ? '#fff' : current ? 'var(--brand-saffron)' : 'var(--text-muted)',
              }}>
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : idx}
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: current ? 600 : 400,
                color: current ? 'var(--text-primary)' : done ? 'var(--brand-saffron)' : 'var(--text-muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                transition: 'color 300ms ease',
              }}>{label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Field wrappers ─────────────────────────────────────────────────────────────
function Field({ label, error, children, half }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: half ? '1 1 calc(50% - 8px)' : '1 1 100%', minWidth: 0 }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
      {error && <span style={{ fontSize: '11px', color: '#EF4444', marginTop: '-2px' }}>{error}</span>}
    </div>
  )
}

function Input({ error, ...props }) {
  return (
    <input
      {...props}
      style={{
        background: 'var(--bg-raised)',
        border: `1px solid ${error ? '#EF4444' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        padding: '10px 14px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
        ...(props.style || {}),
      }}
      onFocus={e => {
        e.target.style.borderColor = error ? '#EF4444' : 'rgba(249,115,22,0.50)'
        e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.10)'
      }}
      onBlur={e => {
        e.target.style.borderColor = error ? '#EF4444' : 'var(--border-default)'
        e.target.style.boxShadow = 'none'
      }}
    />
  )
}

// ── Step 1: Shipping ───────────────────────────────────────────────────────────
function ShippingStep({ data, onChange, errors, onNext }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Contact */}
      <section>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 16px' }}>Contact</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <Field label="Email address" error={errors.email} >
            <Input type="email" value={data.email} onChange={e => onChange('email', e.target.value)} placeholder="you@example.com" error={errors.email} />
          </Field>
          <Field label="Phone number" error={errors.phone}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={data.phoneCode}
                onChange={e => onChange('phoneCode', e.target.value)}
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  padding: '10px 8px',
                  outline: 'none',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
              <Input value={data.phone} onChange={e => onChange('phone', e.target.value)} placeholder="555 000 1234" error={errors.phone} style={{ flex: 1 }} />
            </div>
          </Field>
          <Field label="">
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', paddingTop: '4px' }}>
              <input
                type="checkbox"
                checked={data.whatsapp}
                onChange={e => onChange('whatsapp', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--brand-saffron)', cursor: 'pointer' }}
              />
              Send WhatsApp delivery updates to this number
            </label>
          </Field>
        </div>
      </section>

      {/* Delivery Address */}
      <section>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 16px' }}>Delivery Address</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <Field label="Country / Region" error={errors.country}>
            <select
              value={data.country}
              onChange={e => onChange('country', e.target.value)}
              style={{
                background: 'var(--bg-raised)',
                border: `1px solid ${errors.country ? '#EF4444' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                padding: '10px 14px',
                outline: 'none',
                width: '100%',
                cursor: 'pointer',
              }}
            >
              <option value="">Select country...</option>
              {['United States','United Kingdom','Australia','UAE','Singapore','Malaysia','New Zealand','Germany','France','Canada','Netherlands','Switzerland'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Full name" error={errors.fullName} half>
            <Input value={data.fullName} onChange={e => onChange('fullName', e.target.value)} placeholder="Priya Sharma" error={errors.fullName} />
          </Field>
          <Field label="Apartment / Suite" half>
            <Input value={data.apt} onChange={e => onChange('apt', e.target.value)} placeholder="Apt 4B (optional)" />
          </Field>
          <Field label="Street address" error={errors.address}>
            <Input value={data.address} onChange={e => onChange('address', e.target.value)} placeholder="123 Market Street" error={errors.address} />
          </Field>
          <Field label="City" error={errors.city} half>
            <Input value={data.city} onChange={e => onChange('city', e.target.value)} placeholder="London" error={errors.city} />
          </Field>
          <Field label="State / Province" error={errors.state} half>
            <Input value={data.state} onChange={e => onChange('state', e.target.value)} placeholder="England" error={errors.state} />
          </Field>
          <Field label="ZIP / Postal code" error={errors.zip} half>
            <Input value={data.zip} onChange={e => onChange('zip', e.target.value)} placeholder="EC1A 1BB" error={errors.zip} />
          </Field>
        </div>
      </section>

      {/* Shipping Method */}
      <section>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 16px' }}>Shipping Method</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {SHIPPING_METHODS.map(m => {
            const selected = data.shippingMethod === m.id
            return (
              <label
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                  border: `1.5px solid ${selected ? 'var(--brand-saffron)' : 'var(--border-default)'}`,
                  background: selected ? 'rgba(249,115,22,0.06)' : 'var(--bg-raised)',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
              >
                <input
                  type="radio"
                  name="shippingMethod"
                  value={m.id}
                  checked={selected}
                  onChange={() => onChange('shippingMethod', m.id)}
                  style={{ accentColor: 'var(--brand-saffron)', width: '16px', height: '16px', flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: selected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{m.label}</span>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: selected ? 'var(--brand-saffron)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {m.price === 0 ? 'Free' : `$${m.price.toFixed(2)}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.desc}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>·</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.note}</span>
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      </section>

      <button
        onClick={onNext}
        style={{
          background: 'var(--brand-saffron)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 28px',
          fontSize: '15px',
          fontWeight: 700,
          cursor: 'pointer',
          width: '100%',
          letterSpacing: '0.02em',
          boxShadow: '0 4px 16px rgba(249,115,22,0.30)',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-saffron-dk)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand-saffron)'; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        Continue to Payment →
      </button>
    </div>
  )
}

// ── Step 2: Payment ────────────────────────────────────────────────────────────
function PaymentStep({ data, onChange, errors, onNext, onBack }) {
  const [payMethod, setPayMethod] = useState('card')
  const cardType = detectCardType(data.cardNumber || '')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Payment method tabs */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {[
          { id: 'card', label: '💳 Card' },
          { id: 'paypal', label: '🅿 PayPal' },
          { id: 'apple', label: ' Apple Pay' },
          { id: 'google', label: '🟡 Google Pay' },
        ].map(pm => (
          <button
            key={pm.id}
            onClick={() => setPayMethod(pm.id)}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              border: `1.5px solid ${payMethod === pm.id ? 'var(--brand-saffron)' : 'var(--border-default)'}`,
              background: payMethod === pm.id ? 'rgba(249,115,22,0.10)' : 'var(--bg-raised)',
              color: payMethod === pm.id ? 'var(--brand-saffron)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: payMethod === pm.id ? 700 : 400,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {pm.label}
          </button>
        ))}
      </div>

      {payMethod === 'card' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label="Card number" error={errors.cardNumber}>
            <div style={{ position: 'relative' }}>
              <Input
                value={data.cardNumber || ''}
                onChange={e => onChange('cardNumber', formatCardNumber(e.target.value))}
                placeholder="1234 5678 9012 3456"
                error={errors.cardNumber}
                style={{ paddingRight: '48px' }}
              />
              {cardType && (
                <span style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '11px', fontWeight: 700, color: 'var(--brand-saffron)',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {cardType}
                </span>
              )}
            </div>
          </Field>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Field label="Expiry" error={errors.expiry} half>
              <Input
                value={data.expiry || ''}
                onChange={e => onChange('expiry', formatExpiry(e.target.value))}
                placeholder="MM/YY"
                error={errors.expiry}
              />
            </Field>
            <Field label="CVV" error={errors.cvv} half>
              <Input
                value={data.cvv || ''}
                onChange={e => onChange('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="•••"
                type="password"
                error={errors.cvv}
              />
            </Field>
          </div>
          <Field label="Name on card" error={errors.cardName}>
            <Input
              value={data.cardName || ''}
              onChange={e => onChange('cardName', e.target.value)}
              placeholder="Priya Sharma"
              error={errors.cardName}
            />
          </Field>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            background: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            256-bit SSL encryption · Powered by Stripe · PCI-DSS compliant
          </div>
        </div>
      )}

      {payMethod !== 'card' && (
        <div style={{
          padding: '40px 24px',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>
            {payMethod === 'paypal' ? '🅿' : payMethod === 'apple' ? '' : '🟡'}
          </div>
          You'll be redirected to complete payment after reviewing your order.
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{
            flex: '0 0 auto',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 20px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          ← Back
        </button>
        <button
          onClick={() => onNext(payMethod)}
          style={{
            flex: 1,
            background: 'var(--brand-saffron)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 28px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.02em',
            boxShadow: '0 4px 16px rgba(249,115,22,0.30)',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-saffron-dk)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand-saffron)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          Review Order →
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Review ─────────────────────────────────────────────────────────────
function ReviewStep({ shipping, payment, payMethod, items, totals, onPlace, onBack, placing }) {
  const shippingMethod = SHIPPING_METHODS.find(m => m.id === shipping.shippingMethod) || SHIPPING_METHODS[0]
  const isDDP = shipping.shippingMethod === 'ddp'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Address summary */}
      <div style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Ship to</span>
        </div>
        <div style={{ padding: '14px 18px', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600 }}>{shipping.fullName}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {[shipping.address, shipping.apt, shipping.city, shipping.state, shipping.zip, shipping.country].filter(Boolean).join(', ')}
          </div>
          <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '12px' }}>
            {shipping.email} · {shipping.phoneCode} {shipping.phone}
            {shipping.whatsapp && <span style={{ marginLeft: '6px', color: '#22C55E' }}>· WhatsApp updates ✓</span>}
          </div>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(249,115,22,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{shippingMethod.label} · {shippingMethod.desc}</span>
          <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--brand-saffron)' }}>
            {shippingMethod.price === 0 ? 'Free' : `$${shippingMethod.price.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Payment summary */}
      <div style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
          background: 'rgba(249,115,22,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', flexShrink: 0,
        }}>
          {payMethod === 'card' ? '💳' : payMethod === 'paypal' ? '🅿' : payMethod === 'apple' ? '' : '🟡'}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {payMethod === 'card'
              ? `•••• •••• •••• ${(payment.cardNumber || '').replace(/\s/g, '').slice(-4) || '????'}`
              : payMethod === 'paypal' ? 'PayPal'
              : payMethod === 'apple' ? 'Apple Pay'
              : 'Google Pay'}
          </div>
          {payMethod === 'card' && payment.cardName && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{payment.cardName}</div>
          )}
        </div>
      </div>

      {/* Items */}
      <div style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        {items.map(item => (
          <div key={item.id} style={{
            display: 'flex', gap: '14px', padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <img
              src={item.image}
              alt={item.name}
              style={{ width: '52px', height: '64px', objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
              onError={e => { e.target.src = `https://picsum.photos/seed/${item.id}/52/64` }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.seller?.name || item.city} · Qty {item.qty}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                ${((item.priceUSD || item.price / 84) * item.qty).toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 18px',
      }}>
        {[
          { label: 'Subtotal', val: `$${totals.baseUSD.toFixed(2)}` },
          totals.discountUSD > 0 && { label: 'Discount', val: `-$${totals.discountUSD.toFixed(2)}`, green: true },
          { label: `Shipping (${shippingMethod.label})`, val: totals.shippingUSD === 0 ? 'Free' : `$${totals.shippingUSD.toFixed(2)}` },
          totals.giftWrapUSD > 0 && { label: 'Gift wrap', val: `$${totals.giftWrapUSD.toFixed(2)}` },
          isDDP && { label: 'Duties & taxes (DDP)', val: 'Included', muted: true },
        ].filter(Boolean).map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: row.green ? '#22C55E' : row.muted ? 'var(--text-muted)' : 'var(--text-primary)' }}>{row.val}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border-default)', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
          <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--brand-saffron)' }}>${totals.finalUSD.toFixed(2)}</span>
        </div>
      </div>

      {/* DDP info */}
      {isDDP && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(249,115,22,0.06)',
          border: '1px solid rgba(249,115,22,0.18)',
          borderRadius: 'var(--radius-lg)',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 700, color: 'var(--brand-saffron)' }}>DDP — Delivered Duty Paid. </span>
          All customs duties, taxes, and import fees are included in your order total. No surprises at the door.
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{
            flex: '0 0 auto',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 20px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          onClick={onPlace}
          disabled={placing}
          style={{
            flex: 1,
            background: placing ? 'var(--bg-raised)' : 'var(--brand-saffron)',
            color: placing ? 'var(--text-muted)' : '#fff',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 28px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: placing ? 'default' : 'pointer',
            letterSpacing: '0.02em',
            boxShadow: placing ? 'none' : '0 4px 20px rgba(249,115,22,0.35)',
            transition: 'all 200ms ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          {placing ? (
            <>
              <span style={{
                width: '16px', height: '16px', borderRadius: '50%',
                border: '2px solid var(--border-subtle)',
                borderTop: '2px solid var(--brand-saffron)',
                display: 'inline-block',
                animation: 'spin 0.8s linear infinite',
              }} />
              Placing order...
            </>
          ) : '🔒 Place Order'}
        </button>
      </div>

      <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
        By placing your order you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}

// ── Mini cart summary (sidebar) ────────────────────────────────────────────────
function MiniCart({ items, totals, shippingMethodId }) {
  const shippingMethod = SHIPPING_METHODS.find(m => m.id === shippingMethodId) || SHIPPING_METHODS[0]
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      position: 'sticky',
      top: '80px',
    }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Order Summary
        </span>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={item.image}
                alt={item.name}
                style={{ width: '44px', height: '54px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                onError={e => { e.target.src = `https://picsum.photos/seed/${item.id}/44/54` }}
              />
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: 'var(--brand-saffron)', color: '#fff',
                fontSize: '10px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.qty}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.city}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
                ${((item.priceUSD || item.price / 84) * item.qty).toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { label: 'Subtotal', val: `$${totals.baseUSD.toFixed(2)}` },
          totals.discountUSD > 0 && { label: 'Discount', val: `-$${totals.discountUSD.toFixed(2)}`, green: true },
          { label: 'Shipping', val: totals.shippingUSD === 0 ? 'Free' : `$${(totals.shippingUSD + (SHIPPING_METHODS.find(m => m.id === shippingMethodId)?.price || 0)).toFixed(2)}` },
        ].filter(Boolean).map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: row.green ? '#22C55E' : 'var(--text-secondary)' }}>{row.val}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '4px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>Total</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--brand-saffron)' }}>${totals.finalUSD.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, totalUSD, clear } = useCart()
  const { success } = useToast()

  const [step, setStep] = useState(1)
  const [placing, setPlacing] = useState(false)
  const [payMethod, setPayMethod] = useState('card')

  // Shipping form state
  const [shipping, setShipping] = useState({
    email: '', phone: '', phoneCode: '+1', whatsapp: false,
    country: '', fullName: '', apt: '', address: '', city: '', state: '', zip: '',
    shippingMethod: 'standard',
  })
  const [shippingErrors, setShippingErrors] = useState({})

  // Payment form state
  const [payment, setPayment] = useState({
    cardNumber: '', expiry: '', cvv: '', cardName: '',
  })
  const [paymentErrors, setPaymentErrors] = useState({})

  // Computed totals — base from cart context
  const baseUSD = totalUSD || items.reduce((s, i) => s + (i.priceUSD || i.price / 84) * i.qty, 0)
  const discountUSD = 0 // discount already applied in cart
  const shippingMethodObj = SHIPPING_METHODS.find(m => m.id === shipping.shippingMethod) || SHIPPING_METHODS[0]
  const shippingUSD = baseUSD >= 75 && shippingMethodObj.id === 'standard' ? 0 : shippingMethodObj.price
  const finalUSD = +(baseUSD - discountUSD + shippingUSD).toFixed(2)

  const totals = { baseUSD: +baseUSD.toFixed(2), discountUSD, shippingUSD, giftWrapUSD: 0, finalUSD }

  // Redirect if cart is empty
  useEffect(() => {
    if (!items || items.length === 0) navigate('/cart')
  }, [items])

  function updateShipping(key, val) {
    setShipping(prev => ({ ...prev, [key]: val }))
    if (shippingErrors[key]) setShippingErrors(prev => ({ ...prev, [key]: '' }))
  }

  function updatePayment(key, val) {
    setPayment(prev => ({ ...prev, [key]: val }))
    if (paymentErrors[key]) setPaymentErrors(prev => ({ ...prev, [key]: '' }))
  }

  function validateShipping() {
    const errs = {}
    if (!shipping.email)         errs.email    = 'Email is required'
    if (!shipping.phone)         errs.phone    = 'Phone is required'
    if (!shipping.country)       errs.country  = 'Country is required'
    if (!shipping.fullName)      errs.fullName = 'Name is required'
    if (!shipping.address)       errs.address  = 'Address is required'
    if (!shipping.city)          errs.city     = 'City is required'
    if (!shipping.state)         errs.state    = 'State is required'
    if (!shipping.zip)           errs.zip      = 'ZIP is required'
    setShippingErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validatePayment() {
    if (payMethod !== 'card') return true
    const errs = {}
    const digits = (payment.cardNumber || '').replace(/\s/g, '')
    if (digits.length < 13)          errs.cardNumber = 'Invalid card number'
    if (!(payment.expiry || '').match(/^\d{2}\/\d{2}$/)) errs.expiry = 'Invalid expiry (MM/YY)'
    if ((payment.cvv || '').length < 3) errs.cvv    = 'Invalid CVV'
    if (!payment.cardName)           errs.cardName   = 'Name on card is required'
    setPaymentErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleShippingNext() {
    if (validateShipping()) setStep(2)
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handlePaymentNext(pm) {
    setPayMethod(pm)
    if (validatePayment()) setStep(3)
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handlePlaceOrder() {
    setPlacing(true)
    setTimeout(() => {
      clear()
      success('Order placed! 🎉')
      const orderId = 'HT-' + Math.floor(100000 + Math.random() * 900000)
      navigate('/confirmed', {
        state: {
          orderId,
          items,
          totals,
          shipping,
          shippingMethod: shippingMethodObj,
          payMethod,
          estimatedDelivery: getEstimatedDelivery(shippingMethodObj.id),
        }
      })
    }, 2000)
  }

  function getEstimatedDelivery(methodId) {
    const now = new Date()
    const [minDays, maxDays] = methodId === 'express' ? [5,7] : methodId === 'ddp' ? [7,10] : [10,14]
    const minDate = new Date(now.setDate(now.getDate() + minDays))
    const maxDate = new Date(new Date().setDate(new Date().getDate() + maxDays))
    return `${minDate.toLocaleDateString('en-US', { month:'short', day:'numeric' })} – ${maxDate.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}`
  }

  return (
    <>
      {/* ── Distraction-free nav ────────────────────────── */}
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
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 200,
      }}>
        {/* Logo left */}
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>haat.</span>
        </a>
        {/* Center */}
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
          🔒 Secure Checkout
        </span>
        {/* Right — empty but with a cart link */}
        <a href="/cart" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← Cart
        </a>
      </div>

      {/* ── Page wrapper ───────────────────────────────── */}
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        paddingTop: '60px',
      }}>
        {/* Step bar */}
        <StepBar step={step} />

        {/* Two-column layout */}
        <div style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '32px 24px 80px',
          display: 'flex',
          gap: '40px',
          alignItems: 'flex-start',
        }}>
          {/* Main form column */}
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            {step === 1 && (
              <ShippingStep
                data={shipping}
                onChange={updateShipping}
                errors={shippingErrors}
                onNext={handleShippingNext}
              />
            )}
            {step === 2 && (
              <PaymentStep
                data={payment}
                onChange={updatePayment}
                errors={paymentErrors}
                onNext={handlePaymentNext}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <ReviewStep
                shipping={shipping}
                payment={payment}
                payMethod={payMethod}
                items={items}
                totals={totals}
                onPlace={handlePlaceOrder}
                onBack={() => setStep(2)}
                placing={placing}
              />
            )}
          </div>

          {/* Sticky summary sidebar */}
          <div style={{ flex: '0 0 300px', minWidth: '260px' }}>
            <MiniCart items={items} totals={totals} shippingMethodId={shipping.shippingMethod} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 700px) {
          /* Hide sidebar on mobile */
          .checkout-sidebar { display: none !important; }
        }
      `}</style>
    </>
  )
}
