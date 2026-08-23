import { Router }    from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join }  from 'path'
import { parseQuery, makeNarration } from '../services/claude.js'

const router    = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))
const ALL       = JSON.parse(readFileSync(join(__dirname, '../data/products.json'), 'utf8'))

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
  const matL  = (p.material ?? '').toLowerCase()
  const regL  = [p.state, p.city, p.region].filter(Boolean).map(s => s.toLowerCase()).join(' ')

  for (const kw of keywords) {
    const k = kw.toLowerCase()
    if (nameL.includes(k))                    score += 4
    if (subL.includes(k) || tagsL.some(t => t.includes(k))) score += 3
    if (descL.includes(k))                    score += 2
  }

  if (categories.some(c => c.toLowerCase() === p.category)) score += 2

  if (occasion) {
    const occ = occasion.toLowerCase()
    if ((p.occasions ?? []).some(o => o.toLowerCase().includes(occ))) score += 3
    if (tagsL.some(t => t.includes(occ)))   score += 2
  }

  if (region) {
    const r = region.toLowerCase()
    if (regL.includes(r))                    score += 2
  }

  if (keywords.some(k => matL.includes(k.toLowerCase()))) score += 3

  // Featured boost + rating tiebreaker
  if (p.featured) score += 1
  score += (p.rating ?? 0) * 0.5

  return score
}

// ── POST /api/search ───────────────────────────────────────────────────────
router.post('/search', async (req, res, next) => {
  try {
    const { query, category, mode } = req.body ?? {}
    if (!query?.trim()) return res.status(400).json({ error: '"query" is required' })

    // 1. Parse intent
    const intent = await parseQuery(query)

    // 2. Hard category filter if provided
    let pool = ALL.filter(p => p.available)
    if (category) pool = pool.filter(p => p.category === category)

    // 3. Score + rank
    const scored = pool
      .map(p => ({ ...p, _score: scoreProduct(p, intent) }))
      .filter(p => p._score > 0)
      .sort((a, b) => b._score - a._score)

    // Fallback: if nothing scored, return featured sorted by rating
    const ranked = scored.length > 0
      ? scored
      : pool.sort((a, b) => b.rating - a.rating)

    const products = ranked.slice(0, 12).map(({ _score, ...p }) => p)

    // 4. Narration
    const narration = await makeNarration(products, query)

    res.json({ products, narration, intent, total: ranked.length, source: 'catalog' })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/products/:id ──────────────────────────────────────────────────
router.get('/products/:id', (req, res) => {
  const product = ALL.find(p => p.id === req.params.id)
  if (!product) return res.status(404).json({ error: 'Product not found' })
  res.json(product)
})

// ── Catalog search function (used by agent route) ─────────────────────────
export function searchCatalog(intent, limit = 20) {
  const pool = ALL.filter(p => p.available)
  const scored = pool
    .map(p => ({ ...p, _score: scoreProduct(p, intent) }))
    .filter(p => p._score > 0)
    .sort((a, b) => b._score - a._score)

  const ranked = scored.length > 0
    ? scored
    : pool.sort((a, b) => b.rating - a.rating)

  return ranked.slice(0, limit).map(({ _score, ...p }) => p)
}

export default router
