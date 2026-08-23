import { Link } from 'react-router-dom'
import { inr } from '../lib/shop'

/* ═══════════════════════════════════════════════════════════════════════════
   One product, on a plate.

   The AI-buyer badge is not decoration: it is the seller's agent-checkout
   toggle, surfaced. A shopper seeing it knows this SKU is one an agent may
   transact on; its absence means the seller kept it to people.
   ═══════════════════════════════════════════════════════════════════════════ */

const KIND_LABEL = { file: 'Download', code: 'Licence key', link: 'Access link' }

export default function ProductCard({ product, style }) {
  const id = product.product_id ?? product.id
  const stock = product.remaining_stock
  const soldOut = stock === 0

  return (
    <article className="h-card" style={style}>
      <Link to={`/product/${id}`} className="h-card-plate" aria-label={product.name}>
        <img src={product.image} alt="" loading="lazy" />

        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
          {product.agent_checkout_enabled && <span className="h-tag h-tag-brass">AI-buyer ready</span>}
          {product.seller_verified === false && <span className="h-tag h-tag-ember">Unverified seller</span>}
          {soldOut && <span className="h-tag h-tag-muted">Sold out</span>}
        </div>

        {/* Top-right: the cover art carries its own label along the bottom edge,
            and a badge down there collides with it. */}
        <span className="h-data" style={{
          position: 'absolute', top: 10, right: 10, padding: '3px 7px',
          background: 'rgba(10,8,6,0.82)', color: 'var(--muted)', fontSize: 10,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {KIND_LABEL[product.digital_deliverable_type] ?? 'Digital'}
        </span>
      </Link>

      <div className="h-card-body">
        <Link to={`/product/${id}`}>
          <h3 style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.35, letterSpacing: '-0.005em' }}>
            {product.name}
          </h3>
        </Link>

        <p className="h-data h-faint" style={{ fontSize: 11 }}>
          {product.seller} · {product.city}
        </p>

        <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, borderTop: '1px solid var(--rule)' }}>
          <span className="h-data" style={{ color: 'var(--brass)', fontSize: 15 }}>{inr(product.price)}</span>
          {stock != null && !soldOut && (
            <span className="h-data h-faint" style={{ fontSize: 10.5 }}>{stock} left</span>
          )}
        </div>
      </div>
    </article>
  )
}
