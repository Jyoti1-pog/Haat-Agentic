import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { CartProvider }  from './contexts/CartContext'
import { BuyerProvider } from './contexts/BuyerContext'
import { ToastProvider } from './contexts/ToastContext'
import { Nav, Footer }   from './components/Chrome'

import HomePage           from './pages/HomePage'
import CataloguePage      from './pages/CataloguePage'
import ProductPage        from './pages/ProductPage'
import CartPage           from './pages/CartPage'
import CheckoutPage       from './pages/CheckoutPage'
import LibraryPage        from './pages/LibraryPage'
import SellerListingPage  from './pages/SellerListingPage'
import SellerDashboardPage from './pages/SellerDashboardPage'
import OpsPage            from './pages/OpsPage'
import AgentCheckoutPage  from './pages/AgentCheckoutPage'
import PrivacyPage        from './pages/PrivacyPage'
import TermsPage          from './pages/TermsPage'
import NotFoundPage       from './pages/NotFoundPage'

// The agent ledger is its own object, edge to edge — it brings its own chrome.
const BARE = ['/agent-checkout']

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { globalThis.scrollTo(0, 0) }, [pathname])
  return null
}

function Shell() {
  const { pathname } = useLocation()
  const bare = BARE.some(p => pathname.startsWith(p))

  return (
    <>
      <ScrollToTop />
      {!bare && <Nav />}

      <main key={pathname} className="h-rise" style={{ minHeight: '70vh' }}>
        <Routes>
          <Route path="/"               element={<HomePage />} />
          <Route path="/catalogue"      element={<CataloguePage />} />
          <Route path="/product/:id"    element={<ProductPage />} />
          <Route path="/cart"           element={<CartPage />} />
          <Route path="/checkout"       element={<CheckoutPage />} />
          <Route path="/library"        element={<LibraryPage />} />
          <Route path="/sell"           element={<SellerListingPage />} />
          <Route path="/seller"         element={<SellerDashboardPage />} />
          <Route path="/ops"            element={<OpsPage />} />
          <Route path="/agent-checkout" element={<AgentCheckoutPage />} />
          <Route path="/privacy"        element={<PrivacyPage />} />
          <Route path="/terms"          element={<TermsPage />} />

          {/* haat sold physical goods once; these keep old links alive. */}
          <Route path="/search"  element={<Navigate to="/catalogue" replace />} />
          <Route path="/markets" element={<Navigate to="/catalogue" replace />} />
          <Route path="/about"   element={<Navigate to="/" replace />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      {!bare && <Footer />}
    </>
  )
}

export default function App() {
  return (
    <BuyerProvider>
      <CartProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </CartProvider>
    </BuyerProvider>
  )
}
