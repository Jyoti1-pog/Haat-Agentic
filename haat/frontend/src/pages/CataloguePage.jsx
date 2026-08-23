import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as shop from '../lib/shop'
import ProductCard from '../components/ProductCard'

/* ═══════════════════════════════════════════════════════════════════════════
   The catalogue.

   Everything filters client-side against one fetch of the whole catalogue.
   That is a deliberate choice at this size: sixteen products is not a search
   problem, and a filter that responds on the keystroke beats one that round
   trips. The agent's search tool is the one that ranks server-side.
   ═══════════════════════════════════════════════════════════════════════════ */

const SORTS = {
  featured: { label: 'Featured', fn: (a, b) => (b.featured - a.featured) || (b.rating - a.rating) },
  low:      { label: 'Price ↑',  fn: (a, b) => a.price - b.price },
  high:     { label: 'Price ↓',  fn: (a, b) => b.price - a.price },
  rated:    { label: 'Rating',   fn: (a, b) => b.rating - a.rating },
}

export default function CataloguePage() {
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const kind = params.get('kind') ?? 'all'
  const q    = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'featured'
  const agentOnly = params.get('agent') === '1'

  useEffect(() => {
    shop.listProducts()
      .then(d => setProducts(d.products ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = (key, value) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const kinds = useMemo(
    () => ['all', ...new Set(products.map(p => p.subcategory).filter(Boolean))],
    [products],
  )

  const shown = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return products
      .filter(p => kind === 'all' || p.subcategory === kind)
      .filter(p => !agentOnly || p.agent_checkout_enabled)
      .filter(p => {
        if (!terms.length) return true
        const hay = [p.name, p.description, p.seller, p.city, p.state, ...(p.tags ?? [])]
          .filter(Boolean).join(' ').toLowerCase()
        return terms.every(t => hay.includes(t))
      })
      .sort(SORTS[sort]?.fn ?? SORTS.featured.fn)
  }, [products, kind, q, sort, agentOnly])

  return (
    <div className="h-wrap h-page">
      <header style={{ marginBottom: 34 }}>
        <p className="h-eyebrow" style={{ marginBottom: 14 }}>Catalogue</p>
        <h1 className="h-title" style={{ marginBottom: 18, maxWidth: '20ch' }}>
          Everything haat sells, and nothing that ships.
        </h1>
        <input
          className="h-line-input"
          value={q}
          onChange={e => set('q', e.target.value)}
          placeholder="Search patterns, brushes, courses, recordings…"
          aria-label="Search the catalogue"
          style={{ maxWidth: 620 }}
        />
      </header>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', paddingBottom: 16, marginBottom: 26, borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', overflowX: 'auto' }}>
          {kinds.map(k => (
            <button key={k} className="h-chip" aria-pressed={kind === k} onClick={() => set('kind', k)}>
              {k === 'all' ? 'Everything' : k}
            </button>
          ))}
        </div>

        <button className="h-chip" aria-pressed={agentOnly} onClick={() => set('agent', agentOnly ? '' : '1')}
          style={{ marginLeft: 'auto' }}>
          AI-buyer ready
        </button>

        <select className="h-select" value={sort} onChange={e => set('sort', e.target.value)}
          aria-label="Sort" style={{ width: 'auto', minWidth: 140, fontSize: 12 }}>
          {Object.entries(SORTS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
      </div>

      <p className="h-data h-faint" style={{ marginBottom: 22 }}>
        {loading ? 'loading…' : `${shown.length} of ${products.length} products`}
      </p>

      {shown.length > 0 ? (
        <div className="h-grid h-stagger">
          {shown.map((p, i) => (
            <ProductCard key={p.product_id ?? p.id} product={p} style={{ '--i': Math.min(i, 12) }} />
          ))}
        </div>
      ) : !loading && (
        <div style={{ padding: '64px 0', textAlign: 'center' }}>
          <p className="h-body h-muted" style={{ marginBottom: 18 }}>Nothing matches that.</p>
          <button className="h-btn h-btn-ghost" onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}
