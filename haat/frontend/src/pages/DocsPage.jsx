import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

/* ═══════════════════════════════════════════════════════════════════════════
   Documentation.

   Written for two readers at once: a person deciding whether to buy or sell
   here, and an engineer pointing an AI agent at the API.

   The numbers are not written down. Caps, tool names, payment mode and whether
   a key is required are all read from /api/agent-commerce/manifest at load, so
   this page cannot drift away from the deployment it is describing — change a
   cap in the environment and the docs change with it.
   ═══════════════════════════════════════════════════════════════════════════ */

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

const SECTIONS = [
  ['what', 'What haat is'],
  ['shoppers', 'Buying'],
  ['sellers', 'Selling'],
  ['agents', 'Connecting an agent'],
  ['flow', 'Making a purchase'],
  ['tools', 'Tool reference'],
  ['rules', 'The rules'],
  ['rest', 'REST API'],
  ['status', 'Live status'],
]

// ── Small building blocks ────────────────────────────────────────────────────
function Copy({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="h-btn h-btn-quiet"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        } catch { /* clipboard blocked; the text is on screen anyway */ }
      }}
      style={{ padding: '5px 11px', fontSize: 10 }}
    >
      {done ? 'Copied' : label}
    </button>
  )
}

function Code({ children, copy = true }) {
  const text = String(children).trim()
  return (
    <div style={{ position: 'relative', margin: '14px 0' }}>
      {copy && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
          <Copy text={text} />
        </div>
      )}
      <pre style={{
        background: 'var(--ink-sunken)', border: '1px solid var(--rule)',
        padding: '16px 18px', overflowX: 'auto', fontFamily: 'var(--font-mono)',
        fontSize: 12.5, lineHeight: 1.65, color: 'var(--parchment)',
      }}>
        {text}
      </pre>
    </div>
  )
}

function Section({ id, title, lead, children }) {
  return (
    <section id={id} style={{ scrollMarginTop: 'calc(var(--nav-height) + 24px)', marginBottom: 68 }}>
      <div className="h-section-head"><h2 className="h-sub">{title}</h2></div>
      {lead && <p className="h-body h-muted" style={{ maxWidth: '62ch', marginBottom: 20 }}>{lead}</p>}
      {children}
    </section>
  )
}

function Row({ k, v, tone }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 210px) 1fr', gap: 18, padding: '11px 0', borderBottom: '1px solid var(--rule)' }}>
      <span className="h-data" style={{ color: 'var(--brass)', fontSize: 11.5 }}>{k}</span>
      <span className="h-body h-muted" style={{ fontSize: 14, color: tone }}>{v}</span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const [manifest, setManifest] = useState(null)
  const [health, setHealth] = useState(null)
  const [active, setActive] = useState('what')

  useEffect(() => {
    fetch(`${API}/agent-commerce/manifest`).then(r => r.json()).then(setManifest).catch(() => {})
    fetch(`${API}/health`).then(r => r.json()).then(setHealth).catch(() => {})
  }, [])

  // Highlight whichever section is currently in view.
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-25% 0px -65% 0px' },
    )
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [manifest])

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const txnCap = manifest?.limits?.per_transaction ?? '…'
  const sessCap = manifest?.limits?.per_session ?? '…'
  const needsKey = manifest?.auth?.required

  // A token of your own, so your spend budget is yours. Kept in localStorage so
  // the URL on this page is the same one you connected last time — a fresh token
  // every reload would silently hand you a new, empty budget.
  const token = useMemo(() => {
    const KEY = 'haat.connector.token'
    try {
      const existing = localStorage.getItem(KEY)
      if (existing) return existing
      const minted = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
      localStorage.setItem(KEY, minted)
      return minted
    } catch {
      // Private windows and blocked site data both land here. A usable URL
      // still beats no URL; it just shares the default budget.
      return ''
    }
  }, [])

  const connectorUrl = token ? `${origin}/mcp/s/${token}` : `${origin}/mcp`

  const mcpConfig = useMemo(() => JSON.stringify({
    mcpServers: {
      haat: {
        command: 'npx',
        args: ['-y', 'haat-mcp'],
        env: {
          HAAT_URL: origin,
          HAAT_AGENT_SESSION: 'give-each-client-its-own',
          HAAT_BUYER_REF: 'you@example.com',
          ...(needsKey ? { HAAT_API_KEY: 'your-key' } : {}),
        },
      },
    },
  }, null, 2), [origin, needsKey])

  return (
    <div className="h-wrap h-page">
      <header style={{ marginBottom: 44 }}>
        <p className="h-eyebrow" style={{ marginBottom: 14 }}>Documentation</p>
        <h1 className="h-title" style={{ marginBottom: 16, maxWidth: '20ch' }}>
          Everything you need to use haat.
        </h1>
        <p className="h-lede" style={{ maxWidth: '58ch' }}>
          For people buying and selling, and for anyone pointing an AI agent at this
          marketplace. Every figure below is read from this deployment as you load the
          page, so it describes what is actually running.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0 }} className="docs-grid">
        {/* ── Contents ────────────────────────────────────────────────── */}
        <nav className="docs-nav" aria-label="Contents">
          <div className="h-eyebrow" style={{ fontSize: 10, marginBottom: 14 }}>Contents</div>
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`}
              style={{
                display: 'block', padding: '7px 0', fontSize: 13.5,
                color: active === id ? 'var(--brass)' : 'var(--muted)',
                borderLeft: `1px solid ${active === id ? 'var(--brass)' : 'var(--rule)'}`,
                paddingLeft: 13, transition: 'color 160ms var(--ease), border-color 160ms var(--ease)',
              }}>
              {label}
            </a>
          ))}
          <a href={`${API}/agent-commerce/manifest`} target="_blank" rel="noreferrer"
            style={{ display: 'block', marginTop: 18, paddingLeft: 13, fontSize: 12, color: 'var(--faint)' }}>
            Machine-readable manifest ↗
          </a>
        </nav>

        <div style={{ minWidth: 0 }}>
          {/* ══ What ══════════════════════════════════════════════════ */}
          <Section id="what" title="What haat is"
            lead="A marketplace for digital goods made by Indian craftspeople — pattern packs, brushes, typefaces, field recordings, courses. Nothing ships; everything arrives the moment it is paid for.">
            <p className="h-body h-muted" style={{ maxWidth: '62ch', marginBottom: 18 }}>
              It has two front doors and both are real. A person browses and checks out. An AI
              agent does the same thing on its own, over MCP or REST, with every money decision
              bounded, gated and written to an audit trail as it happens.
            </p>
            <p className="h-body" style={{ maxWidth: '62ch', paddingLeft: 16, borderLeft: '2px solid var(--brass)' }}>
              Both doors run the same code. Payment verification, delivery and entitlements are
              one implementation. Only the authorisation policy differs, because spend caps are an
              agent&rsquo;s leash, not a shopper&rsquo;s.
            </p>
          </Section>

          {/* ══ Shoppers ══════════════════════════════════════════════ */}
          <Section id="shoppers" title="Buying" lead="No account needed. Your library is keyed to an email address.">
            <Row k="1. Browse" v={<>Find something in the <Link to="/catalogue" style={{ color: 'var(--brass)' }}>catalogue</Link>.</>} />
            <Row k="2. Pay" v="Buy now, or add to cart and check out. A real Razorpay order is created and the payment signature is verified server-side before anything is delivered." />
            <Row k="3. Receive" v="A signed download link, a licence key, or an access link — depending on how the seller delivers it." />
            <Row k="4. Keep" v={<>It stays in your <Link to="/library" style={{ color: 'var(--brass)' }}>library</Link>. Download links are re-minted fresh every time you open it, so they never go stale.</>} />
            <p className="h-body h-muted" style={{ fontSize: 14, marginTop: 20, maxWidth: '62ch' }}>
              Use the same email an agent buys under and everything lands in one place, marked by
              who bought it. A single-seat licence you already own is returned rather than sold to
              you twice.
            </p>
          </Section>

          {/* ══ Sellers ═══════════════════════════════════════════════ */}
          <Section id="sellers" title="Selling" lead="Everything on haat is digital. The only real question is how yours reaches the buyer.">
            <Row k="File download" v="You upload it once. Every buyer gets their own signed link, expiring in 48 hours." />
            <Row k="Licence key" v="You paste a pool of keys. One is issued per sale and burned; haat refuses the sale when they run out rather than taking money for something it cannot deliver." />
            <Row k="Access link" v="You host it. haat hands the URL over on payment and never expires it, because it is not haat's to expire." />
            <p className="h-body h-muted" style={{ fontSize: 14, margin: '22px 0', maxWidth: '62ch' }}>
              The switch that matters is <strong style={{ color: 'var(--parchment)', fontWeight: 400 }}>Enable AI-buyer checkout</strong>.
              A digital product a person can buy is not automatically one an agent may buy, so haat
              asks explicitly rather than defaulting it on. Products from sellers haat has not
              verified are refused to agents at any price.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/sell" className="h-btn h-btn-ghost">List a product</Link>
              <Link to="/seller" className="h-btn h-btn-ghost">Seller dashboard</Link>
            </div>
          </Section>

          {/* ══ Agents ════════════════════════════════════════════════ */}
          <Section id="agents" title="Connecting an agent"
            lead="haat speaks MCP over two transports. Which one you want depends entirely on whether your AI runs on your machine or someone else's.">

            <p className="h-eyebrow" style={{ marginBottom: 10 }}>Hosted AI · a connector URL</p>
            <p className="h-body h-muted" style={{ fontSize: 14, marginBottom: 14, maxWidth: '62ch' }}>
              Claude and ChatGPT run in a datacentre, not on your laptop. They cannot start a
              local process, so a config with <code style={{ color: 'var(--parchment)' }}>npx</code> in
              it will never work there no matter how it is pasted — they connect to a URL and speak
              MCP over HTTP. This is that URL:
            </p>
            <Code>{connectorUrl}</Code>
            <p className="h-body h-muted" style={{ fontSize: 14, margin: '14px 0 18px', maxWidth: '62ch' }}>
              In Claude: <strong style={{ color: 'var(--parchment)', fontWeight: 400 }}>Settings → Connectors
              → Add custom connector</strong>, and paste it. In ChatGPT it goes under developer-mode
              connectors. No install, no keys, no account. The token on the end is what makes the
              budget yours — everyone arriving at a bare <code style={{ color: 'var(--parchment)' }}>/mcp</code> shares
              one instead.
            </p>

            <p className="h-eyebrow" style={{ margin: '30px 0 10px' }}>Local AI · stdio</p>
            <p className="h-body h-muted" style={{ fontSize: 14, marginBottom: 14, maxWidth: '62ch' }}>
              Claude Desktop, Claude Code and other hosts that run on your own machine <em>can</em> spawn
              a process, and this is the config for them:
            </p>
            <Code>{mcpConfig}</Code>
            <p className="h-body h-muted" style={{ fontSize: 14, marginBottom: 16, maxWidth: '62ch' }}>
              Two settings decide whether several agents can coexist:
            </p>
            <Row k="HAAT_AGENT_SESSION" v={<>The spend budget. Give every client its own, or two agents will drain each other&rsquo;s {sessCap}.</>} />
            <Row k="HAAT_BUYER_REF" v="Who owns the purchase. Use the person's email and it lands in a library they can open." />
            <Row k="HAAT_API_KEY"
              v={needsKey
                ? 'Required on this deployment. Your session is namespaced to the key, so no other agent can reach or spend it.'
                : 'Not required here — this deployment is open. If keys are ever enabled, your session gets namespaced to yours.'}
              tone={needsKey ? 'var(--brass)' : undefined} />
            <p className="h-body h-muted" style={{ fontSize: 14, marginTop: 22, maxWidth: '62ch' }}>
              Not using MCP? Every tool is also a plain REST endpoint — see below. Nothing is
              exclusive to the MCP path.
            </p>
          </Section>

          {/* ══ Flow ══════════════════════════════════════════════════ */}
          <Section id="flow" title="Making a purchase" lead="Three calls. An order is not a purchase until the third one returns.">
            <Row k="1. create_order" v="Runs the guardrails, then creates a real Razorpay order. Moves no money." />
            <Row k="2. authorise_payment" v="Stands in for the browser card step an agent cannot drive. Returns a payment id and signature." />
            <Row k="3. confirm_payment" v="Verifies the signature server-side and, if it holds, delivers. This is the step that spends budget." />

            <h3 className="h-body" style={{ fontSize: 15, margin: '26px 0 12px', color: 'var(--parchment)' }}>
              What create_order can answer
            </h3>
            <p className="h-body h-muted" style={{ fontSize: 14, marginBottom: 14, maxWidth: '62ch' }}>
              It is not a boolean. Read the <code className="h-data" style={{ color: 'var(--brass)' }}>status</code>:
            </p>
            <Row k="created" v="Proceed to payment." />
            <Row k="blocked" v="A hard rule refused it. Do not retry — pick something else." tone="#E8B9A6" />
            <Row k="pending_approval" v="Over the per-transaction cap. Needs one explicit human approval. You cannot grant it yourself." tone="var(--brass)" />
            <Row k="already_entitled" v="The buyer owns it. The existing copy comes back instead of a second charge." />

            <div className="h-notice h-notice-warn" style={{ marginTop: 24 }}>
              <p className="h-body" style={{ fontSize: 14, maxWidth: '62ch' }}>
                Always call <code className="h-data" style={{ color: 'var(--brass)' }}>create_order</code> rather
                than deciding for yourself that something will be refused. The attempt is what gets
                written to the audit ledger — a purchase an agent talked itself out of leaves no
                record of the decision.
              </p>
            </div>
          </Section>

          {/* ══ Tools ═════════════════════════════════════════════════ */}
          <Section id="tools" title="Tool reference" lead="Read live from this deployment's manifest.">
            {manifest?.tools
              ? manifest.tools.map(t => (
                  <div key={t.name} style={{ padding: '13px 0', borderBottom: '1px solid var(--rule)' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <code className="h-data" style={{ color: 'var(--brass)', fontSize: 13 }}>{t.name}</code>
                      <span className="h-data h-faint" style={{ fontSize: 10.5 }}>{t.method} {t.path}</span>
                    </div>
                    {t.input?.length > 0 && (
                      <div className="h-data h-faint" style={{ fontSize: 11, marginTop: 6 }}>
                        input: {t.input.join(', ')}
                      </div>
                    )}
                  </div>
                ))
              : <p className="h-data h-faint">loading…</p>}

            <div className="h-notice" style={{ marginTop: 24, borderLeftColor: 'var(--brass)' }}>
              <p className="h-eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>The tool that is deliberately missing</p>
              <p className="h-body h-muted" style={{ fontSize: 14, maxWidth: '62ch' }}>
                No agent tool can approve spending. An agent that could approve its own over-cap
                purchase would make the gate decoration. Approval comes from a person, through the
                ledger UI or <code className="h-data">POST /api/agent-commerce/approvals</code>, and
                only then can the agent retry.
              </p>
            </div>
          </Section>

          {/* ══ Rules ═════════════════════════════════════════════════ */}
          <Section id="rules" title="The rules"
            lead="An agent decides what to buy. It does not decide whether it may. Every rule below is a plain server-side comparison with no model involved.">
            <Row k="Seller not verified" v="Blocked, at any price." tone="#E8B9A6" />
            <Row k="Not opened to agents" v="Blocked. The seller kept that product to people." tone="#E8B9A6" />
            <Row k="Out of stock" v="Blocked — refused rather than taking money for something undeliverable." tone="#E8B9A6" />
            <Row k="Per transaction" v={<>Over {txnCap} is <strong style={{ color: 'var(--brass)', fontWeight: 400 }}>gated</strong>, not blocked. One human approval, scoped to that item at that price.</>} />
            <Row k="Per session" v={<>Over {sessCap} in total is blocked. No approval can lift it.</>} tone="#E8B9A6" />
            <Row k="Already owned" v="A single-seat licence is returned, not charged for again." />
            <p className="h-body h-muted" style={{ fontSize: 14, marginTop: 22, maxWidth: '62ch' }}>
              Every call is written to the audit trail — the refusals included, each with the reason
              it was refused. Read your session&rsquo;s trail with the{' '}
              <code className="h-data" style={{ color: 'var(--brass)' }}>get_audit_log</code> tool, or watch it
              live on the <Link to="/agent-checkout" style={{ color: 'var(--brass)' }}>ledger</Link>.
            </p>
          </Section>

          {/* ══ REST ══════════════════════════════════════════════════ */}
          <Section id="rest" title="REST API" lead="Everything the MCP server does is also plain HTTP. Same service layer, same guardrails.">
            <Code>{`# Discover the surface (always public, no key needed)
curl ${origin}/api/agent-commerce/manifest

# Search what is open to AI buyers
curl -X POST ${origin}/api/agent-commerce/search \\
  -H 'Content-Type: application/json' \\
  -d '{"agent_session_id":"demo","query":"block print pattern"}'

# Buy: create, authorise, confirm
curl -X POST ${origin}/api/agent-commerce/orders \\
  -H 'Content-Type: application/json' \\
  -d '{"agent_session_id":"demo","product_id":"dp001","buyer_ref":"you@example.com"}'

# Your session's audit trail, refusals included
curl ${origin}/api/agent-commerce/ledger/demo

# What a buyer owns
curl ${origin}/api/shop/library/you@example.com`}</Code>
            <p className="h-body h-muted" style={{ fontSize: 14, maxWidth: '62ch' }}>
              Writes are serialised, so a burst of agents may briefly get a{' '}
              <code className="h-data">503</code> with <code className="h-data">Retry-After</code>. It is
              retryable and means busy, not broken — the MCP client retries automatically. A refusal
              is always an answer with a reason, never an HTTP error.
            </p>
          </Section>

          {/* ══ Status ════════════════════════════════════════════════ */}
          <Section id="status" title="Live status" lead="Read from this deployment as the page loaded.">
            <Row k="Service" v={health ? (health.ok ? 'healthy' : 'degraded') : '…'}
              tone={health?.ok ? 'var(--sage)' : 'var(--ember)'} />
            <Row k="Store" v={health?.store?.driver ?? '…'} />
            <Row k="AI buyer" v={manifest?.ai_buyer?.model ?? health?.ai_buyer ?? '…'} />
            <Row k="Payments" v={manifest?.payment_provider
              ? `${manifest.payment_provider.name} · ${manifest.payment_provider.mode}`
              : '…'} />
            <Row k="Agent auth" v={manifest?.auth?.note ?? '…'} tone={needsKey ? 'var(--brass)' : undefined} />
            <Row k="Per-transaction cap" v={txnCap} />
            <Row k="Session budget" v={sessCap} />

            {manifest?.payment_provider?.mode === 'unconfigured' && (
              <div className="h-notice h-notice-warn" style={{ marginTop: 22 }}>
                <p className="h-body h-muted" style={{ fontSize: 14, maxWidth: '62ch' }}>
                  No Razorpay keys are set on this deployment, so order ids are minted locally and
                  every response and audit row is stamped <code className="h-data">unconfigured</code>.
                  The signature round-trip is still genuinely performed — nothing here is pretending
                  a card was charged.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 26 }}>
              <a className="h-btn h-btn-ghost" href={`${API}/health`} target="_blank" rel="noreferrer">Health endpoint</a>
              <Link className="h-btn h-btn-ghost" to="/ops">Platform activity</Link>
              <Link className="h-btn h-btn-ghost" to="/agent-checkout">Watch an agent buy</Link>
            </div>
          </Section>
        </div>
      </div>

      <style>{`
        @media (min-width: 1000px) {
          .docs-grid { grid-template-columns: 216px minmax(0, 1fr) !important; gap: 56px !important; }
          .docs-nav {
            position: sticky;
            top: calc(var(--nav-height) + 24px);
            align-self: start;
            max-height: calc(100vh - var(--nav-height) - 48px);
            overflow-y: auto;
          }
        }
        @media (max-width: 999px) {
          .docs-nav { display: none; }
        }
      `}</style>
    </div>
  )
}
