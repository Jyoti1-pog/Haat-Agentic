import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { globalThis.scrollTo(0, 0) }, [pathname])
  return null
}
import { AuthProvider }    from './contexts/AuthContext'
import { CartProvider }    from './contexts/CartContext'
import { ToastProvider }   from './contexts/ToastContext'
import { LoadingProvider } from './contexts/LoadingContext'
import { ThemeProvider }   from './contexts/ThemeContext'
import Nav        from './components/Nav'
import Footer     from './components/Footer'
import LoadingBar from './components/LoadingBar'
import BottomNav  from './components/BottomNav'

import HomePage       from './pages/HomePage'
import SearchPage     from './pages/SearchPage'
import ProductPage    from './pages/ProductPage'
import CartPage       from './pages/CartPage'
import CheckoutPage   from './pages/CheckoutPage'
import ConfirmedPage  from './pages/ConfirmedPage'
import MarketsPage    from './pages/MarketsPage'
import AboutPage      from './pages/AboutPage'
import NotFoundPage   from './pages/NotFoundPage'
import AuthPage       from './pages/AuthPage'
import OnboardingPage from './pages/OnboardingPage'
import ChatPage       from './pages/ChatPage'
import PrivacyPage    from './pages/PrivacyPage'
import TermsPage      from './pages/TermsPage'
import SettingsPage   from './pages/SettingsPage'

// Pages that hide Nav / Footer / BottomNav
const HIDE_CHROME_ON = ['/checkout', '/confirmed', '/login', '/signup', '/onboarding', '/chat']

// ── Animated page wrapper ─────────────────────────────────────────────────────
// key={location.key} forces React to remount the element on every navigation,
// which restarts the CSS animation for the enter effect.
// eslint-disable-next-line react/prop-types
function AnimatedPage({ children }) {
  return (
    <div className="page-enter" style={{ minHeight: '100vh' }}>
      {children}
    </div>
  )
}

function AppShell() {
  const location   = useLocation()
  const hideChrome = HIDE_CHROME_ON.some(p => location.pathname.startsWith(p))

  useEffect(() => {
    const root = document.documentElement
    let rafId = 0
    let currentX = 50
    let currentY = 12
    let targetX = 50
    let targetY = 12

    const tick = () => {
      currentX += (targetX - currentX) * 0.085
      currentY += (targetY - currentY) * 0.085
      root.style.setProperty('--mx', `${currentX.toFixed(2)}%`)
      root.style.setProperty('--my', `${currentY.toFixed(2)}%`)
      rafId = globalThis.requestAnimationFrame(tick)
    }

    const onPointerMove = event => {
      targetX = (event.clientX / globalThis.innerWidth) * 100
      targetY = (event.clientY / globalThis.innerHeight) * 100
    }

    rafId = globalThis.requestAnimationFrame(tick)
    globalThis.addEventListener('pointermove', onPointerMove, { passive: true })

    return () => {
      globalThis.cancelAnimationFrame(rafId)
      globalThis.removeEventListener('pointermove', onPointerMove)
      root.style.removeProperty('--mx')
      root.style.removeProperty('--my')
    }
  }, [])

  return (
    <div className="flow-unify-shell">
      <div className="flow-unify-atmos" aria-hidden="true" />
      <div className="ambient-canvas" aria-hidden="true" />
      <ScrollToTop />
      <LoadingBar />
      {!hideChrome && <Nav />}

      <AnimatedPage key={location.key}>
        <div className="flow-unify-page-wrap">
          <Routes location={location}>
            <Route path="/"            element={<HomePage />} />
            <Route path="/search"      element={<SearchPage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/cart"        element={<CartPage />} />
            <Route path="/checkout"    element={<CheckoutPage />} />
            <Route path="/confirmed"   element={<ConfirmedPage />} />
            <Route path="/markets"     element={<MarketsPage />} />
            <Route path="/about"       element={<AboutPage />} />
            <Route path="/login"       element={<AuthPage />} />
            <Route path="/signup"      element={<AuthPage />} />
            <Route path="/onboarding"  element={<OnboardingPage />} />
            <Route path="/chat"        element={<ChatPage />} />
            <Route path="/privacy"     element={<PrivacyPage />} />
            <Route path="/terms"       element={<TermsPage />} />
            <Route path="/settings"    element={<SettingsPage />} />
            <Route path="*"            element={<NotFoundPage />} />
          </Routes>
        </div>
        {!hideChrome && <Footer />}
      </AnimatedPage>

      {!hideChrome && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LoadingProvider>
          <CartProvider>
            <ToastProvider>
              <AppShell />
            </ToastProvider>
          </CartProvider>
        </LoadingProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
