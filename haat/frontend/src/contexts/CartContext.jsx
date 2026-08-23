import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'

/* A licence is owned or it isn't, so there is no quantity here — adding the
   same product twice is a no-op rather than a second copy. */

const KEY = 'haat.cart'
const CartContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return state.some(i => i.id === action.product.id) ? state : [...state, action.product]
    case 'REMOVE':
      return state.filter(i => i.id !== action.id)
    case 'CLEAR':
      return []
    default:
      return state
  }
}

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(reducer, [], () => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
  })

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* private mode */ }
  }, [items])

  const add    = useCallback(product => dispatch({ type: 'ADD', product }), [])
  const remove = useCallback(id => dispatch({ type: 'REMOVE', id }), [])
  const clear  = useCallback(() => dispatch({ type: 'CLEAR' }), [])

  const value = useMemo(() => ({
    items, add, remove, clear,
    count: items.length,
    total: items.reduce((s, i) => s + i.price, 0),
  }), [items, add, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
