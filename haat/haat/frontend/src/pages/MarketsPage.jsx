import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useReveal } from '../hooks/useReveal'

const MARKETS = [
  {
    city: 'Jaipur',
    state: 'Rajasthan',
    market: 'Johari Bazaar',
    specialty: ['Gemstones', 'Textiles', 'Lac Jewellery'],
    desc: "The pink city's legendary market for precious gems, Rajasthani textiles, and hand-crafted lac bangles.",
    image: 'https://source.unsplash.com/1200x800/?jaipur,bazaar,jewellery&sig=101',
    query: 'Jaipur handicrafts and jewellery',
    color: '#F97316',
  },
  {
    city: 'Delhi',
    state: 'NCT',
    market: 'Chandni Chowk',
    specialty: ['Spices', 'Silver', 'Street Food'],
    desc: "Old Delhi's iconic bazaar - a labyrinth of spice merchants, silversmiths, and century-old sweet shops.",
    image: 'https://source.unsplash.com/1200x800/?old-delhi,market,spices&sig=102',
    query: 'Delhi spices and silver',
    color: '#EF4444',
  },
  {
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    market: 'Vishwanath Gali',
    specialty: ['Banarasi Silk', 'Brass Crafts', 'Rudraksha'],
    desc: 'Centuries of weaving tradition live in these narrow lanes, home to the finest Banarasi silk sarees.',
    image: 'https://source.unsplash.com/1200x800/?varanasi,silk,weaving&sig=103',
    query: 'Banarasi silk sarees Varanasi',
    color: '#7C3AED',
  },
  {
    city: 'Kolkata',
    state: 'West Bengal',
    market: 'New Market',
    specialty: ['Mishti', 'Cotton Sarees', 'Handicrafts'],
    desc: "Kolkata's beloved New Market - from delicate mishti doi to fine muslin and terracotta crafts.",
    image: 'https://source.unsplash.com/1200x800/?kolkata,bazaar,sweets&sig=104',
    query: 'Kolkata sweets and Bengali handicrafts',
    color: '#F59E0B',
  },
  {
    city: 'Mumbai',
    state: 'Maharashtra',
    market: 'Zaveri Bazaar',
    specialty: ['Gold Jewellery', 'Diamonds', 'Silver'],
    desc: "India's largest jewellery hub - a glittering warren of goldsmiths trading since the 1800s.",
    image: 'https://source.unsplash.com/1200x800/?mumbai,jewellery,gold&sig=105',
    query: 'gold jewellery Mumbai',
    color: '#10B981',
  },
  {
    city: 'Chennai',
    state: 'Tamil Nadu',
    market: 'T. Nagar',
    specialty: ['Silk Sarees', 'Temple Jewellery', 'Spices'],
    desc: 'T. Nagar is the mecca for Kanjivaram silk - every hue, every zari pattern, from heritage weavers.',
    image: 'https://source.unsplash.com/1200x800/?chennai,saree,market&sig=106',
    query: 'Kanjivaram silk sarees Chennai',
    color: '#06B6D4',
  },
  {
    city: 'Hyderabad',
    state: 'Telangana',
    market: 'Laad Bazaar',
    specialty: ['Pearls', 'Lac Bangles', 'Biryani Spices'],
    desc: "Next to Charminar, this 400-year-old bazaar is the heartbeat of Hyderabad's pearl and bangle trade.",
    image: 'https://source.unsplash.com/1200x800/?hyderabad,bangles,pearls&sig=107',
    query: 'Hyderabad pearls and bangles',
    color: '#EC4899',
  },
  {
    city: 'Amritsar',
    state: 'Punjab',
    market: 'Hall Bazaar',
    specialty: ['Phulkari', 'Dry Fruits', 'Punjabi Jutti'],
    desc: "Golden Temple city's market - vibrant phulkari embroidery, premium dry fruits, and handmade juttis.",
    image: 'https://source.unsplash.com/1200x800/?punjab,market,textiles&sig=108',
    query: 'Amritsar phulkari and dry fruits',
    color: '#F97316',
  },
  {
    city: 'Mysore',
    state: 'Karnataka',
    market: 'Devaraja Market',
    specialty: ['Sandal Wood', 'Silk', 'Incense'],
    desc: 'Fragrant pyramids of kumkum and jasmine garlands fill this beautiful market under the old arcades.',
    image: 'https://source.unsplash.com/1200x800/?mysore,flowers,market&sig=109',
    query: 'Mysore sandalwood and silk',
    color: '#84CC16',
  },
  {
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    market: 'Hazratganj',
    specialty: ['Chikankari', 'Awadhi Attar', 'Zardozi'],
    desc: "The city of nawabs is home to India's finest chikankari embroidery - intricate white-thread stitchwork.",
    image: 'https://source.unsplash.com/1200x800/?lucknow,embroidery,textile&sig=110',
    query: 'Lucknow chikankari embroidery',
    color: '#A78BFA',
  },
  {
    city: 'Kochi',
    state: 'Kerala',
    market: 'Jew Town Spice Market',
    specialty: ['Cardamom', 'Pepper', 'Coconut Products'],
    desc: "Fort Kochi's ancient spice warehouses line the waterfront - the original spice trade hub of the world.",
    image: 'https://source.unsplash.com/1200x800/?kerala,spice,market&sig=111',
    query: 'Kerala spices cardamom pepper',
    color: '#34D399',
  },
  {
    city: 'Ahmedabad',
    state: 'Gujarat',
    market: 'Law Garden',
    specialty: ['Bandhani', 'Patola Silk', 'Mirror Work'],
    desc: "Gujarat's vibrant textile heritage shines here - tie-dye bandhani, double-ikat patola, and mirror embroidery.",
    image: 'https://source.unsplash.com/1200x800/?gujarat,textiles,artisan&sig=112',
    query: 'Gujarat bandhani textiles',
    color: '#FB923C',
  },
]

const FEATURED_STORIES = [
  {
    title: 'The weavers of Varanasi',
    excerpt: 'Families who have woven Banarasi silk for twelve generations, keeping a 500-year tradition alive on wooden handlooms.',
    tag: 'Heritage Craft',
  },
  {
    title: "How Jaipur's gem cutters work",
    excerpt: 'From rough stone to finished jewel - the intricate craft of gem cutting passed down in the lanes of Johari Bazaar.',
    tag: 'Artisan Story',
  },
  {
    title: "Kolkata's mishti culture",
    excerpt: 'Why the sweetmeat shops of Bengal are more than stores - they are community hubs, memory-keepers, and living art.',
    tag: 'Food & Culture',
  },
]

const TRUST_STATS = [
  { label: 'Markets Digitized', value: '120+' },
  { label: 'Cities Covered', value: '38' },
  { label: 'Artisan Categories', value: '400+' },
  { label: 'Avg. Search Match', value: '96%' },
]

function fallbackPhoto(seed, width = 1200, height = 800) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`
}

function MarketCard({ market }) {
  const backup = fallbackPhoto(`market-${market.city}`)
  const [imgSrc, setImgSrc] = useState(market.image)
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <Link to={`/chat?q=${encodeURIComponent(market.query)}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="market-card fx-soft-card"
        style={{
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          border: '1px solid var(--border-faint)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, var(--bg-raised) 100%)',
          transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
          cursor: 'pointer',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-3px)'
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'
          e.currentTarget.style.borderColor = `${market.color}44`
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.borderColor = 'var(--border-faint)'
        }}
      >
        <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
          {!imgFailed && (
            <img
              src={imgSrc}
              alt={market.market}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              loading="lazy"
              onError={() => {
                if (imgSrc !== backup) {
                  setImgSrc(backup)
                  return
                }
                setImgFailed(true)
              }}
            />
          )}
          {imgFailed && (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `radial-gradient(130% 120% at 0% 0%, ${market.color}66 0%, #111 65%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '28px',
                fontWeight: 700,
              }}
            >
              {market.city[0]}
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '14px',
              right: '14px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{market.city}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{market.state}</div>
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#fff',
                background: `${market.color}cc`,
                borderRadius: 'var(--radius-full)',
                padding: '3px 10px',
                backdropFilter: 'blur(8px)',
              }}
            >
              {market.market}
            </div>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {market.specialty.map(s => (
              <span
                key={s}
                style={{
                  fontSize: '11px',
                  color: market.color,
                  background: `${market.color}18`,
                  border: `1px solid ${market.color}30`,
                  borderRadius: 'var(--radius-full)',
                  padding: '2px 9px',
                  fontWeight: 500,
                }}
              >
                {s}
              </span>
            ))}
          </div>

          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              marginBottom: '12px',
            }}
          >
            {market.desc}
          </p>

          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: market.color,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Shop this bazaar
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function MarketsPage() {
  const heroRef = useReveal(0.08)
  const statsRef = useReveal(0.18)
  const gridRef = useReveal(0.1)
  const storiesRef = useReveal(0.12)

  return (
    <div style={{ minHeight: '100vh', paddingTop: 'var(--nav-height)', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes marketsGlow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes marketsFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
        }
        @keyframes marketsMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .markets-chip-marquee { animation: marketsMarquee 20s linear infinite; }
        .market-float { animation: marketsFloat 5.5s ease-in-out infinite; }

        @media (max-width: 640px) {
          .markets-grid { grid-template-columns: 1fr !important; }
          .markets-hero-h1 { font-size: clamp(36px, 10vw, 56px) !important; }
          .stories-grid { grid-template-columns: 1fr !important; }
          .markets-chip-marquee { animation-duration: 14s !important; }
        }
        @media (max-width: 900px) {
          .markets-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .market-float,
          .markets-chip-marquee { animation: none !important; }
        }
      `}</style>

      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-160px', left: '-140px', width: '560px', height: '560px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.20) 0%, rgba(249,115,22,0) 68%)', filter: 'blur(70px)', animation: 'marketsGlow 7s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', right: '-160px', top: '120px', width: '480px', height: '480px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0) 70%)', filter: 'blur(64px)' }} />
      </div>

      <section
        ref={heroRef}
        style={{
          textAlign: 'center',
          padding: 'var(--space-16) var(--space-6) var(--space-8)',
          maxWidth: '760px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--brand-saffron)',
            border: '1px solid rgba(249,115,22,0.3)',
            borderRadius: 'var(--radius-full)',
            padding: '4px 16px',
            marginBottom: 'var(--space-5)',
            background: 'rgba(249,115,22,0.08)',
            animation: 'fadeUp 360ms var(--ease-out) both',
          }}
        >
          <span className="fx-text-live">●</span>
          12 Cities · 100+ Markets
        </div>

        <h1
          className="markets-hero-h1 reveal-child"
          style={{
            fontSize: 'clamp(42px, 7vw, 64px)',
            fontWeight: 800,
            letterSpacing: '-2px',
            lineHeight: 1.05,
            marginBottom: 'var(--space-5)',
          }}
        >
          India's greatest <span className="gradient-text">bazaars</span> at your fingertips
        </h1>

        <p
          className="reveal-child"
          style={{
            fontSize: '17px',
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
            marginBottom: 'var(--space-8)',
          }}
        >
          Discover iconic Indian bazaars through one intelligent interface. Search by city, craft, or culture and shop from heritage markets globally.
        </p>

        <div className="reveal-child" style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            to="/chat?q=best products from Indian markets"
            className="fx-glow-button"
            style={{
              background: 'var(--brand-saffron)',
              color: '#fff',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: 'var(--radius-full)',
              padding: '11px 18px',
              transition: 'transform 150ms ease, box-shadow 150ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(249,115,22,0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            Explore with AI
          </Link>

          <Link
            to="/search?q=indian market"
            className="fx-soft-card"
            style={{
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: 'var(--radius-full)',
              padding: '11px 18px',
            }}
          >
            View all products
          </Link>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ overflow: 'hidden', borderTop: '1px solid var(--border-faint)', borderBottom: '1px solid var(--border-faint)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="markets-chip-marquee" style={{ display: 'flex', width: 'max-content', gap: '10px', padding: '12px 0' }}>
            {[...MARKETS.slice(0, 8), ...MARKETS.slice(0, 8)].map((m, i) => (
              <span
                key={`${m.city}-${i}`}
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '999px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                {m.city} · {m.market}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section ref={statsRef} style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 var(--space-6) var(--space-10)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {TRUST_STATS.map((s, i) => (
            <div
              key={s.label}
              className="reveal-child fx-soft-card market-float"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '14px 16px',
                animationDelay: `${i * 120}ms`,
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 var(--space-6) var(--space-16)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 'var(--space-8)', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--brand-saffron)', marginBottom: '6px' }}>
              Explore by City
            </p>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>
              Heritage markets curated for modern global shopping.
            </h2>
          </div>
          <Link to="/chat?q=Show me markets for wedding shopping" style={{ color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none' }}>
            Need help choosing? Ask AI →
          </Link>
        </div>

        <div className="markets-grid" ref={gridRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {MARKETS.map(m => (
            <div key={m.city} className="reveal-child">
              <MarketCard market={m} />
            </div>
          ))}
        </div>
      </section>

      <section ref={storiesRef} style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 var(--space-6) var(--space-20)' }}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-saffron)', marginBottom: '6px' }}>
            Market Stories
          </p>
          <h3 style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.02em', margin: 0 }}>
            Beyond products - culture, craftsmanship, and living traditions.
          </h3>
        </div>

        <div className="stories-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {FEATURED_STORIES.map((story, i) => (
            <article
              key={story.title}
              className="reveal-child fx-soft-card"
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px 18px 16px',
                background: 'var(--bg-raised)',
                animationDelay: `${i * 80}ms`,
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--brand-saffron)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
                {story.tag}
              </div>
              <h4 style={{ fontSize: '18px', lineHeight: 1.35, margin: '0 0 8px', letterSpacing: '-0.01em' }}>{story.title}</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{story.excerpt}</p>
            </article>
          ))}
        </div>

        <div className="reveal-child" style={{ marginTop: 'var(--space-10)' }}>
          <div
            style={{
              border: '1px solid rgba(249,115,22,0.25)',
              borderRadius: '18px',
              padding: '20px 20px',
              background: 'radial-gradient(120% 160% at 0% 0%, rgba(249,115,22,0.22) 0%, rgba(249,115,22,0.08) 34%, rgba(17,17,17,0.95) 84%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.68)' }}>Concierge Discovery</p>
              <h3 style={{ margin: '6px 0 0', fontSize: '24px', lineHeight: 1.25, letterSpacing: '-0.02em', color: '#fff' }}>
                Ask AI to build your market route across India.
              </h3>
            </div>
            <Link
              to="/chat?q=Plan a shopping route across Indian markets"
              className="fx-glow-button"
              style={{
                background: 'var(--brand-saffron)',
                color: '#fff',
                borderRadius: '999px',
                padding: '12px 18px',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              Build my route
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
