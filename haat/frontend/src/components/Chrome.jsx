import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { useBuyer } from '../contexts/BuyerContext'

/* ═══════════════════════════════════════════════════════════════════════════
   Nav and Footer.

   The wordmark is the only place Bodoni Moda appears at nav scale; everything
   else in the bar is small-caps Jost, so the mark reads as a mark rather than
   as the first item in a list.
   ═══════════════════════════════════════════════════════════════════════════ */

const LINKS = [
  { to: '/catalogue', label: 'Catalogue' },
  { to: '/agent-checkout', label: 'Agent checkout' },
  { to: '/seller', label: 'Sell' },
]

export function Nav() {
  const { count } = useCart()
  const { buyer } = useBuyer()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(globalThis.scrollY > 12)
    onScroll()
    globalThis.addEventListener('scroll', onScroll, { passive: true })
    return () => globalThis.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  const linkStyle = ({ isActive }) => ({
    fontSize: 12,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: isActive ? 'var(--brass)' : 'var(--muted)',
    paddingBottom: 3,
    borderBottom: `1px solid ${isActive ? 'var(--brass)' : 'transparent'}`,
    transition: 'color 160ms var(--ease), border-color 160ms var(--ease)',
  })

  return (
    <header
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        height: 'var(--nav-height)',
        background: scrolled ? 'rgba(15,13,10,0.94)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'var(--rule)' : 'transparent'}`,
        transition: 'background 240ms var(--ease), border-color 240ms var(--ease)',
      }}
    >
      <div className="h-wrap" style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 28 }}>
        <Link to="/" aria-label="haat — home" style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <span className="h-title" style={{ fontSize: 27, letterSpacing: '-0.02em' }}>haat</span>
          <span className="h-data h-faint" style={{ fontSize: 9.5, letterSpacing: '0.22em' }}>DIGITAL</span>
        </Link>

        <nav style={{ display: 'flex', gap: 26, marginLeft: 'auto' }} className="h-nav-links">
          {LINKS.map(l => (
            <NavLink key={l.to} to={l.to} style={linkStyle}>{l.label}</NavLink>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <NavLink to="/library" style={linkStyle} className="h-nav-links">Library</NavLink>
          <Link to="/cart" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: count ? 'var(--brass)' : 'var(--muted)' }}>
            Cart
            <span className="h-data" style={{
              minWidth: 20, textAlign: 'center', padding: '1px 5px',
              border: `1px solid ${count ? 'var(--brass)' : 'var(--rule)'}`,
              fontSize: 11,
            }}>{count}</span>
          </Link>
          <button className="h-nav-toggle" onClick={() => setOpen(o => !o)} aria-label="Menu" aria-expanded={open}
            style={{ display: 'none', color: 'var(--parchment)' }}>
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.4">
              {open ? <><line x1="3" y1="2" x2="17" y2="12" /><line x1="17" y1="2" x2="3" y2="12" /></>
                    : <><line x1="0" y1="2" x2="20" y2="2" /><line x1="0" y1="12" x2="20" y2="12" /></>}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div style={{ background: 'var(--ink-raised)', borderBottom: '1px solid var(--rule)', padding: '12px var(--gutter) 20px' }}>
          {[...LINKS, { to: '/library', label: 'Library' }].map(l => (
            <NavLink key={l.to} to={l.to}
              style={{ display: 'block', padding: '11px 0', fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--rule)' }}>
              {l.label}
            </NavLink>
          ))}
          {buyer && <p className="h-data h-faint" style={{ paddingTop: 12 }}>signed in as {buyer}</p>}
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .h-nav-links { display: none !important; }
          .h-nav-toggle { display: block !important; }
        }
      `}</style>
    </header>
  )
}

export function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--rule)', marginTop: 96, background: 'var(--ink-sunken)' }}>
      <div className="h-wrap" style={{ padding: '52px 0 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 36 }}>
          <div>
            <div className="h-title" style={{ fontSize: 30, marginBottom: 12 }}>haat</div>
            <p className="h-body h-muted" style={{ fontSize: 14, maxWidth: '30ch' }}>
              Digital goods made by Indian craftspeople. Delivered the moment they are paid for —
              to a person, or to their agent.
            </p>
          </div>

          <div>
            <div className="h-eyebrow" style={{ marginBottom: 14 }}>Shop</div>
            {[['Catalogue', '/catalogue'], ['Your library', '/library'], ['Cart', '/cart']].map(([l, to]) => (
              <Link key={to} to={to} style={{ display: 'block', padding: '5px 0', fontSize: 14, color: 'var(--muted)' }}>{l}</Link>
            ))}
          </div>

          <div>
            <div className="h-eyebrow" style={{ marginBottom: 14 }}>For agents</div>
            {[['Documentation', '/docs'], ['Agent checkout', '/agent-checkout'], ['Platform activity', '/ops'], ['Sell on haat', '/seller']].map(([l, to]) => (
              <Link key={to} to={to} style={{ display: 'block', padding: '5px 0', fontSize: 14, color: 'var(--muted)' }}>{l}</Link>
            ))}
            <a href="/api/agent-commerce/manifest" style={{ display: 'block', padding: '5px 0', fontSize: 14, color: 'var(--muted)' }}>
              Tool manifest
            </a>
          </div>

          <div>
            <div className="h-eyebrow" style={{ marginBottom: 14 }}>Legal</div>
            {[['Privacy', '/privacy'], ['Terms', '/terms']].map(([l, to]) => (
              <Link key={to} to={to} style={{ display: 'block', padding: '5px 0', fontSize: 14, color: 'var(--muted)' }}>{l}</Link>
            ))}
          </div>
        </div>

        {/* Docs get a button rather than a link in a list: it is the one page
            that answers "how do I use this", for a shopper and for whoever is
            wiring up an agent, and it should be findable without hunting. */}
        <div style={{
          marginTop: 40, padding: '22px 24px', border: '1px solid var(--rule)',
          background: 'var(--ink-raised)', display: 'flex', gap: 20,
          alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
        }}>
          <div>
            <div className="h-sub" style={{ fontSize: 19, marginBottom: 5 }}>Using haat</div>
            <p className="h-body h-muted" style={{ fontSize: 13.5, maxWidth: '48ch' }}>
              Buying, selling, and connecting an AI agent over MCP — with this deployment&rsquo;s
              real limits, tools and status.
            </p>
          </div>
          <Link to="/docs" className="h-btn" style={{ whiteSpace: 'nowrap' }}>
            Read the docs
          </Link>
        </div>

        <div style={{ marginTop: 34, paddingTop: 20, borderTop: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <span className="h-data h-faint">© 2026 haat · every sale recorded in the ledger</span>
          <span className="h-data h-faint">Payments by Razorpay · prices in INR</span>
        </div>
      </div>
    </footer>
  )
}
