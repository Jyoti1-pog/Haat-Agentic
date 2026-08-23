import { useNavigate, useLocation } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'

// ── BottomNav ──────────────────────────────────────────────────────────────────
// Visible ONLY on mobile (< 768px). Hidden on desktop via CSS.
// 5-tab layout: Home | Search | [AI FAB] | Cart | Profile

function HomeIcon()    { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function SearchIcon()  { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function SparkleIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg> }
function BagIcon()     { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> }
function SettingsIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { count } = useCart()

  function isActive(path) {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  function handleAI() {
    navigate('/')
    // Dispatch event so HomePage can focus search
    setTimeout(() => window.dispatchEvent(new CustomEvent('haat:focus-search')), 100)
  }

  function Tab({ path, icon, label, onClick }) {
    const active = isActive(path)
    return (
      <button
        onClick={onClick || (() => navigate(path))}
        style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '3px',
          padding:        '8px 4px 4px',
          background:     'none',
          border:         'none',
          color:          active ? 'var(--brand-saffron)' : 'var(--text-tertiary)',
          cursor:         'pointer',
          transition:     'transform 150ms var(--ease-spring), color 150ms ease',
          WebkitTapHighlightColor: 'transparent',
        }}
        onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.90)' }}
        onPointerUp={e =>   { e.currentTarget.style.transform = 'scale(1)' }}
        onPointerCancel={e =>{ e.currentTarget.style.transform = 'scale(1)' }}
      >
        {icon}
        <span style={{ fontSize: '10px', fontWeight: active ? 600 : 400, letterSpacing: '0.02em', lineHeight: 1 }}>
          {label}
        </span>
      </button>
    )
  }

  return (
    <>
      {/* ── Bottom nav (mobile only) ───────────────── */}
      <div className="bottom-nav" style={{
        position:         'fixed',
        bottom:            0,
        left:              0,
        right:             0,
        height:           'calc(60px + env(safe-area-inset-bottom))',
        paddingBottom:    'env(safe-area-inset-bottom)',
        background:       'rgba(17,17,17,0.97)',
        backdropFilter:   'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop:        '1px solid var(--border-faint)',
        display:          'flex',
        alignItems:       'flex-start',
        justifyContent:   'space-around',
        zIndex:            150,
      }}>
        <Tab path="/" icon={<HomeIcon />}    label="Home" />
        <Tab path="/search" icon={<SearchIcon />} label="Search" />

        {/* ── CENTER AI FAB ──────────────────────── */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '8px', position: 'relative' }}>
          <button
            onClick={handleAI}
            style={{
              position:       'absolute',
              top:            '-22px',
              left:           '50%',
              transform:      'translateX(-50%)',
              width:          '52px',
              height:         '52px',
              borderRadius:   '50%',
              background:     'linear-gradient(135deg, var(--brand-saffron) 0%, var(--brand-gold) 100%)',
              boxShadow:      '0 4px 16px rgba(249,115,22,0.40), 0 0 0 3px var(--bg-base)',
              border:         'none',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              cursor:         'pointer',
              transition:     'transform 150ms var(--ease-spring), box-shadow 150ms ease',
              WebkitTapHighlightColor: 'transparent',
            }}
            onPointerDown={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(0.90)' }}
            onPointerUp={e =>   { e.currentTarget.style.transform = 'translateX(-50%) scale(1)' }}
            onPointerCancel={e =>{ e.currentTarget.style.transform = 'translateX(-50%) scale(1)' }}
            aria-label="AI Search"
          >
            <SparkleIcon />
          </button>
        </div>

        {/* ── Cart tab with badge ─────────────────── */}
        <button
          onClick={() => navigate('/cart')}
          style={{
            flex:           1,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '3px',
            padding:        '8px 4px 4px',
            background:     'none',
            border:         'none',
            color:          isActive('/cart') ? 'var(--brand-saffron)' : 'var(--text-tertiary)',
            cursor:         'pointer',
            position:       'relative',
            transition:     'transform 150ms var(--ease-spring), color 150ms ease',
            WebkitTapHighlightColor: 'transparent',
          }}
          onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.90)' }}
          onPointerUp={e =>   { e.currentTarget.style.transform = 'scale(1)' }}
          onPointerCancel={e =>{ e.currentTarget.style.transform = 'scale(1)' }}
        >
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <BagIcon />
            {count > 0 && (
              <span style={{
                position:       'absolute',
                top:            '-4px',
                right:          '-4px',
                width:          '8px',
                height:         '8px',
                borderRadius:   '50%',
                background:     'var(--brand-saffron)',
                border:         '1.5px solid var(--bg-base)',
              }} />
            )}
          </div>
          <span style={{ fontSize: '10px', fontWeight: isActive('/cart') ? 600 : 400, letterSpacing: '0.02em', lineHeight: 1 }}>
            Cart
          </span>
        </button>

        <Tab path="/settings" icon={<SettingsIcon />} label="Settings" />
      </div>

      {/* ── Body padding so page content doesn't hide under nav ── */}
      <div className="bottom-nav-spacer" style={{ height: 'calc(60px + env(safe-area-inset-bottom))' }} />

      <style>{`
        /* Desktop: hide bottom nav */
        @media (min-width: 768px) {
          .bottom-nav, .bottom-nav-spacer { display: none !important; }
        }
      `}</style>
    </>
  )
}
