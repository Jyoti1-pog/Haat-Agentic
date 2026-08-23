import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as shop from '../lib/shop'
import { inr } from '../lib/shop'
import { useCart } from '../contexts/CartContext'
import { useBuyer } from '../contexts/BuyerContext'

/* ═══════════════════════════════════════════════════════════════════════════
   One product.

   Two paths off this page and both are real: add it to the cart, or buy it
   outright. "Buy now" goes straight to checkout with this one item rather than
   silently filling the cart — a digital good is usually an impulse of one.
   ═══════════════════════════════════════════════════════════════════════════ */

const DELIVERY = {
  file: ['Instant download', 'A signed link, yours alone, valid for 48 hours. Re-open this page any time for a fresh one.'],
  code: ['Licence key', 'A key from the seller’s pool, issued to you and burned so nobody else receives it.'],
  link: ['Access link', 'A link the seller hosts. haat hands it over on payment and does not expire it.'],
}

export default function ProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { add, items } = useCart()
  const { buyer } = useBuyer()

  const [product, setProduct] = useState(null)
  const [owned, setOwned] = useState(null)
  const [state, setState] = useState('loading')   // loading | ready | missing

  useEffect(() => {
    setState('loading')
    shop.getProduct(id)
      .then(p => { if (p?.id) { setProduct(p); setState('ready') } else setState('missing') })
      .catch(() => setState('missing'))
  }, [id])

  // Already in the library? Say so rather than selling it again.
  useEffect(() => {
    if (!buyer) return setOwned(null)
    shop.getLibrary(buyer)
      .then(l => setOwned(l.items?.find(i => i.product_id === id) ?? null))
      .catch(() => {})
  }, [buyer, id])

  if (state === 'loading') {
    return <div className="h-wrap h-page"><p className="h-data h-faint">loading…</p></div>
  }

  if (state === 'missing') {
    return (
      <div className="h-wrap h-page">
        <h1 className="h-title" style={{ marginBottom: 16 }}>No such product</h1>
        <Link to="/catalogue" className="h-btn h-btn-ghost">Back to the catalogue</Link>
      </div>
    )
  }

  const inCart  = items.some(i => i.id === product.id)
  const stock   = product.remaining_stock
  const soldOut = stock === 0
  const [deliveryTitle, deliveryBody] = DELIVERY[product.digital_deliverable_type] ?? DELIVERY.file

  return (
    <div className="h-wrap h-page">
      <Link to="/catalogue" className="h-data" style={{ color: 'var(--muted)', display: 'inline-block', marginBottom: 26 }}>
        ← catalogue
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'clamp(28px, 5vw, 68px)', alignItems: 'start' }}>
        {/* ── Plate ──────────────────────────────────────────────────────── */}
        <div className="h-rise" style={{ border: '1px solid var(--rule)', background: 'var(--ink-sunken)' }}>
          <img src={product.image} alt={product.name} style={{ width: '100%', aspectRatio: 1, objectFit: 'cover' }} />
        </div>

        {/* ── Detail ─────────────────────────────────────────────────────── */}
        <div className="h-rise" style={{ animationDelay: '80ms' }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 18 }}>
            {product.agent_checkout_enabled
              ? <span className="h-tag h-tag-brass">AI-buyer ready</span>
              : <span className="h-tag h-tag-muted">Humans only</span>}
            {product.seller_verified
              ? <span className="h-tag h-tag-sage">haat verified seller</span>
              : <span className="h-tag h-tag-ember">Seller not verified</span>}
            <span className="h-tag h-tag-muted">{product.subcategory}</span>
          </div>

          <h1 className="h-title" style={{ marginBottom: 16 }}>{product.name}</h1>

          <p className="h-body h-muted" style={{ marginBottom: 26, maxWidth: '52ch' }}>
            {product.description}
          </p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 26 }}>
            <span className="h-title" style={{ fontSize: 34, color: 'var(--brass)' }}>{inr(product.price)}</span>
            <span className="h-data h-faint">≈ ${product.priceUSD}</span>
          </div>

          {/* ── Buy ──────────────────────────────────────────────────────── */}
          {owned ? (
            <div className="h-notice h-notice-ok" style={{ marginBottom: 24 }}>
              <p className="h-body" style={{ fontSize: 14, marginBottom: 10 }}>
                You already own this — bought {owned.channel === 'agent' ? 'by your agent' : 'by you'}.
              </p>
              <Link to="/library" className="h-btn h-btn-quiet">Open in your library</Link>
            </div>
          ) : soldOut ? (
            <div className="h-notice h-notice-warn" style={{ marginBottom: 24 }}>
              <p className="h-body" style={{ fontSize: 14 }}>
                Sold out — the seller&rsquo;s licence pool is empty. haat refuses the sale rather than
                taking money for something it cannot deliver.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 26 }}>
              <button className="h-btn" onClick={() => navigate(`/checkout?buy=${product.id}`)}>
                Buy now
              </button>
              <button
                className="h-btn h-btn-ghost"
                disabled={inCart}
                onClick={() => add({ ...product, image: product.image })}
              >
                {inCart ? 'In your cart' : 'Add to cart'}
              </button>
            </div>
          )}

          {/* ── Facts ────────────────────────────────────────────────────── */}
          <dl style={{ borderTop: '1px solid var(--rule)' }}>
            {[
              [deliveryTitle, deliveryBody],
              ['Licence', product.license ?? '—'],
              ['Made in', [product.city, product.state].filter(Boolean).join(', ')],
              ['Seller', product.seller],
              ...(product.file_size ? [['Size', product.file_size]] : []),
              ...(stock != null ? [['Remaining', `${stock} licence${stock === 1 ? '' : 's'} in the pool`]] : []),
              ...(product.max_purchases === 1 ? [['Single seat', 'One per buyer. Buying it twice returns the copy you already own.']] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '116px 1fr', gap: 16, padding: '13px 0', borderBottom: '1px solid var(--rule)' }}>
                <dt className="h-data" style={{ color: 'var(--brass)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{k}</dt>
                <dd className="h-body h-muted" style={{ fontSize: 14 }}>{v}</dd>
              </div>
            ))}
          </dl>

          {product.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 22 }}>
              {product.tags.map(t => (
                <Link key={t} to={`/catalogue?q=${encodeURIComponent(t)}`} className="h-data h-faint"
                  style={{ padding: '4px 9px', border: '1px solid var(--rule)', fontSize: 11 }}>
                  {t}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
