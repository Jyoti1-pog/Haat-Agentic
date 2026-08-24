import { Router }    from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join }  from 'path'

const router    = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

// In-memory store: sessionId → items[]
// Items: { productId, qty, name, price, image }
const carts = new Map()

function getCart(sid) {
  if (!carts.has(sid)) carts.set(sid, [])
  return carts.get(sid)
}

function productById(id) {
  try {
    const products = JSON.parse(readFileSync(join(__dirname, '../data/products.json'), 'utf8'))
    return products.find(p => p.id === id) ?? null
  } catch { return null }
}

// ── GET /api/cart/:sessionId ───────────────────────────────────────────────
router.get('/:sessionId', (req, res) => {
  const items    = getCart(req.params.sessionId)
  const totalINR = items.reduce((s, i) => s + i.price * i.qty, 0)
  res.json({ items, totalINR, totalUSD: +(totalINR / 83.5).toFixed(2), count: items.reduce((s, i) => s + i.qty, 0) })
})

// ── POST /api/cart/add ─────────────────────────────────────────────────────
router.post('/add', (req, res) => {
  const { sessionId, productId, qty = 1 } = req.body ?? {}
  if (!sessionId || !productId) return res.status(400).json({ error: 'sessionId and productId required' })

  const product = productById(productId)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const items    = getCart(sessionId)
  const existing = items.find(i => i.productId === productId)

  if (existing) {
    existing.qty += qty
  } else {
    items.push({ productId, qty, name: product.name, price: product.price, image: product.image, category: product.category })
  }

  res.json({ ok: true, items })
})

// ── POST /api/cart/update ─────────────────────────────────────────────────
router.post('/update', (req, res) => {
  const { sessionId, productId, qty } = req.body ?? {}
  if (!sessionId || !productId || qty == null) return res.status(400).json({ error: 'sessionId, productId, qty required' })

  const items = getCart(sessionId)
  const idx   = items.findIndex(i => i.productId === productId)
  if (idx === -1) return res.status(404).json({ error: 'Item not in cart' })

  if (qty <= 0) items.splice(idx, 1)
  else          items[idx].qty = qty

  res.json({ ok: true, items })
})

// ── DELETE /api/cart/remove ───────────────────────────────────────────────
router.delete('/remove', (req, res) => {
  const { sessionId, productId } = req.body ?? {}
  if (!sessionId || !productId) return res.status(400).json({ error: 'sessionId and productId required' })

  const items = getCart(sessionId)
  const before = items.length
  carts.set(sessionId, items.filter(i => i.productId !== productId))

  res.json({ ok: true, removed: before !== carts.get(sessionId).length })
})

export default router
