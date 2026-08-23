import { useLoading } from '../contexts/LoadingContext'

export default function LoadingBar() {
  const { progress, visible } = useLoading()

  return (
    <div style={{
      position:      'fixed',
      top:            0,
      left:           0,
      right:          0,
      height:        '2px',
      zIndex:         999,
      pointerEvents: 'none',
      overflow:      'hidden',
    }}>
      <div style={{
        height:     '100%',
        width:      `${progress}%`,
        background: 'linear-gradient(90deg, var(--brand-saffron) 0%, var(--brand-gold-lt) 60%, #FCD34D 100%)',
        boxShadow:  '0 0 8px var(--brand-saffron), 0 0 16px rgba(249,115,22,0.40)',
        opacity:    visible ? 1 : 0,
        transition: [
          `width ${progress === 100 ? 180 : 600}ms ease-out`,
          `opacity ${progress === 100 ? '300ms 200ms' : '0ms 0ms'} ease`,
        ].join(', '),
        willChange: 'width',
      }} />
    </div>
  )
}
