import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'haat_theme'

// Resolve what data-theme to actually set on <html>
function resolveTheme(pref) {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'dark' } catch { return 'dark' }
  })

  // Apply data-theme to <html> whenever preference changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolveTheme(theme))
    try { localStorage.setItem(STORAGE_KEY, theme) } catch {}
  }, [theme])

  // When theme === 'system', track OS preference changes in real time
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  function setTheme(pref) {
    setThemeState(pref)
  }

  // The resolved actual theme (dark or light — not system)
  const resolvedTheme = resolveTheme(theme)

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
