import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as shop from '../lib/shop'
import ProductCard from '../components/ProductCard'

/* ═══════════════════════════════════════════════════════════════════════════
   Home.

   Two claims, in order: haat sells digital work made by Indian craftspeople,
   and an AI agent can buy it without a human touching the transaction. The
   second is the unusual one, so it gets its own panel rather than a footnote.
   ═══════════════════════════════════════════════════════════════════════════ */

const RULES = [
  ['Bounded', 'Every agent runs against a per-transaction cap and a session budget it cannot lift.'],
  ['Gated', 'Anything over the cap stops dead and waits for a person to approve that item, at that price.'],
  ['Audited', 'Every decision is written to a ledger with its reason — the refusals included.'],
]

export default function HomePage() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    shop.listProducts().then(d => setProducts(d.products ?? [])).catch(() => {})
  }, [])

  const featured = products.filter(p => p.featured).slice(0, 4)
  const rest = products.filter(p => !p.featured).slice(0, 4)
  const shelf = [...featured, ...rest].slice(0, 8)

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="h-wrap" style={{ paddingTop: 'calc(var(--nav-height) + clamp(52px, 11vw, 132px))', paddingBottom: 'clamp(48px, 8vw, 96px)' }}>
        <p className="h-eyebrow h-wipe" style={{ marginBottom: 22 }}>Digital goods · Indian craft · instant delivery</p>

        <h1 className="h-display h-rise" style={{ maxWidth: '15ch', marginBottom: 28 }}>
          The workshop,<br />
          <span style={{ color: 'var(--brass)' }}>as a file.</span>
        </h1>

        <p className="h-lede h-rise" style={{ maxWidth: '54ch', marginBottom: 36, animationDelay: '90ms' }}>
          Pattern packs from Madhubani painters. Brushes scanned off Sanganer teak blocks.
          Field recordings from the Varanasi ghats at four in the morning. Nothing ships —
          it arrives the moment it is paid for.
        </p>

        <div className="h-rise" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', animationDelay: '160ms' }}>
          <Link to="/catalogue" className="h-btn">Browse the catalogue</Link>
          <Link to="/agent-checkout" className="h-btn h-btn-ghost">Watch an agent buy</Link>
        </div>
      </section>

      {/* ── The agent claim ──────────────────────────────────────────────── */}
      <section className="h-wrap" style={{ paddingBottom: 'clamp(48px, 8vw, 92px)' }}>
        <div style={{ border: '1px solid var(--rule)', background: 'var(--ink-raised)', padding: 'clamp(26px, 4vw, 46px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'clamp(24px, 4vw, 56px)', alignItems: 'start' }}>
            <div>
              <p className="h-eyebrow" style={{ marginBottom: 16 }}>Agentic checkout</p>
              <h2 className="h-title" style={{ marginBottom: 16, maxWidth: '18ch' }}>
                An AI buyer can shop here on its own.
              </h2>
              <p className="h-body h-muted" style={{ fontSize: 15, maxWidth: '46ch', marginBottom: 22 }}>
                Not a checkout button an agent could theoretically click — a real tool surface over
                MCP and REST, real Razorpay orders, and delivery on payment. The agent decides what
                to buy. It does not decide whether it is allowed to.
              </p>
              <Link to="/agent-checkout" className="h-btn h-btn-ghost">Open the ledger</Link>
            </div>

            <div style={{ display: 'grid', gap: 2 }}>
              {RULES.map(([title, body], i) => (
                <div key={title} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 18, padding: '16px 0', borderTop: i ? '1px solid var(--rule)' : 'none' }}>
                  <span className="h-data" style={{ color: 'var(--brass)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{title}</span>
                  <span className="h-body h-muted" style={{ fontSize: 14 }}>{body}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Shelf ────────────────────────────────────────────────────────── */}
      <section className="h-wrap" style={{ paddingBottom: 40 }}>
        <div className="h-section-head">
          <h2 className="h-sub">On the shelf</h2>
          <Link to="/catalogue" className="h-data" style={{ color: 'var(--brass)' }}>
            all {products.length} →
          </Link>
        </div>

        <div className="h-grid h-stagger">
          {shelf.map((p, i) => <ProductCard key={p.product_id ?? p.id} product={p} style={{ '--i': i }} />)}
        </div>

        {shelf.length === 0 && (
          <p className="h-body h-muted" style={{ padding: '40px 0' }}>
            The catalogue could not be loaded. Is the backend running?
          </p>
        )}
      </section>
    </>
  )
}
