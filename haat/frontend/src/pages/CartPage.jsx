import { Link } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { inr } from '../lib/shop'

/* Digital goods have no quantity — you own a licence or you don't — so the
   cart is a list with one action per line, not a spreadsheet with steppers. */

export default function CartPage() {
  const { items, remove, clear } = useCart()
  const total = items.reduce((s, i) => s + i.price, 0)

  if (!items.length) {
    return (
      <div className="h-wrap h-page" style={{ maxWidth: 560 }}>
        <p className="h-eyebrow" style={{ marginBottom: 14 }}>Cart</p>
        <h1 className="h-title" style={{ marginBottom: 16 }}>Nothing here yet</h1>
        <p className="h-body h-muted" style={{ marginBottom: 26 }}>
          Sixteen things made by people who normally work in cloth, pigment and thread.
        </p>
        <Link to="/catalogue" className="h-btn">Browse the catalogue</Link>
      </div>
    )
  }

  return (
    <div className="h-wrap h-page" style={{ maxWidth: 820 }}>
      <div className="h-section-head">
        <div>
          <p className="h-eyebrow" style={{ marginBottom: 10 }}>Cart</p>
          <h1 className="h-title">{items.length} item{items.length === 1 ? '' : 's'}</h1>
        </div>
        <button className="h-btn h-btn-quiet" onClick={clear}>Empty cart</button>
      </div>

      <div style={{ marginBottom: 30 }}>
        {items.map(i => (
          <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: 16, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--rule)' }}>
            <Link to={`/product/${i.id}`}>
              <img src={i.image} alt="" style={{ width: 72, height: 72, objectFit: 'cover', border: '1px solid var(--rule)' }} />
            </Link>
            <div style={{ minWidth: 0 }}>
              <Link to={`/product/${i.id}`}>
                <h2 style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.35 }}>{i.name}</h2>
              </Link>
              <p className="h-data h-faint" style={{ fontSize: 11, marginTop: 4 }}>
                {i.seller} · {i.subcategory}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="h-data" style={{ color: 'var(--brass)', fontSize: 15 }}>{inr(i.price)}</div>
              <button onClick={() => remove(i.id)} className="h-data h-faint"
                style={{ fontSize: 11, marginTop: 5, textDecoration: 'underline' }}>
                remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <span className="h-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Total</span>
          <span className="h-title" style={{ fontSize: 30, color: 'var(--brass)' }}>{inr(total)}</span>
        </div>
        <Link to="/checkout" className="h-btn">Checkout</Link>
      </div>
    </div>
  )
}
