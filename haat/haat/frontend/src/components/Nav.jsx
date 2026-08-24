/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import BrandMark from './BrandMark'
import './Nav.css'

const NAV_LINKS = [
  { label: 'Markets', path: '/markets' },
  { label: 'About', path: '/about' },
]

function useScrollY() {
  const [y, setY] = useState(0)
  useEffect(() => {
    const handler = () => setY(window.scrollY)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
  return y
}

function ThemeIcon({ theme }) {
  if (theme === 'dark') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
        <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
    )
  }

  if (theme === 'light') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    )
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

export default function Nav() {
  const { count } = useCart()
  const { user, logout } = useAuth()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const scrollY = useScrollY()

  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [query, setQuery] = useState('')

  const searchRef = useRef(null)
  const avatarRef = useRef(null)

  const isLight = resolvedTheme === 'light'
  const scrolled = scrollY > 8

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus()
  }, [searchOpen])

  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setAvatarOpen(false)
      }
    }
    globalThis.addEventListener('keydown', handler)
    return () => globalThis.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!avatarOpen) return
    const handler = e => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [avatarOpen])

  function cycleTheme() {
    const order = ['dark', 'light', 'system']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearchOpen(false)
    setQuery('')
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  const initials = (user?.name ?? user?.email ?? '?').slice(0, 1).toUpperCase()

  return (
    <>
      <nav className={`lux-nav ${isLight ? 'is-light' : 'is-dark'} ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="lux-nav-glow" aria-hidden="true" />
        <div className="lux-nav-inner">
          <Link to="/" className="lux-nav-brand" aria-label="Go to home">
            <BrandMark size="md" light={false} />
            <span className="lux-nav-brand-tag">Indian Marketplace</span>
          </Link>

          <div className="lux-nav-center" aria-label="Main navigation">
            {NAV_LINKS.map(link => {
              const active = location.pathname === link.path
              return (
                <Link key={link.path} to={link.path} className={`lux-nav-link ${active ? 'is-active' : ''}`}>
                  {link.label}
                </Link>
              )
            })}
          </div>

          <div className="lux-nav-right">
            <button className="lux-icon-btn" onClick={cycleTheme} aria-label={`Switch theme (${theme})`}>
              <ThemeIcon theme={theme} />
            </button>

            <button className="lux-icon-btn" onClick={() => setSearchOpen(true)} aria-label="Open search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            <Link to="/cart" className="lux-icon-btn lux-cart-btn" aria-label={`Cart (${count} items)`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {count > 0 && <span className="lux-cart-badge">{count > 9 ? '9+' : count}</span>}
            </Link>

            <Link to="/chat" className="lux-nav-chat fx-glow-button">
              Talk to haat AI
            </Link>

            {user ? (
              <div ref={avatarRef} className="lux-avatar-wrap">
                <button className="lux-avatar-btn" onClick={() => setAvatarOpen(o => !o)} aria-expanded={avatarOpen}>
                  <span className="lux-avatar-badge">{initials}</span>
                  <span className="lux-avatar-label">{user.name?.split(' ')[0] ?? 'Account'}</span>
                  <svg className={avatarOpen ? 'is-open' : ''} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {avatarOpen && (
                  <div className="lux-avatar-menu">
                    <div className="lux-avatar-menu-head">
                      <p>{user.name ?? 'You'}</p>
                      <span>{user.email}</span>
                    </div>
                    <button onClick={() => { navigate('/chat'); setAvatarOpen(false) }}>Chat with haat</button>
                    <button onClick={() => { navigate('/settings'); setAvatarOpen(false) }}>Settings</button>
                    <button className="danger" onClick={() => { logout(); setAvatarOpen(false) }}>Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="lux-nav-auth-link">Log in</Link>
                <Link to="/signup" className="lux-nav-auth-cta fx-glow-button">Sign up</Link>
              </>
            )}

            <button className={`lux-hamburger ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </nav>

      <aside className={`lux-mobile-panel ${menuOpen ? 'open' : ''} ${isLight ? 'is-light' : 'is-dark'}`}>
        <div className="lux-mobile-panel-head">
          <BrandMark size="sm" light={false} />
          <span>Menu</span>
        </div>

        <Link to="/chat" className="lux-mobile-highlight">Talk to haat AI</Link>
        {NAV_LINKS.map(link => (
          <Link key={link.path} to={link.path} className={location.pathname === link.path ? 'is-active' : ''}>
            {link.label}
          </Link>
        ))}

        {user ? (
          <>
            <button type="button" onClick={() => { navigate('/settings'); setMenuOpen(false) }}>Settings</button>
            <button type="button" className="danger" onClick={() => { logout(); setMenuOpen(false) }}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/signup" className="lux-mobile-signup">Sign up</Link>
          </>
        )}
      </aside>

      {searchOpen && (
        <div className="lux-search-overlay">
          <button type="button" className="lux-search-dismiss" aria-label="Close search" onClick={() => setSearchOpen(false)} />
          <div className="lux-search-panel">
            <form onSubmit={handleSearchSubmit}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search Indian markets..."
                aria-label="Search products"
              />
              <button type="button" className="lux-search-esc" onClick={() => setSearchOpen(false)}>ESC</button>
            </form>
            <p>Try: Kanjivaram saree, Diwali sweets, Kashmir dry fruits</p>
          </div>
        </div>
      )}
    </>
  )
}
