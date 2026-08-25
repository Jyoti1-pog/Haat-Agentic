import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as shop from '../lib/shop'
import { inr } from '../lib/shop'

/* ═══════════════════════════════════════════════════════════════════════════
   The approval gate, from the human side.

   An agent that hits the per-transaction cap is told to get approval, and
   deliberately has no tool to grant it — an agent that could approve its own
   over-cap spending would make the gate decoration. That left the person it
   was asking with nowhere to go, which made the gate a dead end rather than a
   control. This is where the agent sends them.

   One approval, one product, one price. It does not raise the cap, does not
   persist beyond this purchase, and does not apply to anything else the agent
   might want next.
   ═══════════════════════════════════════════════════════════════════════════ */

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

export default function ApprovalPage() {
  const [params] = useSearchParams()
  const session = params.get('session') ?? ''
  const productId = params.get('product') ?? ''

  const [product, setProduct] = useState(null)
  const [phase, setPhase] = useState('loading')   // loading | ready | working | done | declined | error
  const [error, setError] = useState('')

  useEffect(() => {
    if (!productId) { setPhase('error'); setError('This link is missing the product it refers to.'); return }
    shop.getProduct(productId)
      .then(p => {
        if (!p?.id) throw new Error('That product is no longer listed.')
        setProduct(p)
        setPhase('ready')
      })
      .catch(err => { setPhase('error'); setError(err.message) })
  }, [productId])

  async function decide(approved) {
    setPhase('working')
    try {
      const res = await fetch(`${API}/agent-commerce/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          agent_session_id: session,
          approved,
          approved_by: 'human-via-approval-link',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? json.reason ?? `Request failed (${res.status})`)
      setPhase(approved ? 'done' : 'declined')
    } catch (err) {
      setPhase('error')
      setError(err.message)
    }
  }

  // ── States ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return <Wrap><p className="h-body h-muted">Looking up what you are being asked to approve…</p></Wrap>
  }

  if (phase === 'error') {
    return (
      <Wrap>
        <p className="h-eyebrow" style={{ marginBottom: 14 }}>Approval</p>
        <h1 className="h-title" style={{ marginBottom: 16 }}>This link did not work.</h1>
        <p className="h-body h-muted" style={{ marginBottom: 26 }}>{error} Nothing was approved and nothing was charged.</p>
        <Link to="/catalogue" className="h-btn h-btn-ghost">Browse the catalogue</Link>
      </Wrap>
    )
  }

  if (phase === 'done' || phase === 'declined') {
    const approved = phase === 'done'
    return (
      <Wrap>
        <p className="h-eyebrow" style={{ marginBottom: 14 }}>{approved ? 'Approved' : 'Declined'}</p>
        <h1 className="h-title" style={{ marginBottom: 16 }}>
          {approved ? 'Your agent can buy this.' : 'Your agent cannot buy this.'}
        </h1>
        <p className="h-body h-muted" style={{ marginBottom: 12, maxWidth: '58ch' }}>
          {approved
            ? <>Approval covers <strong style={{ color: 'var(--parchment)', fontWeight: 400 }}>{product.name}</strong> at {inr(product.price)}, once.
                Go back to your agent and tell it to try again — it does not know yet.</>
            : <>Nothing was charged. Tell your agent it was declined so it stops waiting.</>}
        </p>
        {approved && (
          <p className="h-data h-faint" style={{ marginBottom: 30, lineHeight: 1.7 }}>
            This does not raise the spend cap and does not carry over. Anything else above the
            cap will come back here.
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/ops" className="h-btn h-btn-ghost">See the audit trail</Link>
          <Link to="/catalogue" className="h-btn h-btn-ghost">Browse</Link>
        </div>
      </Wrap>
    )
  }

  // ── The decision ─────────────────────────────────────────────────────────
  return (
    <Wrap>
      <p className="h-eyebrow" style={{ marginBottom: 14 }}>Approval needed</p>
      <h1 className="h-title" style={{ marginBottom: 16, maxWidth: '18ch' }}>
        Your agent wants to buy this.
      </h1>
      <p className="h-body h-muted" style={{ marginBottom: 30, maxWidth: '58ch' }}>
        It costs more than the per-purchase limit it is allowed to spend on its own, so it
        stopped and asked. Nothing has been charged and no order exists yet.
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: 16, alignItems: 'center',
        padding: '18px 20px', border: '1px solid var(--rule)', background: 'var(--ink-raised)',
        marginBottom: 26,
      }}>
        <img src={product.image} alt="" style={{ width: 72, height: 72, objectFit: 'cover', border: '1px solid var(--rule)' }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15.5, lineHeight: 1.35, marginBottom: 4 }}>{product.name}</p>
          <p className="h-data h-faint" style={{ fontSize: 11.5 }}>{product.seller}</p>
        </div>
        <div className="h-title" style={{ fontSize: 25, color: 'var(--brass)' }}>{inr(product.price)}</div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <button className="h-btn" onClick={() => decide(true)} disabled={phase === 'working'}>
          {phase === 'working' ? 'One moment…' : `Approve ${inr(product.price)}`}
        </button>
        <button className="h-btn h-btn-ghost" onClick={() => decide(false)} disabled={phase === 'working'}>
          Decline
        </button>
      </div>

      <p className="h-data h-faint" style={{ lineHeight: 1.8, maxWidth: '58ch' }}>
        Approving covers this one product at this one price. It does not raise the spend cap,
        does not carry over to anything else, and is written to the audit trail either way.
      </p>
    </Wrap>
  )
}

function Wrap({ children }) {
  return <div className="h-wrap h-page" style={{ maxWidth: 660 }}>{children}</div>
}
