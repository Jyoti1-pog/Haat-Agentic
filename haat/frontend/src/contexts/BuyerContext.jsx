import { createContext, useCallback, useContext, useMemo, useState } from 'react'

/* ═══════════════════════════════════════════════════════════════════════════
   Who is buying.

   Entitlements are keyed on a buyer reference, not on a login — that is what
   lets an agent buy on someone's behalf and have it land in the same library
   the person sees. So the shop needs an identity before checkout, and an email
   address is enough of one.

   Deliberately not an auth system. haat's Supabase login still exists for
   accounts; this is the lighter thing a purchase actually needs, and keeping
   them separate means a judge can buy something without signing up.
   ═══════════════════════════════════════════════════════════════════════════ */

const KEY = 'haat.buyer'
const BuyerContext = createContext(null)

export function BuyerProvider({ children }) {
  const [buyer, setBuyerState] = useState(() => {
    try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
  })

  const setBuyer = useCallback(ref => {
    const clean = String(ref ?? '').trim().toLowerCase()
    setBuyerState(clean)
    try { clean ? localStorage.setItem(KEY, clean) : localStorage.removeItem(KEY) } catch { /* private mode */ }
  }, [])

  const value = useMemo(() => ({ buyer, setBuyer }), [buyer, setBuyer])
  return <BuyerContext.Provider value={value}>{children}</BuyerContext.Provider>
}

export function useBuyer() {
  const ctx = useContext(BuyerContext)
  if (!ctx) throw new Error('useBuyer must be used inside BuyerProvider')
  return ctx
}
