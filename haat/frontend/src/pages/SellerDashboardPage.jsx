import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as shop from '../lib/shop'
import { inr } from '../lib/shop'

/* ═══════════════════════════════════════════════════════════════════════════
   Seller dashboard.

   The number a seller on this marketplace cares about that they would not get
   anywhere else: how much of their revenue came from an agent rather than a
   person. That is the whole reason to leave the AI-buyer switch on, so it is
   the figure the page leads with.
   ═══════════════════════════════════════════════════════════════════════════ */

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

export default function SellerDashboardPage() {
  const [sellers, setSellers] = useState([])
  const [sellerId, setSellerId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    shop.listSellers()
      .then(d => {
        setSellers(d.sellers ?? [])
        if (d.sellers?.length) setSellerId(d.sellers[0].id)
      })
      .catch(() => setLoading(false))
  }, [])

  const load = useCallback(id => {
    if (!id) return
    setLoading(true)
    fetch(`${API}/seller/dashboard/${id}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(sellerId) }, [sellerId, load])

  const t = data?.totals

  return (
    <div className="h-wrap h-page">
      <div className="h-section-head">
        <div>
          <p className="h-eyebrow" style={{ marginBottom: 10 }}>Seller dashboard</p>
          <h1 className="h-title">{data?.seller.name ?? 'Your shop'}</h1>
          {data?.seller && (
            <p className="h-data h-faint" style={{ marginTop: 8 }}>
              {data.seller.city}, {data.seller.state} ·{' '}
              {data.seller.haat_verified
                ? <span style={{ color: 'var(--sage)' }}>haat verified since {data.seller.verified_since}</span>
                : <span style={{ color: 'var(--ember)' }}>not verified — agents are refused your products</span>}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="h-select" value={sellerId} onChange={e => setSellerId(e.target.value)}
            aria-label="Seller" style={{ width: 'auto', minWidth: 190, fontSize: 12 }}>
            {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Link to="/sell" className="h-btn h-btn-quiet">List a product</Link>
        </div>
      </div>

      {loading && <p className="h-data h-faint">loading…</p>}

      {t && (
        <>
          {/* ── Headline figures ─────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, background: 'var(--rule)', border: '1px solid var(--rule)', marginBottom: 40 }}>
            {[
              ['Revenue', t.revenue, null],
              ['Units sold', String(t.units_sold), null],
              ['Bought by agents', String(t.sold_to_agents), t.units_sold ? `${Math.round(t.sold_to_agents / t.units_sold * 100)}% of units` : null],
              ['Listings', String(t.listings), `${t.agent_enabled} open to agents`],
            ].map(([label, value, note]) => (
              <div key={label} style={{ background: 'var(--ink-raised)', padding: '20px 22px' }}>
                <div className="h-eyebrow" style={{ fontSize: 10.5, marginBottom: 10 }}>{label}</div>
                <div className="h-title" style={{ fontSize: 27, color: label === 'Bought by agents' ? 'var(--brass)' : 'var(--parchment)' }}>
                  {value}
                </div>
                {note && <div className="h-data h-faint" style={{ marginTop: 6 }}>{note}</div>}
              </div>
            ))}
          </div>

          {/* ── Listings ─────────────────────────────────────────────────── */}
          <div className="h-section-head" style={{ marginTop: 8 }}>
            <h2 className="h-eyebrow">Your listings</h2>
            <span className="h-data h-faint">ranked by revenue</span>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: 44 }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Product', 'Delivery', 'Price', 'Sold', 'To agents', 'Stock', 'Revenue'].map(h => (
                    <th key={h} className="h-eyebrow" style={{ fontSize: 10, textAlign: h === 'Product' ? 'left' : 'right', padding: '0 12px 12px', borderBottom: '1px solid var(--rule)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.products.map(p => (
                  <tr key={p.id}>
                    <td style={{ padding: '13px 12px', borderBottom: '1px solid var(--rule)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src={p.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', border: '1px solid var(--rule)', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <Link to={`/product/${p.id}`} style={{ fontSize: 14 }}>{p.name}</Link>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            {p.agent_checkout_enabled
                              ? <span className="h-tag h-tag-brass" style={{ fontSize: 8.5 }}>AI-buyer</span>
                              : <span className="h-tag h-tag-muted" style={{ fontSize: 8.5 }}>humans only</span>}
                            {p.listed_by !== 'seed' && <span className="h-tag h-tag-sage" style={{ fontSize: 8.5 }}>you listed</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    {[
                      p.deliverable,
                      inr(p.price),
                      p.units_sold,
                      p.sold_to_agents,
                      p.remaining_stock ?? '∞',
                      p.revenue,
                    ].map((v, i) => (
                      <td key={i} className="h-data" style={{
                        padding: '13px 12px', textAlign: 'right', borderBottom: '1px solid var(--rule)',
                        color: i === 5 ? 'var(--brass)' : i === 3 && v > 0 ? 'var(--brass)' : 'var(--muted)',
                        whiteSpace: 'nowrap',
                      }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Recent sales ─────────────────────────────────────────────── */}
          {data.recent_sales.length > 0 && (
            <>
              <div className="h-section-head"><h2 className="h-eyebrow">Recent sales</h2></div>
              <div style={{ display: 'grid', gap: 1, background: 'var(--rule)', border: '1px solid var(--rule)' }}>
                {data.recent_sales.map(s => (
                  <div key={s.order_id} style={{ background: 'var(--ink-raised)', padding: '13px 16px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14, alignItems: 'center' }}>
                    <span style={{ fontSize: 14 }}>{s.product_name}</span>
                    <span className={`h-tag ${s.channel === 'agent' ? 'h-tag-brass' : 'h-tag-muted'}`}>{s.channel}</span>
                    <span className="h-data" style={{ color: 'var(--brass)' }}>{s.amount}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {t.units_sold === 0 && (
            <p className="h-body h-muted" style={{ padding: '32px 0' }}>
              No sales yet. Products with AI-buyer checkout on can be bought by an agent as well as
              a person — that is usually where the first sale comes from.
            </p>
          )}
        </>
      )}
    </div>
  )
}
