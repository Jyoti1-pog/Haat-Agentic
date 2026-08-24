/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { searchProducts } from '../lib/api'
import './HomePage.css'

const PROMPTS = [
  'Diwali sweets for my parents',
  'Kanjivaram saree for a wedding',
  'Darjeeling tea gift box',
  'Kashmiri dry fruits under 3000',
]

const STATS = [
  { value: '500+', label: 'Local Markets' },
  { value: '40+', label: 'Countries Served' },
  { value: '4.9', label: 'Average Rating' },
  { value: '10k+', label: 'Happy Families' },
]

const CATEGORIES = [
  { slug: 'sweets', label: 'Sweets', image: 'https://media.istockphoto.com/id/1054228718/photo/indian-sweets-in-a-plate-includes-gulab-jamun-rasgulla-kaju-katli-morichoor-bundi-laddu.jpg?s=1024x1024&w=is&k=20&c=zuHus6q049UchR1NkljCmCehsB-Ty8k_k_oO8J08y0E=' },
  { slug: 'sarees', label: 'Sarees', image: 'https://images.unsplash.com/photo-1727430228383-aa1fb59db8bf?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' },
  { slug: 'spices', label: 'Spices', image: 'https://plus.unsplash.com/premium_photo-1692776206795-60a58a4dc817?q=80&w=1028&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' },
  { slug: 'handicrafts', label: 'Handicrafts', image: 'https://images.unsplash.com/photo-1755452540290-74f52106e4f5?q=80&w=688&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' },
]

function fallbackPhoto(seed, width = 900, height = 1200) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`
}

function StatCard({ stat }) {
  return (
    <article className="flow-home-stat fx-soft-card">
      <p className="flow-home-stat-value">{stat.value}</p>
      <p className="flow-home-stat-label">{stat.label}</p>
    </article>
  )
}

function CategoryCard({ item, onOpen }) {
  const backup = fallbackPhoto(`home-cat-${item.slug}`)
  const [src, setSrc] = useState(item.image)

  return (
    <button
      type="button"
      className="flow-home-category fx-soft-card"
      onClick={() => onOpen(item.slug)}
      aria-label={`Browse ${item.label}`}
    >
      <img
        src={src}
        alt={item.label}
        onError={e => {
          if (e.currentTarget.dataset.fbApplied === '1') return
          e.currentTarget.dataset.fbApplied = '1'
          setSrc(backup)
        }}
      />
      <div className="flow-home-category-overlay" />
      <div className="flow-home-category-content">
        <p>{item.label}</p>
        <span>Explore</span>
      </div>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="flow-home-skeleton-card">
      <div className="skeleton" style={{ aspectRatio: '3/4' }} />
      <div className="flow-home-skeleton-lines">
        <div className="skeleton" style={{ height: '14px', width: '84%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '12px', width: '60%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '34px', width: '100%', borderRadius: '8px', marginTop: '8px' }} />
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    searchProducts('featured Indian products', null)
      .then(data => setFeatured((data.products ?? []).slice(0, 8)))
      .catch(() => setFeatured([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flow-home-page">
      <div className="flow-home-top-strip">
        <p>
          Now live on Android - free and unlimited during launch
          {' '}
          <span>Download now</span>
        </p>
      </div>

      <section className="flow-home-hero">
        <div className="flow-home-orb flow-home-orb-a" aria-hidden="true" />
        <div className="flow-home-orb flow-home-orb-b" aria-hidden="true" />

        <svg className="flow-home-ring" viewBox="0 0 420 420" aria-hidden="true">
          <defs>
            <path id="flow-home-circle-path" d="M210,210 m-156,0 a156,156 0 1,1 312,0 a156,156 0 1,1 -312,0" />
          </defs>
          <text>
            <textPath href="#flow-home-circle-path">voice commerce - natural language shopping - culturally fluent AI -</textPath>
          </text>
        </svg>

        <div className="flow-home-ribbon" aria-hidden="true">
          <span>"best kaju katli for diwali in london" • "kanjivaram under 10k" •</span>
        </div>

        <div className="flow-home-hero-inner">
          <p className="flow-home-pill">
            <span className="flow-home-pill-dot" />
            {' '}
            AI shopping assistant
          </p>

          <h1 className="flow-home-title">
            <span className="flow-home-title-soft">Do not search,</span>{' '}
            <span className="flow-home-title-strong">just speak</span>
          </h1>

          <p className="flow-home-subtitle">
            The voice-to-text shopping AI that turns your request into clear, trustworthy Indian product picks in every app.
          </p>

          <div className="flow-home-cta">
            <Link to="/chat" className="flow-home-btn flow-home-btn-primary fx-glow-button">
              Start with haat AI
            </Link>
            <Link to="/search" className="flow-home-btn flow-home-btn-secondary fx-glow-button">
              Browse products
            </Link>
          </div>

          <p className="flow-home-availability">Available for families across Mac, Windows, iPhone, and Android workflows</p>

          <div className="flow-home-prompt-list">
            {PROMPTS.map(prompt => (
              <button
                key={prompt}
                type="button"
                onClick={() => navigate(`/chat?q=${encodeURIComponent(prompt)}`)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flow-home-stats-wrap">
        <div className="flow-home-stats-grid">
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} stat={stat} i={i} />
          ))}
        </div>
      </section>

      <section className="flow-home-categories-wrap">
        <div className="flow-home-section-head">
          <p>Shop by category</p>
          <h2>Everything India makes.</h2>
        </div>

        <div className="flow-home-categories-grid">
          {CATEGORIES.map((item, i) => (
            <CategoryCard key={item.slug} item={item} i={i} onOpen={slug => navigate(`/search?category=${slug}`)} />
          ))}
        </div>
      </section>

      <section className="flow-home-featured-wrap">
        <div className="flow-home-section-head">
          <p>Featured now</p>
          <h2>Picked by AI, loved by families.</h2>
        </div>

        <div className="flow-home-products-grid">
          {loading
            ? Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)
            : featured.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
        </div>
      </section>

      <section className="flow-home-final-cta-wrap">
        <div className="flow-home-final-cta fx-soft-card">
          <h2>Bring home closer in one prompt.</h2>
          <p>Tell haat what you need, in your own words. We will do the market work for you.</p>
          <Link to="/chat" className="flow-home-btn flow-home-btn-primary fx-glow-button">
            Start chatting
          </Link>
        </div>
      </section>
    </div>
  )
}
