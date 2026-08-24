import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div style={S.page}>
      <span style={S.code}>404</span>
      <h1 style={S.title}>Page not found</h1>
      <p style={S.sub}>This market stall seems to have moved.</p>
      <Link to="/" style={S.btn}>← Back to home</Link>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', paddingTop: 'var(--nav-height)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)',
  },
  code: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)',
    letterSpacing: '0.2em',
  },
  title: {
    fontSize: 'clamp(32px, 5vw, var(--text-3xl))',
    fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)',
    letterSpacing: '-1px',
  },
  sub: { color: 'var(--text-tertiary)', fontSize: 'var(--text-md)' },
  btn: {
    marginTop: 'var(--space-4)',
    fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-3) var(--space-5)',
    transition: 'border-color var(--duration-fast), color var(--duration-fast)',
  },
}
