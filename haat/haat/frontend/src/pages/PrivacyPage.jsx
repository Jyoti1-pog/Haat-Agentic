const SECTIONS = [
  {
    title: 'What we collect',
    body: 'We collect information you provide directly — your name, email, shipping address, and order history. When you browse, we collect standard usage data (pages visited, device type, browser) through first-party analytics only. We do not use third-party tracking cookies.',
  },
  {
    title: 'How we use it',
    body: 'Your data is used to process orders, personalise your shopping experience, and send transactional emails (order confirmations, shipping updates). We do not sell, rent, or share your personal data with any third party for marketing purposes.',
  },
  {
    title: 'AI & voice features',
    body: 'When you use our AI chat or voice search, your queries are processed by our backend and may be sent to AI providers (Anthropic Claude) and speech providers (ElevenLabs) solely to generate responses. These providers are bound by their own data processing agreements and do not train on your data.',
  },
  {
    title: 'Data storage',
    body: 'Your data is stored on secure servers. Sessions are stored locally in your browser. Payment information is never stored on our servers — all payments are processed by certified payment processors.',
  },
  {
    title: 'Your rights',
    body: 'You may request access to, correction of, or deletion of your personal data at any time by emailing hello@haat.in. We will respond within 30 days. You may also opt out of any marketing communications using the unsubscribe link in any email we send.',
  },
  {
    title: 'Cookies',
    body: 'We use strictly necessary cookies only — for session management and security. No advertising or analytics cookies from third parties are placed on your device.',
  },
  {
    title: 'Contact',
    body: 'For any privacy-related queries, contact our team at hello@haat.in. Our registered address is available on request.',
  },
]

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', paddingTop: 'var(--nav-height)' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'var(--space-16) var(--space-6) var(--space-20)' }}>

        {/* Header */}
        <div style={{ marginBottom: 'var(--space-12)' }}>
          <div style={{
            display: 'inline-block', fontSize: '11px', fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)', padding: '4px 14px', marginBottom: 'var(--space-5)',
          }}>
            Last updated March 2026
          </div>
          <h1 style={{
            fontSize: 'clamp(32px, 6vw, 48px)', fontWeight: 800,
            letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 'var(--space-4)',
          }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            haat is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights as a user.
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          {SECTIONS.map((s, i) => (
            <div
              key={i}
              style={{
                borderTop: '1px solid var(--border-faint)',
                paddingTop: 'var(--space-6)',
              }}
            >
              <h2 style={{
                fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)',
                marginBottom: 'var(--space-3)', letterSpacing: '-0.01em',
              }}>
                {s.title}
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
