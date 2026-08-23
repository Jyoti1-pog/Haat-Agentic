import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import '../styles/ledger.css'
import * as api from '../lib/agentCommerce'

/* ═══════════════════════════════════════════════════════════════════════════
   AGENT CHECKOUT — the bahi-khata

   The page an AI buyer transacts through, and the ledger that records it.

   Everything shown on the right is read back from the server's audit trail,
   not from anything this component did. That matters: the same feed renders
   whether the actions came from the scripted run, from Claude driving the
   tools, from an MCP client in another process, or from a judge with curl.
   The UI cannot show a decision the server did not actually make.
   ═══════════════════════════════════════════════════════════════════════ */

const SESSION_KEY = 'haat.agent.session'
const SEAL_KEY    = 'haat.agent.seal'

function useSession() {
  return useMemo(() => {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = `web-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  }, [])
}

// ── How each recorded action is stamped ──────────────────────────────────────
const STAMPS = {
  search:             { label: 'searched',   tone: 'note' },
  quote:              { label: 'quoted',     tone: 'note' },
  order_attempt:      { label: 'order',      tone: 'ok' },
  gate_triggered:     { label: 'gated',      tone: 'gated' },
  blocked:            { label: 'blocked',    tone: 'blocked' },
  approved:           { label: 'approved',   tone: 'ok' },
  approval_declined:  { label: 'declined',   tone: 'blocked' },
  payment_authorised: { label: 'authorised', tone: 'note' },
  payment_confirmed:  { label: 'paid',       tone: 'ok' },
  payment_failed:     { label: 'failed',     tone: 'blocked' },
  delivered:          { label: 'delivered',  tone: 'ok' },
  delivery_failed:    { label: 'undelivered', tone: 'blocked' },
  entitlement_reused: { label: 'reused',     tone: 'note' },
  asset_downloaded:   { label: 'downloaded', tone: 'note' },
  agent_prompt:       { label: 'asked',      tone: 'note' },
  agent_reply:        { label: 'replied',    tone: 'note' },
  agent_error:        { label: 'error',      tone: 'blocked' },
}

const toneClass = tone =>
  tone === 'ok' ? 'stamp-ok' : tone === 'blocked' || tone === 'gated' ? 'stamp-blocked' : 'stamp-note'

const clockOf = iso => new Date(iso).toTimeString().slice(0, 8)

// ── The wax seal ─────────────────────────────────────────────────────────────
// A drawn monogram rather than a stock icon: concentric rules, twelve notches,
// and the trader's mark at the centre.
function Seal({ size = 88 }) {
  const notches = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    return (
      <line
        key={i}
        x1={50 + Math.cos(a) * 38} y1={50 + Math.sin(a) * 38}
        x2={50 + Math.cos(a) * 45} y2={50 + Math.sin(a) * 45}
        stroke="#B8935A" strokeWidth="2" strokeLinecap="round"
      />
    )
  })
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="36" fill="none" stroke="#B8935A" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#B8935A" strokeWidth="0.75" opacity="0.6" />
      {notches}
      <path d="M40 62 V38 M40 50 h20 M60 62 V44" fill="none" stroke="#B8935A" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#B8935A" strokeWidth="0.5" opacity="0.35" />
    </svg>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AgentCheckoutPage() {
  const sessionId = useSession()
  const buyerRef  = `${sessionId}@agent.haat`

  const [showSeal, setShowSeal]   = useState(() => !sessionStorage.getItem(SEAL_KEY))
  const [manifest, setManifest]   = useState(null)
  const [products, setProducts]   = useState([])
  const [actions, setActions]     = useState([])
  const [orders, setOrders]       = useState([])
  const [budget, setBudget]       = useState(null)
  const [status, setStatus]       = useState('idle')     // idle | running | waiting
  const [prompt, setPrompt]       = useState('')
  const [reply, setReply]         = useState('')
  const [gate, setGate]           = useState(null)       // { product_id, name, amount, reason }
  const [error, setError]         = useState('')

  const cursor   = useRef(0)
  const feedRef  = useRef(null)
  const gateRef  = useRef(null)
  const gateWait = useRef(null)   // resolver the scripted run parks on
  const polling  = useRef(false)  // guards overlapping ledger reads

  useEffect(() => {
    if (!showSeal) return
    sessionStorage.setItem(SEAL_KEY, '1')
    const t = setTimeout(() => setShowSeal(false), 1400)
    return () => clearTimeout(t)
  }, [showSeal])

  // ── Ledger polling ─────────────────────────────────────────────────────────
  // Poll rather than push: the feed then reflects actions taken by any client,
  // including an MCP agent in a different process, not just this tab.
  const pull = useCallback(async () => {
    // The timer and the run loop both call this. Without a guard, two reads
    // race on the same cursor and the same rows arrive twice.
    if (polling.current) return
    polling.current = true
    try {
      const data = await api.getLedger(sessionId, cursor.current)
      cursor.current = data.cursor
      setBudget(data.budget)
      setOrders(data.orders ?? [])
      if (data.actions?.length) {
        setActions(prev => {
          const known = new Set(prev.map(a => a.id))
          const fresh = data.actions.filter(a => !known.has(a.id))
          return fresh.length ? [...prev, ...fresh] : prev
        })
      }
    } catch {
      /* a dropped poll is not worth surfacing; the next one recovers */
    } finally {
      polling.current = false
    }
  }, [sessionId])

  useEffect(() => {
    pull()
    const t = setInterval(pull, 1200)
    return () => clearInterval(t)
  }, [pull])

  useEffect(() => {
    api.getManifest().then(setManifest).catch(() => {})
    api.listDigitalProducts().then(d => setProducts(d.products ?? [])).catch(() => {})
  }, [])

  // The feed follows the newest entry. When a gate opens it takes priority and
  // is scrolled into view — it is the one thing on this page that stops the
  // agent dead, and it must never be sitting below the fold.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el = feedRef.current
      if (el) el.scrollTop = el.scrollHeight
      if (gate && gateRef.current) {
        gateRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [actions.length, gate])

  // ── Approval gate ──────────────────────────────────────────────────────────
  const openGate = useCallback((productId, reason, amount, name) => {
    setStatus('waiting')
    setGate({ product_id: productId, reason, amount, name })
    return new Promise(resolve => { gateWait.current = resolve })
  }, [])

  const decide = async approved => {
    if (!gate || gate.settled) return
    const { product_id } = gate

    // The crawling dashes stop on the click, not on the round trip. A border
    // that goes solid is the state change — the card holds for a beat so that
    // reads, then clears.
    setGate(g => ({ ...g, settled: true, approved }))

    await api.decideApproval(sessionId, product_id, approved, 'you')
    await pull()
    setStatus('running')
    gateWait.current?.(approved)
    gateWait.current = null

    setTimeout(() => setGate(null), 800)
  }

  // ── Scripted run ───────────────────────────────────────────────────────────
  // Deterministic, no model, no network beyond haat itself — the path that has
  // to work on a stage. Paced so the ledger is legible as it is written.
  const beat = ms => new Promise(r => setTimeout(r, ms))

  async function runScripted() {
    setError(''); setReply(''); setStatus('running')
    try {
      await api.searchProducts(sessionId, 'block print pattern')
      await pull(); await beat(900)

      // A clean purchase, inside every limit.
      await api.purchase(sessionId, 'dp001', buyerRef)
      await pull(); await beat(1100)

      // A seller haat has not verified — a hard refusal at any price.
      await api.createOrder(sessionId, 'dp005', buyerRef)
      await pull(); await beat(1100)

      // A card that declines, then the same order paid properly. The failure is
      // real: the signature genuinely does not verify.
      await api.purchase(sessionId, 'dp002', buyerRef, { outcome: 'failed' })
      await pull(); await beat(1200)
      await api.purchase(sessionId, 'dp002', buyerRef)
      await pull(); await beat(1100)

      // Over the per-transaction cap: gated, not blocked. Stops here until a
      // human decides.
      const gated = await api.createOrder(sessionId, 'dp004', buyerRef)
      await pull()
      if (gated.status === 'pending_approval') {
        const approved = await openGate(
          'dp004', gated.reason,
          gated.product?.price_inr, gated.product?.name,
        )
        if (!approved) {
          setReply('Declined. Nothing was charged for that item, and the session budget is untouched.')
          setStatus('idle')
          return
        }
        await beat(500)
        await api.purchase(sessionId, 'dp004', buyerRef)
        await pull(); await beat(1100)
      }

      // The session ceiling — the one limit an approval cannot lift.
      await api.createOrder(sessionId, 'dp003', buyerRef)
      await pull()

      setReply('Run complete. Two products delivered, one seller refused, one card declined and retried, one purchase approved by you, and one stopped at the session budget. Every decision is in the ledger with its reason.')
    } catch (err) {
      setError(err.message)
    } finally {
      setStatus('idle')
    }
  }

  // ── Live agent ─────────────────────────────────────────────────────────────
  async function ask(e) {
    e?.preventDefault()
    const text = prompt.trim()
    if (!text || status === 'running') return

    setError(''); setReply(''); setStatus('running'); setPrompt('')
    try {
      const result = await api.runAgent(sessionId, text, buyerRef)
      await pull()
      setReply(result.reply ?? '')

      if (result.status === 'awaiting_approval' && result.pending_approval) {
        const p = result.pending_approval
        const approved = await openGate(p.product_id, p.reason, p.product?.price_inr, p.product?.name)
        const follow = approved
          ? 'Approved. Go ahead with that purchase.'
          : 'Declined. Do not buy that one.'
        const resumed = await api.runAgent(sessionId, follow, buyerRef)
        await pull()
        setReply(resumed.reply ?? '')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setStatus('idle')
    }
  }

  async function reset() {
    await api.resetSession(sessionId)
    cursor.current = 0
    setActions([]); setOrders([]); setReply(''); setGate(null); setError('')
    await pull()
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const pct = budget
    ? Math.min(100, (budget.spent_paise / budget.session_cap_paise) * 100)
    : 0

  const delivered = orders.filter(o => o.deliverable)
  const agentReady = products.filter(p => p.agent_checkout_enabled)

  return (
    <div className="ledger-root">
      {/* Portalled to <body> on purpose. The shell wraps every page in
          .page-enter, whose transform animation makes it the containing block
          for position:fixed descendants — an overlay rendered inside it centres
          on the whole document rather than the viewport, which put the seal
          several hundred pixels below the fold. */}
      {showSeal && createPortal(
        <div className="seal-stage">
          {/* Two clipped copies of the same glyph: it stamps, then cracks down
              the centreline and the halves part. The panels hinge out of them. */}
          <div className="seal-glyph">
            <span className="seal-half seal-half-l"><Seal /></span>
            <span className="seal-half seal-half-r"><Seal /></span>
          </div>
        </div>,
        document.body,
      )}

      <div className="ledger-shell">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="ledger-topbar hinge-left">
          <div>
            <div className="lx-eyebrow write-on" style={{ marginBottom: 8 }}>Agent Checkout</div>
            <h1 className="lx-wordmark">The haat bahi&#8209;khata</h1>
            <p className="lx-body lx-muted" style={{ maxWidth: '52ch', marginTop: 10, fontSize: 14 }}>
              An AI buyer transacts here on its own. Every decision it is allowed to make, and every
              one it is not, is written into this ledger as it happens.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`status-dot ${status === 'running' ? 'busy' : status === 'waiting' ? 'idle' : ''}`} />
              <span className="lx-eyebrow">
                {status === 'running' ? 'Agent working' : status === 'waiting' ? 'Awaiting you' : 'Ready'}
              </span>
            </div>
            <div className="lx-data lx-muted">session {sessionId}</div>
            <div className="lx-data lx-muted">
              razorpay {manifest?.payment_provider?.mode ?? '…'}
              {manifest && ` · caps ${manifest.limits.per_transaction} / txn`}
            </div>
            <Link to="/" className="lx-data" style={{ color: 'var(--brass)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              back to the shop
            </Link>
          </div>
        </header>

        <div className="ledger-grid">
          {/* ══ THE COUNTER ══════════════════════════════════════════════ */}
          <section className="hinge-left">
            <div className="panel-head">
              <h2 className="lx-section">The counter</h2>
              <span className="lx-data lx-muted">{agentReady.length} SKUs open to agents</span>
            </div>

            <form onSubmit={ask}>
              <input
                className="prompt-line"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Tell the agent what to buy…"
                disabled={status === 'running'}
                aria-label="Instruction for the buying agent"
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button type="submit" className="lx-btn" disabled={status === 'running' || !prompt.trim()}>
                  Send to agent
                </button>
                <button type="button" className="lx-btn lx-btn-ghost" onClick={runScripted} disabled={status === 'running'}>
                  Run scripted demo
                </button>
                <button type="button" className="lx-btn lx-btn-ghost" onClick={reset} disabled={status === 'running'}>
                  Reset
                </button>
              </div>
            </form>

            <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
              {[
                'Buy me a digital block-print pattern under ₹800',
                'Find the best digital resources you can for learning embroidery',
              ].map(s => (
                <button key={s} type="button" className="chip" onClick={() => setPrompt(s)} disabled={status === 'running'}>
                  {s}
                </button>
              ))}
            </div>

            {reply && (
              <div className="lx-body write-on" style={{ marginTop: 20, paddingLeft: 12, borderLeft: '1px solid var(--brass)', fontSize: 14 }}>
                {reply}
              </div>
            )}

            {error && (
              <div className="lx-body" style={{ marginTop: 16, color: 'var(--ember)', fontSize: 13 }}>
                {error}
              </div>
            )}

            {/* ── Spend meter ───────────────────────────────────────────── */}
            {budget && (
              <div style={{ marginTop: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                  <span className="lx-eyebrow">Session budget</span>
                  <span className="lx-data" style={{ color: 'var(--parchment)' }}>
                    {budget.spent} <span className="lx-muted">of {budget.session_cap}</span>
                  </span>
                </div>
                <div className="meter-well">
                  <div
                    className={`meter-fill ${pct >= 100 ? 'at-limit' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="lx-data lx-muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                  Anything over {budget.txn_cap} needs your explicit approval.
                  The session budget itself cannot be lifted.
                </p>
              </div>
            )}

            {/* ── Catalogue ─────────────────────────────────────────────── */}
            <div className="panel-head" style={{ marginTop: 30 }}>
              <h2 className="lx-section">On the shelf</h2>
            </div>
            <div style={{ display: 'grid', gap: 7 }}>
              {products.map(p => (
                <article key={p.id} className={`sku ${p.agent_checkout_enabled ? '' : 'is-off'}`}>
                  <img src={p.image} alt="" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.35, marginBottom: 4 }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className={`tag ${p.agent_checkout_enabled ? 'tag-ready' : 'tag-off'}`}>
                        {p.agent_checkout_enabled ? 'AI-buyer ready' : 'humans only'}
                      </span>
                      {!p.seller_verified && <span className="tag tag-unverified">unverified seller</span>}
                      {p.remaining_stock != null && (
                        <span className="lx-data lx-muted">{p.remaining_stock} left</span>
                      )}
                    </div>
                  </div>
                  <div className="lx-data" style={{ color: 'var(--brass)', textAlign: 'right' }}>
                    ₹{p.price.toLocaleString('en-IN')}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ══ LIVE LEDGER ══════════════════════════════════════════════ */}
          <section className="ledger-well hinge-right">
            <div className="panel-head">
              <h2 className="lx-section">Live ledger</h2>
              <span className="lx-data lx-muted">{actions.length} entries</span>
            </div>

            <div className="ledger-feed" ref={feedRef}>
              {actions.length === 0 && (
                <p className="lx-body lx-muted" style={{ padding: '28px 0', fontSize: 14 }}>
                  Nothing recorded yet. Send the agent an instruction, or run the scripted demo —
                  every call it makes lands here, the refused ones included.
                </p>
              )}

              {actions.map(a => {
                const stamp = STAMPS[a.action_type] ?? { label: a.action_type, tone: 'note' }
                const blocked = a.decision === 'blocked' || a.decision === 'pending_approval'
                return (
                  <div
                    key={a.id}
                    className={`entry ${blocked ? 'is-blocked' : ''} ${a.actor === 'human' || a.actor === 'you' ? 'is-human' : ''}`}
                  >
                    <span className="entry-time write-on">{clockOf(a.created_at)}</span>
                    <span className="entry-reason write-on-delayed">
                      {a.reason}
                      {a.amount && <span className="lx-data lx-muted">{'  '}· {a.amount}</span>}
                    </span>
                    <span className="stamp-cell">
                      <span className={`stamp ${toneClass(stamp.tone)}`}>{stamp.label}</span>
                    </span>
                  </div>
                )
              })}

            </div>

            {/* The gate. Part of the ledger panel, never a modal — but pinned
                below the feed rather than inside it: the feed scrolls, and the
                one control that stops the agent dead must not be something a
                judge has to go looking for. */}
            {gate && (
              <div className={`approval-card awaiting ${gate.settled ? 'settled' : ''}`} ref={gateRef}>
                <div className="lx-eyebrow" style={{ color: 'var(--ember)', marginBottom: 9 }}>
                  {gate.settled ? (gate.approved ? 'Approved by you' : 'Declined by you') : 'Pending your approval'}
                </div>
                <p className="lx-body" style={{ fontSize: 14, marginBottom: 4 }}>
                  The agent wants to buy <strong style={{ fontWeight: 500 }}>{gate.name}</strong>
                  {gate.amount != null && ` for ₹${gate.amount.toLocaleString('en-IN')}`}.
                </p>
                <p className="lx-data lx-muted" style={{ lineHeight: 1.6, marginBottom: 13 }}>
                  {gate.reason}
                </p>
                {gate.settled ? (
                  <span className={`stamp ${gate.approved ? 'stamp-ok' : 'stamp-blocked'}`}>
                    {gate.approved ? 'approved' : 'declined'}
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="lx-btn" onClick={() => decide(true)}>Approve once</button>
                    <button className="lx-btn lx-btn-ghost" onClick={() => decide(false)}>Decline</button>
                  </div>
                )}
              </div>
            )}

            {/* ── Receipts ──────────────────────────────────────────────── */}
            {delivered.length > 0 && (
              <>
                <div className="panel-head" style={{ marginTop: 22 }}>
                  <h2 className="lx-section">Delivered</h2>
                </div>
                <div style={{ display: 'grid', gap: 14 }}>
                  {delivered.map(o => (
                    <div key={o.order_id} className="receipt">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                        <strong style={{ fontSize: 14, fontWeight: 600 }}>{o.product_name}</strong>
                        <span className="lx-data">{o.amount}</span>
                      </div>

                      <div className="lx-data" style={{ color: '#6B6355', marginTop: 8, lineHeight: 1.7 }}>
                        <div>order {o.order_id}</div>
                        <div>razorpay {o.razorpay_order_id}</div>
                        {o.razorpay_payment_id && <div>payment {o.razorpay_payment_id}</div>}
                      </div>

                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(22,18,14,0.14)' }}>
                        {o.deliverable.kind === 'code' ? (
                          <>
                            <div className="lx-eyebrow" style={{ color: '#6B6355', marginBottom: 6 }}>Unlock code</div>
                            <code className="lx-data" style={{ fontSize: 15, letterSpacing: '0.06em' }}>
                              {o.deliverable.unlock_code}
                            </code>
                          </>
                        ) : (
                          <>
                            <div className="lx-eyebrow" style={{ color: '#6B6355', marginBottom: 6 }}>Download</div>
                            <a
                              href={o.deliverable.download_url}
                              className="lx-data"
                              style={{ color: '#8A4B1E', textDecoration: 'underline', textUnderlineOffset: 3, wordBreak: 'break-all' }}
                            >
                              {o.deliverable.filename}
                            </a>
                            <div className="lx-data" style={{ color: '#6B6355', marginTop: 5 }}>
                              signed link · expires {new Date(o.deliverable.expires_at).toLocaleString()}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="lx-sign" style={{ marginTop: 12, color: '#8A4B1E' }}>
                        verified by haat
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        {/* ── Footnote ───────────────────────────────────────────────────── */}
        <footer style={{ marginTop: 44, paddingTop: 18, borderTop: '1px solid var(--rule)' }}>
          <p className="lx-data lx-muted" style={{ lineHeight: 1.8, maxWidth: '84ch' }}>
            The agent chooses what to buy. It does not decide whether it may: the spend caps, the
            seller-verification rule and the approval gate are plain server-side comparisons, and the
            agent has no tool for approving its own spending. The same tools are exposed over MCP and
            over REST at <span style={{ color: 'var(--brass)' }}>/api/agent-commerce/manifest</span>.
          </p>
        </footer>
      </div>
    </div>
  )
}
