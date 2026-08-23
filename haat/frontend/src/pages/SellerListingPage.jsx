import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as shop from '../lib/shop'

/* ═══════════════════════════════════════════════════════════════════════════
   List a product.

   haat sells digital goods only, so there is no product type to pick. The one
   real question is how the thing reaches the buyer, and the second is whether
   an AI agent may buy it — the seller's decision and nobody else's, asked
   explicitly rather than defaulted on.
   ═══════════════════════════════════════════════════════════════════════════ */

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

const DELIVERY = [
  { id: 'file', label: 'File download', hint: 'Upload it once. Every buyer gets their own signed link, expiring in 48 hours.' },
  { id: 'code', label: 'Licence key',   hint: 'Paste a pool of keys. One is issued per sale and burned; the sale stops when they run out.' },
  { id: 'link', label: 'Access link',   hint: 'You host it. haat hands the URL over on payment and never expires it.' },
]

function Field({ label, hint, required, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 22 }}>
      <span className="h-body" style={{ display: 'block', fontSize: 14, marginBottom: 7 }}>
        {label}{required && <span style={{ color: 'var(--brass)' }}> *</span>}
      </span>
      {children}
      {hint && <span className="h-data h-faint" style={{ display: 'block', marginTop: 7, lineHeight: 1.6 }}>{hint}</span>}
    </label>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div className="h-section-head"><h2 className="h-eyebrow">{title}</h2></div>
      {children}
    </section>
  )
}

export default function SellerListingPage() {
  const [sellers, setSellers]   = useState([])
  const [sellerId, setSellerId] = useState('')
  const [kind, setKind]         = useState('file')
  const [agentReady, setAgent]  = useState(true)
  const [codeText, setCodeText] = useState('')
  const [busy, setBusy]         = useState(false)
  const [result, setResult]     = useState(null)
  const [errors, setErrors]     = useState([])
  const formRef = useRef(null)

  useEffect(() => {
    shop.listSellers()
      .then(d => {
        setSellers(d.sellers ?? [])
        if (d.sellers?.length) setSellerId(d.sellers[0].id)
      })
      .catch(() => {})
  }, [])

  const seller = useMemo(() => sellers.find(s => s.id === sellerId), [sellers, sellerId])
  const codeCount = codeText.split('\n').map(c => c.trim()).filter(Boolean).length

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErrors([]); setResult(null)

    const fd = new FormData(formRef.current)
    fd.set('product_type', 'digital')
    fd.set('digital_deliverable_type', kind)
    fd.set('agent_checkout_enabled', agentReady ? 'true' : 'false')

    try {
      const res = await fetch(`${API}/seller/products`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setErrors(data.errors ?? [data.error ?? 'Could not create the listing']); return }
      setResult(data)
      formRef.current.reset()
      setCodeText('')
      globalThis.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setErrors([err.message])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-wrap h-page" style={{ maxWidth: 720 }}>
      <p className="h-eyebrow" style={{ marginBottom: 14 }}>Sell on haat</p>
      <h1 className="h-title" style={{ marginBottom: 16 }}>List something you made.</h1>
      <p className="h-body h-muted" style={{ marginBottom: 38, maxWidth: '52ch' }}>
        Everything on haat is digital and arrives the moment it is paid for. Choose how yours is
        delivered, and whether an AI buyer is allowed to purchase it.
      </p>

      {result && (
        <div className="h-notice h-notice-ok" style={{ marginBottom: 30 }}>
          <strong style={{ display: 'block', fontSize: 15, fontWeight: 500, marginBottom: 7 }}>
            “{result.product.name}” is live
          </strong>
          <p className="h-body h-muted" style={{ fontSize: 14, marginBottom: 12 }}>
            {result.agent_visible
              ? 'AI buyers can purchase it now — it appears in agent search and passes the guardrails.'
              : result.note ?? 'Listed for people. AI-buyer checkout is off for this one.'}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to={`/product/${result.product.id}`} className="h-btn h-btn-quiet">View listing</Link>
            {result.agent_visible && (
              <Link to="/agent-checkout" className="h-btn h-btn-quiet">Watch an agent buy it</Link>
            )}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="h-notice h-notice-error" style={{ marginBottom: 30 }}>
          <strong style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
            This listing needs a few fixes
          </strong>
          <ul style={{ paddingLeft: 18 }}>
            {errors.map(e => <li key={e} className="h-body h-muted" style={{ fontSize: 13.5, lineHeight: 1.8 }}>{e}</li>)}
          </ul>
        </div>
      )}

      <form ref={formRef} onSubmit={submit}>
        <Section title="The product">
          <Field label="Name" required>
            <input name="name" className="h-input" required placeholder="Kolam Grid — 40 Threshold Patterns" />
          </Field>

          <Field label="Description" required>
            <textarea name="description" className="h-textarea" required rows={3}
              placeholder="What it is, who made it, and what the buyer actually receives." />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
            <Field label="Price in rupees" required>
              <input name="price" className="h-input" type="number" min="1" step="1" required placeholder="649" />
            </Field>

            <Field
              label="Seller"
              required
              hint={seller && !seller.haat_verified
                ? 'Not haat-verified yet — AI buyers are refused this seller at any price.'
                : undefined}
            >
              <select name="seller_id" className="h-select" value={sellerId}
                onChange={e => setSellerId(e.target.value)} required>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.haat_verified ? '' : ' (unverified)'}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Tags" hint="Comma separated. Helps both people and agents find it.">
            <input name="tags" className="h-input" placeholder="kolam, pattern, vector, Tamil Nadu" />
          </Field>

          <Field label="Cover image" hint="Optional. Shown on the catalogue plate.">
            <input name="cover" className="h-input" type="file" accept="image/*" style={{ padding: 10 }} />
          </Field>
        </Section>

        <Section title="Delivery">
          <div role="radiogroup" aria-label="Delivery method" style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
            {DELIVERY.map(k => {
              const on = kind === k.id
              return (
                <button key={k.id} type="button" role="radio" aria-checked={on} onClick={() => setKind(k.id)}
                  style={{
                    textAlign: 'left', padding: '14px 16px',
                    border: `1px solid ${on ? 'var(--brass)' : 'var(--rule)'}`,
                    background: on ? 'rgba(184,147,90,0.07)' : 'transparent',
                    transition: 'border-color 160ms var(--ease), background 160ms var(--ease)',
                  }}>
                  <span style={{ display: 'block', fontSize: 14, marginBottom: 3, color: on ? 'var(--brass)' : 'var(--parchment)' }}>
                    {k.label}
                  </span>
                  <span className="h-data h-faint" style={{ lineHeight: 1.6 }}>{k.hint}</span>
                </button>
              )
            })}
          </div>

          {kind === 'file' && (
            <Field label="The file" required hint="Up to 25 MB.">
              <input name="deliverable" className="h-input" type="file" required style={{ padding: 10 }} />
            </Field>
          )}

          {kind === 'code' && (
            <Field label="Licence keys" required
              hint={`One per line. ${codeCount} key${codeCount === 1 ? '' : 's'} — that is your stock, and haat refuses the sale once they run out.`}>
              <textarea name="code_pool" className="h-textarea" rows={6} required
                value={codeText} onChange={e => setCodeText(e.target.value)}
                placeholder={'KOLAM-2026-A1\nKOLAM-2026-B2\nKOLAM-2026-C3'}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
            </Field>
          )}

          {kind === 'link' && (
            <Field label="Access URL" required hint="Must be https. haat passes this straight to the buyer.">
              <input name="external_url" className="h-input" type="url" required
                placeholder="https://example.com/course/enrol" />
            </Field>
          )}

          <Field label="Licence terms" hint="Shown to buyers, and to agents before they purchase.">
            <input name="license" className="h-input" placeholder="Royalty-free, personal + small-commercial" />
          </Field>

          <Field label="Maximum purchases per buyer"
            hint="Blank for unlimited. Set 1 for a single seat — haat then returns the buyer’s existing copy instead of charging twice.">
            <input name="max_purchases" className="h-input" type="number" min="1" step="1" placeholder="unlimited" />
          </Field>
        </Section>

        <Section title="AI buyers">
          <label style={{
            display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer', padding: '18px 20px',
            border: `1px solid ${agentReady ? 'var(--brass)' : 'var(--rule)'}`,
            background: agentReady ? 'rgba(184,147,90,0.07)' : 'transparent',
            transition: 'border-color 160ms var(--ease), background 160ms var(--ease)',
          }}>
            <input type="checkbox" checked={agentReady} onChange={e => setAgent(e.target.checked)}
              style={{ width: 17, height: 17, marginTop: 3, flexShrink: 0, accentColor: '#B8935A' }} />
            <span>
              <span style={{ display: 'block', fontSize: 15, marginBottom: 6, color: agentReady ? 'var(--brass)' : 'var(--parchment)' }}>
                Enable AI-buyer checkout
              </span>
              <span className="h-body h-muted" style={{ fontSize: 13.5 }}>
                Lets an agent shopping for someone find and buy this with no human in the loop.
                It still passes haat&rsquo;s spend caps and approval gate, and every attempt is written
                to an auditable ledger. Leave it off and only people can buy it.
              </span>
              {seller && !seller.haat_verified && agentReady && (
                <span className="h-data" style={{ display: 'block', marginTop: 10, color: 'var(--ember)', lineHeight: 1.6 }}>
                  {seller.name} is not haat-verified, so agents will still be refused. This takes
                  effect when verification completes.
                </span>
              )}
            </span>
          </label>
        </Section>

        <button type="submit" className="h-btn" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Listing…' : 'List this product'}
        </button>
      </form>
    </div>
  )
}
