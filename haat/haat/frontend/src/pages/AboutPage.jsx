/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useReveal } from '../hooks/useReveal'
import './AboutPage.css'

const STATS = [
  { value: '100+', label: 'Curated Products', sub: 'across 10 categories' },
  { value: '40+', label: 'Countries Served', sub: 'and growing every month' },
  { value: '50+', label: 'Artisan Sellers', sub: 'verified and vetted' },
  { value: '4.8', label: 'Average Rating', sub: 'from 2,000+ orders' },
]

const TEAM = [
  {
    name: 'Arjun Sharma',
    role: 'Co-founder & CEO',
    bio: 'Grew up between Delhi and London. Spent a decade in fintech before starting haat to solve a problem he lived every day.',
    avatar: 'https://source.unsplash.com/220x220/?indian,founder,man&sig=201',
  },
  {
    name: 'Priya Nair',
    role: 'Co-founder & CPO',
    bio: "Former product lead at a major Indian e-commerce company. Built haat's AI agent architecture from the ground up.",
    avatar: 'https://source.unsplash.com/220x220/?indian,founder,woman&sig=202',
  },
  {
    name: 'Rohan Mehta',
    role: 'Head of Seller Partnerships',
    bio: 'Spent five years travelling to artisan clusters in Rajasthan, Bengal, and Tamil Nadu building trusted relationships.',
    avatar: 'https://source.unsplash.com/220x220/?indian,business,man&sig=203',
  },
  {
    name: 'Divya Krishnan',
    role: 'Head of Engineering',
    bio: 'Previously at a top AI startup. Leads the team building the shopping intelligence that powers haat.',
    avatar: 'https://source.unsplash.com/220x220/?indian,engineer,woman&sig=204',
  },
]

const VALUES = [
  {
    title: 'Authenticity first',
    desc: 'Every product comes from verified sellers. No replicas and no shortcuts.',
  },
  {
    title: 'Support artisans',
    desc: 'We prioritize small-batch makers and traditional craft clusters across India.',
  },
  {
    title: 'AI that understands culture',
    desc: 'Our AI understands context, from Kanjivaram versus Banarasi to festival-driven shopping.',
  },
  {
    title: 'Built for diaspora families',
    desc: 'We built this for the moments when you miss home and want trusted familiar choices.',
  },
]

const TIMELINE = [
  {
    year: '2022',
    title: 'The Idea',
    desc: 'A delayed Diwali gift shipment became the spark: buying from India abroad was still too hard and too fragmented.',
  },
  {
    year: '2023',
    title: 'First Sellers',
    desc: 'The team worked on ground across Jaipur, Varanasi, and Kolkata to onboard trusted craft and food merchants.',
  },
  {
    year: '2024',
    title: 'AI Launch',
    desc: 'haat AI launched to translate natural language requests into culturally relevant product discovery.',
  },
  {
    year: '2025',
    title: 'Global Scale',
    desc: 'Serving 40+ countries with a growing mission: bring home closer for every Indian family abroad.',
  },
]

function fallbackPhoto(seed, width = 220, height = 220) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`
}

function StatCard({ value, label, sub, i }) {
  return (
    <article className="about-flow-stat reveal-child fx-soft-card" style={{ transitionDelay: `${i * 70}ms` }}>
      <p className="about-flow-stat-value">{value}</p>
      <p className="about-flow-stat-label">{label}</p>
      <p className="about-flow-stat-sub">{sub}</p>
    </article>
  )
}

function TeamCard({ person, i }) {
  const backup = fallbackPhoto(`team-${person.name}`)
  const [src, setSrc] = useState(person.avatar)

  return (
    <article className="about-flow-team-card reveal-child fx-soft-card" style={{ transitionDelay: `${i * 85}ms` }}>
      <img
        src={src}
        alt={person.name}
        className="about-flow-team-avatar"
        onError={e => {
          if (e.currentTarget.dataset.fbApplied === '1') return
          e.currentTarget.dataset.fbApplied = '1'
          setSrc(backup)
        }}
      />
      <div>
        <p className="about-flow-team-name">{person.name}</p>
        <p className="about-flow-team-role">{person.role}</p>
      </div>
      <p className="about-flow-team-bio">{person.bio}</p>
    </article>
  )
}

export default function AboutPage() {
  const heroRef = useReveal(0.1)
  const originRef = useReveal(0.12)
  const statsRef = useReveal(0.15)
  const timelineRef = useReveal(0.12)
  const valuesRef = useReveal(0.12)
  const teamRef = useReveal(0.12)
  const ctaRef = useReveal(0.1)

  return (
    <div className="about-flow-page">
      <div className="about-flow-orb about-flow-orb-a" aria-hidden="true" />
      <div className="about-flow-orb about-flow-orb-b" aria-hidden="true" />

      <svg className="about-flow-ring" viewBox="0 0 420 420" aria-hidden="true">
        <defs>
          <path
            id="about-flow-circle-path"
            d="M210,210 m-156,0 a156,156 0 1,1 312,0 a156,156 0 1,1 -312,0"
          />
        </defs>
        <text>
          <textPath href="#about-flow-circle-path">
            home should feel close - culture should travel - good things should stay familiar -
          </textPath>
        </text>
      </svg>

      <div className="about-flow-ribbon" aria-hidden="true">
        <span>authentic products • trusted sellers • ai that gets cultural nuance •</span>
      </div>

      <section ref={heroRef} className="about-flow-hero">
        <p className="about-flow-pill reveal-child">
          <span className="about-flow-pill-dot" />
          <span>Story of haat</span>
        </p>

        <h1 className="about-flow-title reveal-child">
          <span className="about-flow-title-soft">Do not browse,</span>{' '}
          <span className="about-flow-title-strong">speak and discover</span>
        </h1>

        <p className="about-flow-subtitle reveal-child">
          We built haat so diaspora families can describe what they miss in natural language and get clear,
          trustworthy product picks that feel like home.
        </p>

        <div className="about-flow-cta reveal-child">
          <Link to="/chat" className="about-flow-btn about-flow-btn-primary fx-glow-button">
            Start with haat AI
          </Link>
          <Link to="/search" className="about-flow-btn about-flow-btn-secondary fx-glow-button">
            Explore products
          </Link>
        </div>

        <p className="about-flow-availability reveal-child">Serving families across Mac, Windows, iPhone, and Android workflows</p>
      </section>

      <section ref={originRef} className="about-flow-origin-wrap">
        <div className="about-flow-origin reveal-child fx-soft-card">
          <div>
            <p className="about-flow-kicker">Why we built this</p>
            <h2 className="about-flow-section-title">
              Because home is a feeling, <span>not just a place</span>
            </h2>
            <p className="about-flow-copy">
              More than 32 million Indians live abroad. Families build new lives while trying to keep language,
              rituals, food, and craftsmanship close.
            </p>
            <p className="about-flow-copy">
              haat brings that familiarity back with seller-vetted products and an AI guide that understands cultural context.
            </p>
          </div>

          <aside className="about-flow-quote-card">
            <blockquote>
              "I wanted my daughter in Toronto to taste the same Diwali laddoos I grew up with in Jaipur.
              That should not be hard. With haat, now it is not."
            </blockquote>
            <p>Arjun Sharma, co-founder</p>
          </aside>
        </div>
      </section>

      <section ref={statsRef} className="about-flow-stats-wrap">
        <div className="about-flow-stats-grid">
          {STATS.map((s, i) => (
            <StatCard key={s.label} {...s} i={i} />
          ))}
        </div>
      </section>

      <section id="timeline" ref={timelineRef} className="about-flow-timeline-wrap">
        <div className="about-flow-section-shell">
          <div className="about-flow-section-head reveal-child">
            <p className="about-flow-kicker">Our journey</p>
            <h2 className="about-flow-section-title">From frustration to platform</h2>
          </div>

          <div className="about-flow-timeline-grid">
            {TIMELINE.map((t, i) => (
              <article key={t.year} className="about-flow-timeline-card reveal-child fx-soft-card" style={{ transitionDelay: `${i * 75}ms` }}>
                <p className="about-flow-year">{t.year}</p>
                <div className="about-flow-year-rule" />
                <p className="about-flow-timeline-title">{t.title}</p>
                <p className="about-flow-timeline-desc">{t.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section ref={valuesRef} className="about-flow-values-wrap">
        <div className="about-flow-section-shell">
          <div className="about-flow-section-head reveal-child">
            <p className="about-flow-kicker">What we believe</p>
            <h2 className="about-flow-section-title">Our principles</h2>
          </div>

          <div className="about-flow-values-grid">
            {VALUES.map((v, i) => (
              <article key={v.title} className="about-flow-value-card reveal-child fx-soft-card" style={{ transitionDelay: `${i * 70}ms` }}>
                <span className="about-flow-value-index">{i + 1}</span>
                <p className="about-flow-value-title">{v.title}</p>
                <p className="about-flow-value-desc">{v.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section ref={teamRef} className="about-flow-team-wrap">
        <div className="about-flow-section-shell">
          <div className="about-flow-section-head reveal-child">
            <p className="about-flow-kicker">The people</p>
            <h2 className="about-flow-section-title">Built by diaspora, for diaspora</h2>
          </div>

          <div className="about-flow-team-grid">
            {TEAM.map((p, i) => (
              <TeamCard key={p.name} person={p} i={i} />
            ))}
          </div>
        </div>
      </section>

      <section ref={ctaRef} className="about-flow-cta-wrap">
        <div className="about-flow-cta-panel reveal-child fx-soft-card">
          <h2>Ready to find something from home?</h2>
          <p>
            Tell haat AI what you need in your own words. It handles nuance, intent, and cultural specifics.
          </p>
          <Link to="/chat" className="about-flow-btn about-flow-btn-primary fx-glow-button">
            Start chatting with haat
          </Link>
        </div>
      </section>
    </div>
  )
}
