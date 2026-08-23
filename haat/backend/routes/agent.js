import { Router } from 'express'
import fetch from 'node-fetch'
import { parseQuery as parseUserQuery, makeNarration as generateProductNarration } from '../services/claude.js'
import { scrapeIndianProducts } from '../services/tinyfish.js'
import { searchCatalog } from './search.js'

const router = Router()

const TINYFISH_URL = 'https://agent.tinyfish.ai/v1/automation/run-sse'

// ── Minimal SSE reader for single-object responses ─────────────────────────
// Used for the stock-check call which returns { inStock, price }, not an array.
async function readTinyfishObject(responseBody) {
  let buffer = ''
  let lastObject = null

  for await (const chunk of responseBody) {
    buffer += chunk.toString('utf8')

    const parts = buffer.split(/\n\n/)
    buffer = parts.pop()

    for (const part of parts) {
      const dataLine = part.split('\n').find(l => l.startsWith('data:'))
      if (!dataLine) continue

      const raw = dataLine.slice(5).trim()
      if (raw === '[DONE]') continue

      // Try the whole payload first
      try {
        const ev = JSON.parse(raw)
        // Look for a nested object in common response keys
        for (const key of ['result', 'data', 'output', 'content', 'response']) {
          if (ev[key] && typeof ev[key] === 'object' && !Array.isArray(ev[key])) {
            lastObject = ev[key]; break
          }
          if (typeof ev[key] === 'string') {
            const m = ev[key].match(/\{[\s\S]*?\}/)
            if (m) { try { lastObject = JSON.parse(m[0]); break } catch {} }
          }
        }
        // If the event itself looks like our target shape, use it
        if (!lastObject && (ev.inStock !== undefined || ev.in_stock !== undefined)) {
          lastObject = ev
        }
      } catch {
        // Scan raw string for a JSON object
        const m = raw.match(/\{[\s\S]*?\}/)
        if (m) { try { lastObject = JSON.parse(m[0]) } catch {} }
      }
    }
  }

  return lastObject
}

// ── Live stock verification via TinyFish ──────────────────────────────────
async function verifyStock(productUrl) {
  const apiKey = process.env.TINYFISH_API_KEY
  if (!apiKey) throw new Error('TINYFISH_API_KEY is not set')
  if (!productUrl) throw new Error('No product_url to verify')

  const goal =
    'Is this product currently in stock and available to buy? ' +
    'Return ONLY a JSON object with exactly these fields: ' +
    '{ "inStock": boolean, "price": number (current price in INR, 0 if unavailable) }'

  const response = await fetch(TINYFISH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ url: productUrl, goal }),
  })

  if (!response.ok) {
    throw new Error(`TinyFish stock-check HTTP ${response.status}`)
  }

  const raw = await readTinyfishObject(response.body)
  if (!raw) throw new Error('Could not parse stock-check response')

  return {
    inStock: raw.inStock ?? raw.in_stock ?? raw.available ?? true,
    livePrice: typeof raw.price === 'number' ? raw.price : 0,
  }
}

// ── Session store (in-memory, replace with Redis in production) ────────────
const sessions = new Map()

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { history: [], createdAt: Date.now() })
  }
  return sessions.get(sessionId)
}

// Evict sessions older than 30 minutes to prevent memory growth
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(id)
  }
}, 5 * 60 * 1000)

// ── POST /api/agent/shop ───────────────────────────────────────────────────
router.post('/shop', async (req, res) => {
  try {
    const { query, sessionId = `sess_${Date.now()}` } = req.body ?? {}
    if (!query?.trim()) {
      return res.status(400).json({ error: '"query" is required' })
    }

    const session = getSession(sessionId)
    session.history.push({ role: 'user', query, ts: Date.now() })

    // ── Step 1: Parse intent
    let parsedIntent
    try {
      parsedIntent = await parseUserQuery(query)
    } catch (err) {
      console.warn('[Agent] Claude parse failed, using empty intent:', err.message)
      parsedIntent = { categories: [], keywords: query.split(/\s+/), occasion: null,
                       priceRange: null, regionPreference: null, giftFor: null, urgency: null }
    }

    // ── Step 2: Source products (live first, catalog fallback)
    let products = []
    let source = 'catalog'

    try {
      const category = parsedIntent.categories?.[0] ?? null
      const live = await scrapeIndianProducts(query, category)
      if (live.length > 0) { products = live; source = 'live' }
    } catch (err) {
      console.warn('[Agent] Live scrape failed:', err.message)
    }

    if (products.length === 0) {
      products = searchCatalog(parsedIntent, 20)
      source = 'catalog'
    }

    const topProducts = products.slice(0, 12)

    // ── Step 3: Parallel — narration + stock verification of top product
    const [narration, stockResult] = await Promise.allSettled([
      generateProductNarration(topProducts, query).catch(err => {
        console.warn('[Agent] Narration failed:', err.message)
        return `Found ${topProducts.length} great options for you.`
      }),
      (async () => {
        const top = topProducts[0]
        if (!top?.product_url) return null
        return verifyStock(top.product_url)
      })(),
    ])

    const narrationText = narration.status === 'fulfilled'
      ? narration.value
      : `Found ${topProducts.length} products matching your search.`

    const stockInfo = stockResult.status === 'fulfilled' ? stockResult.value : null

    if (stockResult.status === 'rejected') {
      console.warn('[Agent] Stock verify failed:', stockResult.reason?.message)
    }

    // ── Step 4: Enrich top product with live stock data
    const enrichedProducts = topProducts.map((p, i) => {
      if (i !== 0 || !stockInfo) return p
      return {
        ...p,
        liveVerified: true,
        inStock: stockInfo.inStock,
        ...(stockInfo.livePrice > 0 ? { livePrice: stockInfo.livePrice } : {}),
      }
    })

    // Persist result to session history
    session.history.push({
      role: 'assistant',
      source,
      productCount: enrichedProducts.length,
      ts: Date.now(),
    })

    res.json({
      products: enrichedProducts,
      narration: narrationText,
      parsedIntent,
      source,
      totalFound: products.length,
      stockVerification: stockInfo
        ? { checked: true, productName: topProducts[0]?.name, ...stockInfo }
        : { checked: false, reason: 'No product URL available or verification failed' },
      session: { id: sessionId, turnCount: session.history.filter(h => h.role === 'user').length },
    })
  } catch (err) {
    console.error('[Agent] Unhandled error:', err)
    res.status(500).json({ error: 'Agent pipeline failed', detail: err.message })
  }
})

export default router
