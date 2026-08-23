import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const ToastContext = createContext(null)
let _id = 0

// ── Provider ───────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((message, type = 'info') => {
    const id = ++_id
    // Cap the stack at 3 — drop the oldest if needed
    setToasts(prev => [...prev.slice(-2), { id, message, type }])
    setTimeout(() => dismiss(id), 3000)
  }, [dismiss])

  const value = {
    success: msg => push(msg, 'success'),
    error:   msg => push(msg, 'error'),
    info:    msg => push(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ── Toast stack ────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function Toast({ toast, onDismiss }) {
  const ref = useRef(null)

  // Animate-in via class (CSS already has @keyframes slideUp in tokens.css)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.animation = 'slideUp 0.22s var(--ease-out) both'
  }, [])

  const borderColor = {
    success: 'var(--success)',
    error:   'var(--error)',
    info:    'var(--brand-saffron)',
  }[toast.type] ?? 'var(--border-default)'

  const icon = { success: '✓', error: '✕', info: 'ℹ' }[toast.type]

  return (
    <div
      ref={ref}
      onClick={() => onDismiss(toast.id)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background:   'var(--bg-overlay)',
        border:       '1px solid var(--border-default)',
        borderLeft:   `3px solid ${borderColor}`,
        borderRadius: 'var(--radius-lg)',
        padding:      'var(--space-4) var(--space-6)',
        boxShadow:    'var(--shadow-lg)',
        color:        'var(--text-primary)',
        fontSize:     14,
        lineHeight:   1.5,
        maxWidth:     340,
        pointerEvents:'auto',
        cursor:       'pointer',
        userSelect:   'none',
      }}
    >
      <span style={{ color: borderColor, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>
        {icon}
      </span>
      <span>{toast.message}</span>
    </div>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
