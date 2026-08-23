const SECTIONS = [
  {
    title: 'Acceptance of terms',
    body: 'By using haat — whether through our website, mobile app, or AI chat interface — you agree to these terms. If you do not agree, please do not use our services.',
  },
  {
    title: 'Our service',
    body: 'haat is an AI-powered marketplace connecting international buyers with Indian sellers. We facilitate the discovery, ordering, and delivery of authentic Indian products. haat acts as an intermediary — individual sellers are responsible for the products they list.',
  },
  {
    title: 'Ordering & payment',
    body: 'Orders are confirmed once payment is successfully processed. Prices are displayed in Indian Rupees (INR) at the time of listing and may change. All payments are processed securely through our payment partners. haat reserves the right to cancel orders in cases of pricing errors, stock unavailability, or suspected fraud.',
  },
  {
    title: 'Shipping & customs',
    body: 'Estimated delivery times are 7–14 business days for international shipments. Import duties and customs taxes are the responsibility of the buyer and vary by destination country. We provide tracking for all orders. haat is not liable for delays caused by customs authorities or circumstances beyond our control.',
  },
  {
    title: 'Returns & refunds',
    body: 'If your order arrives damaged or significantly different from the listing, contact us within 7 days of delivery at hello@haat.in with photographic evidence. We will review each case individually and offer a replacement, store credit, or refund at our discretion. Perishable items (sweets, spices) cannot be returned once shipped.',
  },
  {
    title: 'AI features',
    body: 'Our AI shopping assistant is provided as-is for informational and discovery purposes. While we strive for accuracy, AI-generated product suggestions and descriptions may occasionally contain errors. Always review product listings before purchasing.',
  },
  {
    title: 'Prohibited use',
    body: 'You may not use haat to resell products commercially without written permission, scrape data, attempt to breach security, or engage in any activity that violates applicable law. We reserve the right to suspend or terminate accounts that violate these terms.',
  },
  {
    title: 'Limitation of liability',
    body: 'haat is not liable for indirect, incidental, or consequential damages arising from use of the service. Our total liability for any claim shall not exceed the value of the order in question.',
  },
  {
    title: 'Changes to terms',
    body: 'We may update these terms from time to time. We will notify registered users of material changes by email. Continued use of haat after changes constitutes acceptance of the new terms.',
  },
  {
    title: 'Contact',
    body: 'For any questions about these terms, email hello@haat.in.',
  },
]

export default function TermsPage() {
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
            Terms of Use
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Please read these terms carefully before using haat. They govern your use of our platform and services.
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
