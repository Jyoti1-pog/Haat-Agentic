import { useState, useEffect } from 'react'

const PHASES = [
  {
    label: 'Understanding your query...',
    detail: 'Claude AI is extracting intent, keywords, and occasion context',
    icon: '🧠',
    pct: 28,
  },
  {
    label: 'Searching Indian markets...',
    detail: 'TinyFish is scanning live product listings across bazaars',
    icon: '🛕',
    pct: 64,
  },
  {
    label: 'Preparing your results...',
    detail: 'Generating your personalised spoken narration with Claude',
    icon: '✨',
    pct: 88,
  },
]

export default function SearchProgress() {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [pct, setPct]           = useState(4)

  useEffect(() => {
    // Slight delay so CSS transition fires visibly on mount
    const kick = setTimeout(() => setPct(PHASES[0].pct), 60)
    const t1   = setTimeout(() => { setPhaseIdx(1); setPct(PHASES[1].pct) }, 2200)
    const t2   = setTimeout(() => { setPhaseIdx(2); setPct(PHASES[2].pct) }, 4800)
    return () => { clearTimeout(kick); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const current = PHASES[phaseIdx]

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.agentIcon}>🤖</span>
        <span style={S.agentLabel}>Agent at work</span>
        <span style={S.ellipsis}>
          <span className="dot-bounce" style={{ animationDelay: '0s' }}>.</span>
          <span className="dot-bounce" style={{ animationDelay: '0.18s' }}>.</span>
          <span className="dot-bounce" style={{ animationDelay: '0.36s' }}>.</span>
        </span>
      </div>

      {/* Phase label */}
      <div style={S.phaseLabel}>
        <span style={S.phaseIcon}>{current.icon}</span>
        {current.label}
      </div>

      {/* Progress bar track */}
      <div style={S.track} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ ...S.fill, width: `${pct}%` }}>
          <div className="progress-shine" />
        </div>
      </div>

      <div style={S.phaseDetail}>{current.detail}</div>

      {/* Step indicators */}
      <div style={S.steps}>
        {PHASES.map((p, i) => (
          <div key={i} style={S.step}>
            <div style={{
              ...S.stepDot,
              background: i < phaseIdx ? 'var(--teal)' : i === phaseIdx ? 'var(--saffron)' : 'var(--border)',
              transform: i === phaseIdx ? 'scale(1.2)' : 'scale(1)',
            }} />
            <span style={{
              fontSize: '0.72rem', lineHeight: 1.3,
              color: i === phaseIdx ? 'var(--charcoal)' : i < phaseIdx ? 'var(--teal)' : 'var(--charcoal-muted)',
              fontWeight: i === phaseIdx ? 600 : 400,
            }}>
              {i < phaseIdx ? '✓ ' : ''}{['Parse', 'Search', 'Narrate'][i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const S = {
  wrap: {
    background: 'linear-gradient(135deg, #FFFAF4 0%, #F0FBFB 100%)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '28px 32px',
    marginBottom: 32,
    boxShadow: 'var(--shadow-sm)',
  },

  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 },
  agentIcon: { fontSize: '1.3rem' },
  agentLabel: { fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--charcoal)' },
  ellipsis: { display: 'flex', gap: 1, alignItems: 'flex-end', paddingBottom: 2, color: 'var(--saffron)', fontWeight: 700, fontSize: '1.2rem' },

  phaseLabel: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: '0.95rem', fontWeight: 600, color: 'var(--charcoal)',
    marginBottom: 14,
  },
  phaseIcon: { fontSize: '1rem' },

  track: {
    height: 10, background: 'var(--border)',
    borderRadius: 99, overflow: 'hidden',
    marginBottom: 10,
  },
  fill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--teal) 0%, var(--saffron) 100%)',
    borderRadius: 99,
    position: 'relative', overflow: 'hidden',
    transition: 'width 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
  },

  phaseDetail: {
    fontSize: '0.78rem', color: 'var(--charcoal-muted)',
    marginBottom: 20, lineHeight: 1.5,
  },

  steps: { display: 'flex', gap: 32 },
  step: { display: 'flex', alignItems: 'center', gap: 6 },
  stepDot: {
    width: 10, height: 10, borderRadius: '50%',
    transition: 'background 0.4s, transform 0.3s',
    flexShrink: 0,
  },
}
