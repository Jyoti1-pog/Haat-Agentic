import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// ── Data ───────────────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'US', name: 'United States',   flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom',  flag: '🇬🇧' },
  { code: 'CA', name: 'Canada',          flag: '🇨🇦' },
  { code: 'AU', name: 'Australia',       flag: '🇦🇺' },
  { code: 'AE', name: 'UAE',             flag: '🇦🇪' },
  { code: 'SG', name: 'Singapore',       flag: '🇸🇬' },
  { code: 'MY', name: 'Malaysia',        flag: '🇲🇾' },
  { code: 'NZ', name: 'New Zealand',     flag: '🇳🇿' },
  { code: 'DE', name: 'Germany',         flag: '🇩🇪' },
  { code: 'FR', name: 'France',          flag: '🇫🇷' },
  { code: 'NL', name: 'Netherlands',     flag: '🇳🇱' },
  { code: 'ZA', name: 'South Africa',    flag: '🇿🇦' },
  { code: 'IN', name: 'India',           flag: '🇮🇳' },
  { code: 'OTHER', name: 'Somewhere else', flag: '🌍' },
]

const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Other / Not sure',
]

const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian',       icon: '🥦' },
  { id: 'vegan',      label: 'Vegan',             icon: '🌱' },
  { id: 'jain',       label: 'Jain',              icon: '☮️' },
  { id: 'halal',      label: 'Halal',             icon: '✦' },
  { id: 'none',       label: 'No restrictions',   icon: '🍽️' },
]

const BUDGET_OPTIONS = [
  { id: 'budget',  label: 'Budget-friendly',  sub: 'Under ₹2,000',     icon: '💚' },
  { id: 'mid',     label: 'Mid-range',        sub: '₹2,000 – ₹8,000', icon: '💛' },
  { id: 'premium', label: 'Premium',          sub: '₹8,000+',          icon: '🧡' },
]

const OCCASION_OPTIONS = [
  { id: 'Diwali',       label: 'Diwali',        icon: '🪔' },
  { id: 'Holi',         label: 'Holi',           icon: '🎨' },
  { id: 'Eid',          label: 'Eid',            icon: '🌙' },
  { id: 'wedding',      label: 'Weddings',       icon: '💍' },
  { id: 'birthday',     label: 'Birthdays',      icon: '🎂' },
  { id: 'Pongal',       label: 'Pongal',         icon: '🌾' },
  { id: 'Navratri',     label: 'Navratri',       icon: '💃' },
  { id: 'anniversary',  label: 'Anniversaries',  icon: '❤️' },
  { id: 'Christmas',    label: 'Christmas',      icon: '🎄' },
  { id: 'housewarming', label: 'Housewarming',   icon: '🏡' },
]

// ── SelectGrid ─────────────────────────────────────────────────────────────────
function SelectGrid({ options, selected, onSelect, multi = false, columns = 2 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: '10px',
    }}>
      {options.map(opt => {
        const active = multi ? selected.includes(opt.id) : selected === opt.id
        return (
          <button
            key={opt.id}
            onClick={() => {
              if (multi) {
                onSelect(active ? selected.filter(s => s !== opt.id) : [...selected, opt.id])
              } else {
                onSelect(opt.id)
              }
            }}
            style={{
              padding:      '12px 10px',
              borderRadius: 'var(--radius-lg)',
              border:       `1px solid ${active ? 'rgba(249,115,22,0.45)' : 'var(--border-subtle)'}`,
              background:   active ? 'rgba(249,115,22,0.10)' : 'var(--bg-raised)',
              color:        active ? 'var(--brand-saffron-lt)' : 'var(--text-secondary)',
              fontSize:     '13px',
              fontWeight:   active ? 600 : 400,
              cursor:       'pointer',
              textAlign:    'left',
              display:      'flex',
              flexDirection:'column',
              gap:          '3px',
              transition:   'all 150ms ease',
              boxShadow:    active ? '0 0 0 1px rgba(249,115,22,0.15) inset' : 'none',
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{opt.flag ?? opt.icon}</span>
            <span style={{ lineHeight: 1.3 }}>{opt.name ?? opt.label}</span>
            {opt.sub && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400 }}>{opt.sub}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ── OnboardingPage ─────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { user, updateProfile } = useAuth()
  const navigate = useNavigate()

  const [step,       setStep]      = useState(0)
  const [saving,     setSaving]    = useState(false)

  // Profile fields
  const [country,    setCountry]   = useState(null)
  const [homeState,  setHomeState] = useState(null)
  const [dietary,    setDietary]   = useState([])
  const [budget,     setBudget]    = useState(null)
  const [occasions,  setOccasions] = useState([])

  const STEPS = [
    {
      title:    `Welcome to haat${user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 🙏`,
      subtitle: 'Quick setup so we can personalise everything for you. Takes 30 seconds.',
      content:  (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            Where are you based?
          </p>
          <SelectGrid
            options={COUNTRIES}
            selected={country}
            onSelect={setCountry}
            columns={2}
          />
        </div>
      ),
      canSkip:  true,
    },
    {
      title:    'Where in India is home? 🇮🇳',
      subtitle: "We'll suggest things that remind you of where you're from.",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap:                 '8px',
            maxHeight:           '280px',
            overflowY:           'auto',
            paddingRight:        '4px',
          }}>
            {INDIAN_STATES.map(state => (
              <button
                key={state}
                onClick={() => setHomeState(state)}
                style={{
                  padding:      '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border:       `1px solid ${homeState === state ? 'rgba(249,115,22,0.45)' : 'var(--border-subtle)'}`,
                  background:   homeState === state ? 'rgba(249,115,22,0.10)' : 'var(--bg-raised)',
                  color:        homeState === state ? 'var(--brand-saffron-lt)' : 'var(--text-secondary)',
                  fontSize:     '13px',
                  fontWeight:   homeState === state ? 600 : 400,
                  cursor:       'pointer',
                  textAlign:    'left',
                  transition:   'all 150ms ease',
                }}
              >
                {state}
              </button>
            ))}
          </div>
        </div>
      ),
      canSkip: true,
    },
    {
      title:    'Almost done! Your preferences 🙌',
      subtitle: 'Helps us filter products and match your style.',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Dietary preferences
            </p>
            <SelectGrid
              options={DIETARY_OPTIONS}
              selected={dietary}
              onSelect={setDietary}
              multi
              columns={3}
            />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Typical budget per gift
            </p>
            <SelectGrid
              options={BUDGET_OPTIONS}
              selected={budget}
              onSelect={setBudget}
              columns={3}
            />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Occasions you shop for (pick any)
            </p>
            <SelectGrid
              options={OCCASION_OPTIONS}
              selected={occasions}
              onSelect={setOccasions}
              multi
              columns={3}
            />
          </div>
        </div>
      ),
      canSkip: true,
    },
  ]

  const currentStep = STEPS[step]
  const progress    = ((step + 1) / STEPS.length) * 100

  async function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      await save()
    }
  }

  async function save() {
    setSaving(true)
    try {
      const selectedCountry = COUNTRIES.find(c => c.code === country)
      await updateProfile({
        country:     selectedCountry?.name ?? null,
        countryCode: country,
        homeState,
        dietary:     dietary.filter(d => d !== 'none'),
        budgetRange: budget,
        occasions,
        onboarded:   true,
      })
      navigate('/chat', { replace: true })
    } catch (err) {
      console.error('Onboarding save failed:', err)
      navigate('/chat', { replace: true })  // Don't block — just go to chat
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:     'var(--bg-base)',
      display:        'flex',
      alignItems:     'flex-start',
      justifyContent: 'center',
      padding:        '40px 16px 80px',
      overflowY:      'auto',
    }}>

      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: '500px', height: '300px',
        background: 'radial-gradient(ellipse, rgba(249,115,22,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '460px', animation: 'fadeUp 300ms var(--ease-out) both' }}>

        {/* Progress */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              Step {step + 1} of {STEPS.length}
            </span>
            <button
              onClick={() => navigate('/chat')}
              style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--text-tertiary)', cursor: 'pointer' }}
            >
              Skip for now →
            </button>
          </div>
          <div style={{ height: '2px', background: 'var(--border-faint)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: 'var(--brand-saffron)', borderRadius: '2px',
              transition: 'width 400ms var(--ease-out)',
            }} />
          </div>
        </div>

        {/* Step content */}
        <div key={step} style={{ animation: 'fadeUp 250ms var(--ease-out) both' }}>
          <h1 style={{
            fontSize: 'clamp(20px, 5vw, 26px)',
            fontWeight: 700, letterSpacing: '-0.5px',
            color: 'var(--text-primary)', marginBottom: '8px',
          }}>
            {currentStep.title}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '28px' }}>
            {currentStep.subtitle}
          </p>

          <div style={{
            background:   'var(--bg-raised)',
            border:       '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-2xl)',
            padding:      '24px',
          }}>
            {currentStep.content}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                padding:      '13px 20px',
                background:   'var(--bg-raised)',
                border:       '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                color:        'var(--text-secondary)',
                fontSize:     '14px',
                fontWeight:    500,
                cursor:       'pointer',
                flexShrink:    0,
              }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={saving}
            style={{
              flex:         1,
              padding:      '13px',
              background:   saving ? 'rgba(249,115,22,0.5)' : 'var(--brand-saffron)',
              color:        '#fff',
              border:       'none',
              borderRadius: 'var(--radius-lg)',
              fontSize:     '15px',
              fontWeight:    600,
              cursor:       saving ? 'default' : 'pointer',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              gap:          '8px',
              transition:   'background 150ms ease',
            }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = 'var(--brand-saffron-dk)' }}
            onMouseLeave={e => { e.currentTarget.style.background = saving ? 'rgba(249,115,22,0.5)' : 'var(--brand-saffron)' }}
          >
            {saving ? (
              <>
                <span style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff',
                  animation: 'spin 0.7s linear infinite', display: 'inline-block',
                }} />
                Saving…
              </>
            ) : step < STEPS.length - 1 ? 'Continue →' : 'Start exploring →'}
          </button>
        </div>

        {currentStep.canSkip && step < STEPS.length - 1 && (
          <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            You can always update these in your profile settings
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
