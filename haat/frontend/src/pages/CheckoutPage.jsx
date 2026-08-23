import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import * as shop from '../lib/shop'
import { inr } from '../lib/shop'
import { useCart } from '../contexts/CartContext'
import { useBuyer } from '../contexts/BuyerContext'

/* ═══════════════════════════════════════════════════════════════════════════
   Checkout.

   This is a real transaction, not a form that pretends. Each line creates a
   Razorpay order, authorises it, verifies the signature server-side, and is
   delivered — the identical path an agent takes, because it is literally the
   same service functions behind /api/shop.

   There are no card fields. With Razorpay keys configured the card step belongs
   in their hosted checkout, and without them nothing here should imply a card
   was taken. The page says which mode it is in rather than dressing up either.
   ═══════════════════════════════════════════════════════════════════════════ */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function CheckoutPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { items, remove, clear } = useCart()
  const { buyer, setBuyer } = useBuyer()

  const buyNowId = params.get('buy')
  const [direct, setDirect] = useState(null)
  const [email, setEmail] = useState(buyer)
  const [phase, setPhase] = useState('idle')      // idle | working | done
  const [results, setResults] = useState([])
  const [mode, setMode] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!buyNowId) return
    shop.getProduct(buyNowId).then(p => p?.id && setDirect(p)).catch(() => {})
  }, [buyNowId])

  const lines = useMemo(
    () => (direct ? [direct] : items),
    [direct, items],
  )

  const total = lines.reduce((s, l) => s + l.price, 0)
  const valid = EMAIL.test(email.trim())

  async function pay() {
    if (!valid || !lines.length) return
    setPhase('working'); setError(''); setResults([])
    setBuyer(email)

    const out = []
    try {
      // One order per line. A failure on line three must not undo lines one and
      // two — each is its own order, and each result says what happened to it.
      for (const line of lines) {
        const r = await shop.purchase(line.id, email.trim().toLowerCase())
        out.push({ line, result: r })
        setResults([...out])
        if (r.razorpay_mode) setMode(r.razorpay_mode)
      }
      if (!direct) clear()
      setPhase('done')
    } catch (err) {
      setError(err.message)
      setPhase('idle')
    }
  }

  // ── Receipt ──────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const delivered = results.filter(r => r.result.status === 'delivered')
    return (
      <div className="h-wrap h-page" style={{ maxWidth: 760 }}>
        <p className="h-eyebrow" style={{ marginBottom: 14 }}>Paid · delivered</p>
        <h1 className="h-title" style={{ marginBottom: 14 }}>
          {delivered.length === results.length
            ? 'Everything arrived.'
            : `${delivered.length} of ${results.length} arrived.`}
        </h1>
        <p className="h-body h-muted" style={{ marginBottom: 32 }}>
          Sent to <span style={{ color: 'var(--parchment)' }}>{email}</span>. It is in your library
          permanently — download links are re-minted fresh every time you open it.
        </p>

        <div style={{ display: 'grid', gap: 14, marginBottom: 32 }}>
          {results.map(({ line, result }) => (
            <Receipt key={line.id} line={line} result={result} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/library" className="h-btn">Open your library</Link>
          <Link to="/catalogue" className="h-btn h-btn-ghost">Keep browsing</Link>
        </div>
      </div>
    )
  }

  // ── Empty ────────────────────────────────────────────────────────────────
  if (!lines.length) {
    return (
      <div className="h-wrap h-page" style={{ maxWidth: 620 }}>
        <h1 className="h-title" style={{ marginBottom: 16 }}>Nothing to pay for</h1>
        <p className="h-body h-muted" style={{ marginBottom: 26 }}>Your cart is empty.</p>
        <Link to="/catalogue" className="h-btn">Browse the catalogue</Link>
      </div>
    )
  }

  // ── Checkout ─────────────────────────────────────────────────────────────
  return (
    <div className="h-wrap h-page" style={{ maxWidth: 860 }}>
      <p className="h-eyebrow" style={{ marginBottom: 14 }}>Checkout</p>
      <h1 className="h-title" style={{ marginBottom: 34 }}>
        {lines.length === 1 ? 'One item' : `${lines.length} items`}, delivered instantly.
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 'clamp(26px, 4vw, 52px)', alignItems: 'start' }}>
        {/* ── Lines ────────────────────────────────────────────────────── */}
        <div>
          <div className="h-section-head"><h2 className="h-eyebrow">Your order</h2></div>
          {lines.map(l => (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--rule)' }}>
              <img src={l.image} alt="" style={{ width: 56, height: 56, objectFit: 'cover', border: '1px solid var(--rule)' }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, lineHeight: 1.35 }}>{l.name}</p>
                <p className="h-data h-faint" style={{ fontSize: 11, marginTop: 3 }}>{l.seller}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="h-data" style={{ color: 'var(--brass)' }}>{inr(l.price)}</div>
                {!direct && (
                  <button onClick={() => remove(l.id)} className="h-data h-faint"
                    style={{ fontSize: 11, marginTop: 4, textDecoration: 'underline' }}>
                    remove
                  </button>
                )}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16 }}>
            <span className="h-eyebrow">Total</span>
            <span className="h-title" style={{ fontSize: 26, color: 'var(--brass)' }}>{inr(total)}</span>
          </div>
        </div>

        {/* ── Pay ──────────────────────────────────────────────────────── */}
        <div>
          <div className="h-section-head"><h2 className="h-eyebrow">Where it goes</h2></div>

          <label style={{ display: 'block', marginBottom: 22 }}>
            <span className="h-body" style={{ display: 'block', fontSize: 14, marginBottom: 8 }}>
              Email address
            </span>
            <input
              className="h-input" type="email" value={email} autoComplete="email"
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={phase === 'working'}
            />
            <span className="h-data h-faint" style={{ display: 'block', marginTop: 7, lineHeight: 1.6 }}>
              Your library is keyed to this address. An agent buying for you uses the same one,
              so everything lands in one place.
            </span>
          </label>

          {error && <div className="h-notice h-notice-error" style={{ marginBottom: 18 }}>
            <p className="h-body" style={{ fontSize: 14 }}>{error}</p>
          </div>}

          <button className="h-btn" onClick={pay} disabled={!valid || phase === 'working'} style={{ width: '100%' }}>
            {phase === 'working' ? 'Processing…' : `Pay ${inr(total)}`}
          </button>

          {phase === 'working' && results.length > 0 && (
            <p className="h-data h-faint" style={{ marginTop: 12 }}>
              {results.length} of {lines.length} settled…
            </p>
          )}

          <p className="h-data h-faint" style={{ marginTop: 18, lineHeight: 1.7 }}>
            A real Razorpay order is created for every line, and the payment signature is verified
            server-side before anything is delivered.
            {mode === 'unconfigured' && ' This deployment has no Razorpay keys, so the card step is stood in for — every order is stamped “unconfigured” in the ledger.'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── A single delivered line ──────────────────────────────────────────────────
function Receipt({ line, result }) {
  const d = result.deliverable
  const failed = result.status !== 'delivered'

  return (
    <div className={`h-notice ${failed ? 'h-notice-error' : 'h-notice-ok'}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 8 }}>
        <strong style={{ fontSize: 14, fontWeight: 500 }}>{line.name}</strong>
        <span className="h-data h-muted">{result.amount ?? inr(line.price)}</span>
      </div>

      {failed ? (
        <p className="h-body" style={{ fontSize: 13.5, color: 'var(--ember)' }}>
          {result.reason ?? 'This line did not go through. Nothing was charged for it.'}
        </p>
      ) : d?.kind === 'code' ? (
        <>
          <p className="h-eyebrow" style={{ fontSize: 10, marginBottom: 5 }}>Licence key</p>
          <code className="h-data" style={{ fontSize: 15, color: 'var(--brass)', letterSpacing: '0.05em' }}>{d.unlock_code}</code>
        </>
      ) : d?.kind === 'link' ? (
        <a href={d.access_url} target="_blank" rel="noreferrer" className="h-data" style={{ color: 'var(--brass)', textDecoration: 'underline' }}>
          {d.access_url}
        </a>
      ) : d ? (
        <>
          <a href={d.download_url} className="h-data" style={{ color: 'var(--brass)', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {d.filename}
          </a>
          <p className="h-data h-faint" style={{ marginTop: 5 }}>
            signed link · expires {new Date(d.expires_at).toLocaleString()}
          </p>
        </>
      ) : null}

      {!failed && <p className="h-sign" style={{ marginTop: 10, fontSize: 14 }}>verified by haat</p>}
    </div>
  )
}
