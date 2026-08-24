import { createContext, useContext, useReducer, useEffect } from 'react'

const USD_RATE = 83.5
const CartContext = createContext(null)

// ── Reducer ────────────────────────────────────────────────────────────────
function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const existing = state.find(i => i.id === action.product.id)
      if (existing) {
        return state.map(i =>
          i.id === action.product.id
            ? { ...i, qty: i.qty + (action.qty ?? 1) }
            : i
        )
      }
      return [...state, { ...action.product, qty: action.qty ?? 1 }]
    }
    case 'REMOVE':
      return state.filter(i => i.id !== action.id)

    case 'UPDATE_QTY':
      return state
        .map(i => i.id === action.id ? { ...i, qty: Math.max(0, action.qty) } : i)
        .filter(i => i.qty > 0)

    case 'CLEAR':
      return []

    default:
      return state
  }
}

// ── Provider ───────────────────────────────────────────────────────────────
export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, [], () => {
    try {
      const stored = localStorage.getItem('haat_cart')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  // Persist on every change
  useEffect(() => {
    localStorage.setItem('haat_cart', JSON.stringify(items))
  }, [items])

  const count    = items.reduce((sum, i) => sum + i.qty, 0)
  const totalINR = items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const totalUSD = totalINR / USD_RATE

  const value = {
    items,
    count,
    totalINR,
    totalUSD,
    add:       (product, qty = 1) => dispatch({ type: 'ADD', product, qty }),
    remove:    id                 => dispatch({ type: 'REMOVE', id }),
    updateQty: (id, qty)          => dispatch({ type: 'UPDATE_QTY', id, qty }),
    clear:     ()                 => dispatch({ type: 'CLEAR' }),
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
