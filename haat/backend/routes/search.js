import { Router } from 'express'
import { parseQuery, makeNarration } from '../services/claude.js'
import { allProducts, sellerFor, remainingStock } from '../services/digitalCatalog.js'

/**
 * search.js — catalogue search
 *
 * haat sells digital goods only, so this searches the digital catalogue and
 * nothing else. Humans and agents rank the same way: an agent asking haat for a
 * block-print pattern should not get a different ordering than a person typing
 * the same words into the search bar.
 */

const router = Router()

const ALL = () => allProducts()

// ── Scorer ─────────────────────────────────────────────────────────────────
function scoreProduct(p, intent) {
  let score = 0
  const { categories = [], keywords = [], occasion, region, budget } = intent

  // Hard budget filter — exclude outright, don't just penalise
  if (budget?.max && p.price > budget.max) return -1

  const nameL = p.name.toLowerCase()
  const descL = (p.description ?? '').toLowerCase()
  const tagsL = (p.tags ?? []).map(t => t.toLowerCase())
  const subL  = (p.subcategory ?? '').toLowerCase()
  const licL  = (p.license ?? '').toLowerCase()
  const regL  = [p.state, p.city, p.region].filter(Boolean).map(s => s.toLowerCase()).join(' ')

  for (const kw of keywords) {
    const k = kw.toLowerCase()
    if (nameL.includes(k))                                  score += 4
    if (subL.includes(k) || tagsL.some(t => t.includes(k))) score += 3
    if (descL.includes(k))                                  score += 2
    if (licL.includes(k))                                   score += 1
  }

  // "categories" from the parser map onto digital subcategories here.
  if (categories.some(c => c.toLowerCase() === p.subcategory)) score += 3

  if (occasion) {
    const occ = occasion.toLowerCase()
    if ((p.occasions ?? []).some(o => o.toLowerCase().includes(occ))) score += 3
    if (tagsL.some(t => t.includes(occ)))                             score += 2
  }

  if (region && regL.includes(region.toLowerCase())) score += 2

  if (p.featured) score += 1
  score += (p.rating ?? 0) * 0.5

  return score
}

// ── POST /api/search ───────────────────────────────────────────────────────
router.post('/search', async (req, res, next) => {
  try {
    const { query, category } = req.body ?? {}
    if (!query?.trim()) return res.status(400).json({ error: '"query" is required' })

    const intent = await parseQuery(query)

    let pool = ALL().filter(p => p.available)
    if (category && category !== 'all') pool = pool.filter(p => p.subcategory === category)

    const scored = pool
      .map(p => ({ ...p, _score: scoreProduct(p, intent) }))
      .filter(p => p._score > 0)
      .sort((a, b) => b._score - a._score)

    const ranked = scored.length > 0 ? scored : [...pool].sort((a, b) => b.rating - a.rating)
    const products = ranked.map(({ _score, ...p }) => decorate(p))

    const narration = await makeNarration(products, query)

    res.json({ products, narration, intent, total: ranked.length, source: 'catalog' })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/products/:id ──────────────────────────────────────────────────
router.get('/products/:id', (req, res) => {
  const product = ALL().find(p => p.id === req.params.id)
  if (!product) return res.status(404).json({ error: 'Product not found' })
  res.json(decorate(product))
})

/** Attaches the fields a storefront card needs but the seed file doesn't hold. */
function decorate(p) {
  const stock = remainingStock(p.id)
  return {
    ...p,
    seller_verified: Boolean(sellerFor(p)?.haat_verified),
    remaining_stock: stock === Infinity ? null : stock,
  }
}

// ── Catalogue search (used by the agent route) ─────────────────────────────
export function searchCatalog(intent, limit = 20) {
  const pool = ALL().filter(p => p.available)
  const scored = pool
    .map(p => ({ ...p, _score: scoreProduct(p, intent) }))
    .filter(p => p._score > 0)
    .sort((a, b) => b._score - a._score)

  const ranked = scored.length > 0 ? scored : [...pool].sort((a, b) => b.rating - a.rating)
  return ranked.slice(0, limit).map(({ _score, ...p }) => decorate(p))
}

export default router
