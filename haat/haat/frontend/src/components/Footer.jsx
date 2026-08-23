/* eslint-disable react/prop-types */
import { Link } from 'react-router-dom'
import { useReveal } from '../hooks/useReveal'
import BrandMark from './BrandMark'
import './Footer.css'

const SHOP_LINKS = [
  ['All Products', '/search'],
  ['Sweets & Mithais', '/search?category=sweets'],
  ['Clothing', '/search?category=clothing'],
  ['Sarees', '/search?category=sarees'],
  ['Spices & Masalas', '/search?category=spices'],
  ['Handicrafts', '/search?category=handicrafts'],
  ['Gift Collections', '/search?q=gift'],
  ['Festival Specials', '/search?q=festival'],
]

const COMPANY_LINKS = [
  ['About haat', '/about'],
  ['Our Story', '/about#timeline'],
  ['Markets', '/markets'],
  ['Chat with haat', '/chat'],
]

const LEGAL_LINKS = [
  ['Privacy Policy', '/privacy'],
  ['Terms of Use', '/terms'],
  ['Contact Us', 'mailto:hello@haat.in'],
]

function FooterLink({ to, children }) {
  const external = to.startsWith('mailto:') || to.startsWith('http')
  if (external) return <a href={to}>{children}</a>
  return <Link to={to}>{children}</Link>
}

function SocialLink({ href, label, icon }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} className="lux-footer-social-btn">
      {icon}
    </a>
  )
}

export default function Footer() {
  const revealRef = useReveal(0.06)

  return (
    <footer className="lux-footer">
      <div className="lux-footer-bg" aria-hidden="true" />
      <div ref={revealRef} className="lux-footer-inner">
        <section className="lux-footer-hero reveal-child fx-soft-card">
          <div>
            <p className="lux-footer-kicker">Built for diaspora families</p>
            <h3>Home should feel one prompt away.</h3>
            <p className="lux-footer-copy">
              A warm, intelligent marketplace that understands culture, occasion, and quality before it shows you results.
            </p>
          </div>
          <Link to="/chat" className="lux-footer-hero-cta fx-glow-button">
            Start with haat AI
          </Link>
        </section>

        <section className="lux-footer-newsletter reveal-child">
          <div>
            <h4>Festival drops and new market finds</h4>
            <p>Curated by AI and reviewed by real people.</p>
          </div>
          <div className="lux-footer-newsletter-form">
            <input type="email" placeholder="you@example.com" aria-label="Email" />
            <button type="button" className="fx-glow-button">Notify me</button>
          </div>
        </section>

        <section className="lux-footer-grid reveal-child">
          <div className="lux-footer-brand-col">
            <Link to="/" aria-label="Go to home">
              <BrandMark size="sm" light={false} />
            </Link>
            <p>Connecting the Indian diaspora to authentic local markets with intelligent discovery.</p>
            <div className="lux-footer-social-row">
              <SocialLink
                href="https://instagram.com"
                label="Instagram"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>}
              />
              <SocialLink
                href="https://twitter.com"
                label="Twitter"
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>}
              />
              <SocialLink
                href="https://youtube.com"
                label="YouTube"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12z" /></svg>}
              />
              <SocialLink
                href="https://linkedin.com"
                label="LinkedIn"
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" /><circle cx="4" cy="4" r="2" /></svg>}
              />
            </div>
          </div>

          <div>
            <h5>Shop</h5>
            {SHOP_LINKS.map(([label, to]) => <FooterLink key={label} to={to}>{label}</FooterLink>)}
          </div>

          <div>
            <h5>Company</h5>
            {COMPANY_LINKS.map(([label, to]) => <FooterLink key={label} to={to}>{label}</FooterLink>)}
          </div>

          <div>
            <h5>Legal</h5>
            {LEGAL_LINKS.map(([label, to]) => <FooterLink key={label} to={to}>{label}</FooterLink>)}
          </div>
        </section>

        <section className="lux-footer-bottom reveal-child">
          <span>Copyright 2026 haat. Built for the Indian diaspora worldwide.</span>
          <div className="lux-footer-pills">
            <span>TinyFish</span>
            <span>ElevenLabs</span>
            <span>Claude AI</span>
          </div>
        </section>
      </div>
    </footer>
  )
}
