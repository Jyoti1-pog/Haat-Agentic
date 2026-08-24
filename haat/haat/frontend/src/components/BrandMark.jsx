export default function BrandMark({ size = 'md', showTag = false, light = false }) {
  const markSize = size === 'sm' ? 22 : size === 'lg' ? 36 : 28
  const titleSize = size === 'sm' ? '18px' : size === 'lg' ? '25px' : '20px'
  const textColor = light ? '#ffffff' : 'var(--text-primary)'

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <span
        aria-hidden="true"
        style={{
          width: `${markSize}px`,
          height: `${markSize}px`,
          borderRadius: '10px',
          background: 'linear-gradient(140deg, #FFA852 0%, #F97316 38%, #B44706 100%)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.15), 0 12px 26px rgba(249,115,22,0.32)',
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'rotate(2deg)',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.0) 58%)',
            pointerEvents: 'none',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: '5px',
            borderRadius: '7px',
            border: '1px solid rgba(255,255,255,0.32)',
          }}
        />
        <svg
          width={size === 'sm' ? 10 : 12}
          height={size === 'sm' ? 10 : 12}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{
            zIndex: 2,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))',
          }}
        >
          <path d="M4 12h16" stroke="rgba(255,255,255,0.95)" strokeWidth="2.2" strokeLinecap="round"/>
          <path d="M12 4v16" stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontSize: titleSize,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: textColor,
            textShadow: light ? '0 6px 18px rgba(0,0,0,0.25)' : 'none',
          }}
        >
          haat
        </span>
        {showTag && (
          <span
            style={{
              fontSize: '10px',
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              marginTop: '3px',
            }}
          >
            Local hearts, global homes
          </span>
        )}
      </span>
    </span>
  )
}
