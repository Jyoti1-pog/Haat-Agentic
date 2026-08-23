import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as shop from '../lib/shop'
import { useBuyer } from '../contexts/BuyerContext'

/* ═══════════════════════════════════════════════════════════════════════════
   The library — everything this buyer owns.

   Signed download links are re-minted on every load rather than stored, so a
   buyer coming back on day three gets a working link instead of a dead one.
   Purchases an agent made on their behalf land here too, marked as such: the
   whole point of keying entitlements to a buyer rather than a session.
   ═══════════════════════════════════════════════════════════════════════════ */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LibraryPage() {
  const { buyer, setBuyer } = useBuyer()
  const [draft, setDraft] = useState(buyer)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(Boolean(buyer))

  const load = useCallback(ref => {
    if (!ref) return
    setLoading(true)
    shop.getLibrary(ref)
      .then(d => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(buyer) }, [buyer, load])

  // ── Not identified yet ───────────────────────────────────────────────────
  if (!buyer) {
    return (
      <div className="h-wrap h-page" style={{ maxWidth: 560 }}>
        <p className="h-eyebrow" style={{ marginBottom: 14 }}>Library</p>
        <h1 className="h-title" style={{ marginBottom: 16 }}>What have you bought?</h1>
        <p className="h-body h-muted" style={{ marginBottom: 26 }}>
          Your library is keyed to an email address, not a login. Enter the one you bought with —
          or the one your agent buys on your behalf.
        </p>
        <form onSubmit={e => { e.preventDefault(); if (EMAIL.test(draft.trim())) setBuyer(draft) }}>
          <input className="h-input" type="email" value={draft} onChange={e => setDraft(e.target.value)}
            placeholder="you@example.com" aria-label="Email address" style={{ marginBottom: 14 }} />
          <button className="h-btn" disabled={!EMAIL.test(draft.trim())}>Open library</button>
        </form>
      </div>
    )
  }

  return (
    <div className="h-wrap h-page">
      <div className="h-section-head">
        <div>
          <p className="h-eyebrow" style={{ marginBottom: 10 }}>Library</p>
          <h1 className="h-title">{buyer}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="h-btn h-btn-quiet" onClick={() => load(buyer)}>Refresh links</button>
          <button className="h-btn h-btn-quiet" onClick={() => { setBuyer(''); setDraft(''); setItems([]) }}>
            Switch
          </button>
        </div>
      </div>

      {loading ? (
        <p className="h-data h-faint">loading…</p>
      ) : items.length === 0 ? (
        <div style={{ padding: '56px 0' }}>
          <p className="h-body h-muted" style={{ marginBottom: 20 }}>
            Nothing bought with this address yet.
          </p>
          <Link to="/catalogue" className="h-btn">Browse the catalogue</Link>
        </div>
      ) : (
        <>
          <p className="h-data h-faint" style={{ marginBottom: 24 }}>
            {items.length} item{items.length === 1 ? '' : 's'} · links re-minted just now
          </p>

          <div style={{ display: 'grid', gap: 14 }}>
            {items.map((it, i) => <Item key={it.entitlement_id} item={it} style={{ '--i': Math.min(i, 10) }} />)}
          </div>
        </>
      )}
    </div>
  )
}

function Item({ item, style }) {
  const d = item.deliverable
  return (
    <article className="h-rise" style={{ ...style, border: '1px solid var(--rule)', background: 'var(--ink-raised)', padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <Link to={`/product/${item.product_id}`}>
            <h2 className="h-sub" style={{ fontSize: 19, marginBottom: 6 }}>{item.product_name}</h2>
          </Link>
          <p className="h-data h-faint">
            {new Date(item.purchased_at).toLocaleDateString()} · {item.amount} · bought by{' '}
            <span style={{ color: item.channel === 'agent' ? 'var(--brass)' : 'var(--muted)' }}>{item.channel}</span>
          </p>
        </div>
        <span className={`h-tag ${item.channel === 'agent' ? 'h-tag-brass' : 'h-tag-muted'}`}>
          {item.channel === 'agent' ? 'Agent purchase' : 'Your purchase'}
        </span>
      </div>

      <div style={{ paddingTop: 12, borderTop: '1px solid var(--rule)' }}>
        {d?.kind === 'code' ? (
          <>
            <p className="h-eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Licence key</p>
            <code className="h-data" style={{ fontSize: 15, color: 'var(--brass)', letterSpacing: '0.05em' }}>{d.unlock_code}</code>
          </>
        ) : d?.kind === 'link' ? (
          <>
            <p className="h-eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Access</p>
            <a href={d.access_url} target="_blank" rel="noreferrer" className="h-data" style={{ color: 'var(--brass)', textDecoration: 'underline' }}>
              {d.access_url}
            </a>
          </>
        ) : d ? (
          <>
            <p className="h-eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Download</p>
            <a href={d.download_url} className="h-data" style={{ color: 'var(--brass)', textDecoration: 'underline', wordBreak: 'break-all' }}>
              {d.filename}
            </a>
            <p className="h-data h-faint" style={{ marginTop: 5 }}>
              expires {new Date(d.expires_at).toLocaleString()}
            </p>
          </>
        ) : null}
      </div>
    </article>
  )
}
