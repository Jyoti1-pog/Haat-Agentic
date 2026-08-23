import fetch from 'node-fetch'

const TINYFISH_URL = 'https://agent.tinyfish.ai/v1/automation/run-sse'

// ── Category → target URLs ─────────────────────────────────────────────────
const CATEGORY_URLS = {
  sweets:      ['https://www.theindianstore.com', 'https://www.namkeen.net'],
  food:        ['https://www.theindianstore.com', 'https://www.namkeen.net'],
  clothing:    ['https://www.cbazaar.com', 'https://www.utsavfashion.com'],
  kurtas:      ['https://www.cbazaar.com', 'https://www.utsavfashion.com'],
  sarees:      ['https://www.cbazaar.com', 'https://www.utsavfashion.com'],
  spices:      ['https://www.theindianstore.com', 'https://www.spicesindia.co.in'],
  handicrafts: ['https://www.craftsvilla.com', 'https://www.jaypore.com'],
  'dry-fruits':['https://www.theindianstore.com', 'https://www.nuts.com'],
  tea:         ['https://www.teabox.com', 'https://www.theindianstore.com'],
  jewellery:   ['https://www.jaypore.com', 'https://www.craftsvilla.com'],
  default:     ['https://www.theindianstore.com', 'https://www.cbazaar.com', 'https://www.craftsvilla.com'],
}

function getUrlsForCategory(category) {
  if (!category) return CATEGORY_URLS.default
  const key = category.toLowerCase().trim()
  const match = Object.keys(CATEGORY_URLS).find(k => k !== 'default' && key.includes(k))
  return match ? CATEGORY_URLS[match] : CATEGORY_URLS.default
}

// ── SSE stream reader ──────────────────────────────────────────────────────
// Reads the full SSE stream from a node-fetch response body.
// Returns an array of parsed data payloads (one per SSE event).
async function readSSEStream(responseBody, signal) {
  const events = []
  let buffer = ''

  for await (const chunk of responseBody) {
    if (signal?.aborted) break
    buffer += chunk.toString('utf8')

    // SSE events are separated by double newlines
    const parts = buffer.split(/\n\n/)
    buffer = parts.pop() // last part may be incomplete — keep for next chunk

    for (const part of parts) {
      const dataLine = part
        .split('\n')
        .find(l => l.startsWith('data:'))
      if (!dataLine) continue

      const raw = dataLine.slice(5).trim()
      if (raw === '[DONE]') continue

      try {
        events.push(JSON.parse(raw))
      } catch {
        // Not valid JSON on its own — store as raw string for later extraction
        events.push({ _raw: raw })
      }
    }
  }

  // Flush any remaining buffer content
  if (buffer.trim()) {
    const dataLine = buffer.split('\n').find(l => l.startsWith('data:'))
    if (dataLine) {
      const raw = dataLine.slice(5).trim()
      if (raw && raw !== '[DONE]') {
        try { events.push(JSON.parse(raw)) } catch { events.push({ _raw: raw }) }
      }
    }
  }

  return events
}

// ── JSON array extractor ───────────────────────────────────────────────────
// Tries every known response shape to pull out a product array.
function extractProductArray(events) {
  // Walk events from last to first — the final event usually has the result
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]

    // Shape: already an array
    if (Array.isArray(ev)) return ev

    // Common keyed shapes
    for (const key of ['result', 'data', 'products', 'output', 'content', 'response']) {
      if (Array.isArray(ev[key])) return ev[key]
      // result/content can be a JSON string containing the array
      if (typeof ev[key] === 'string') {
        const arr = tryParseJsonArray(ev[key])
        if (arr) return arr
      }
    }

    // Raw string fallback — scan for an embedded JSON array
    if (ev._raw) {
      const arr = tryParseJsonArray(ev._raw)
      if (arr) return arr
    }
  }

  // Last resort: concatenate all _raw strings and scan the whole blob
  const blob = events.map(e => e._raw ?? '').join('')
  return tryParseJsonArray(blob)
}

// Finds and parses the first JSON array in a string (handles nested objects)
function tryParseJsonArray(str) {
  const start = str.indexOf('[')
  if (start === -1) return null

  // Walk forward tracking bracket depth to find the matching close bracket
  let depth = 0
  for (let i = start; i < str.length; i++) {
    if (str[i] === '[') depth++
    else if (str[i] === ']') {
      depth--
      if (depth === 0) {
        try {
          const parsed = JSON.parse(str.slice(start, i + 1))
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        } catch { /* malformed — keep scanning */ }
        break
      }
    }
  }
  return null
}

// ── Single-URL scraper ─────────────────────────────────────────────────────
async function scrapeFromUrl(url, query, category) {
  const apiKey = process.env.TINYFISH_API_KEY
  if (!apiKey) throw new Error('TINYFISH_API_KEY is not set')

  const goal =
    `Search for "${query}" products on this website. ` +
    `Return the top 8 results as a JSON array where each item has exactly these fields: ` +
    `name (string), price (number, in INR), description (one sentence string), ` +
    `image_url (string), product_url (string), seller_name (string), ` +
    `category (string), availability (string: "in stock" or "out of stock"). ` +
    `Return ONLY the raw JSON array with no extra text.`

  // Hard 25-second timeout per URL — prevents the SSE stream from hanging
  // indefinitely and blocking the entire request beyond the frontend's timeout.
  const controller = new AbortController()
  const timeoutId  = setTimeout(() => {
    console.warn(`[TinyFish] Aborting ${url} — exceeded 25s`)
    controller.abort()
  }, 25_000)

  try {
    const response = await fetch(TINYFISH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ url, goal }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`TinyFish HTTP ${response.status} for ${url}`)
    }

    // Pass the abort signal into the stream reader so the for-await loop
    // also stops immediately when the controller fires.
    const events   = await readSSEStream(response.body, controller.signal)
    clearTimeout(timeoutId)

    const products = extractProductArray(events)
    if (!products || products.length === 0) {
      throw new Error(`No products extracted from ${url}`)
    }

    // Normalise each product — fill missing fields with safe defaults
    return products.map(p => ({
      name:         p.name         ?? 'Unknown Product',
      price:        typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
      description:  p.description  ?? '',
      image_url:    p.image_url    ?? p.imageUrl ?? p.image ?? '',
      product_url:  p.product_url  ?? p.productUrl ?? p.url ?? '',
      seller_name:  p.seller_name  ?? p.sellerName ?? p.seller ?? new URL(url).hostname,
      category:     p.category     ?? category ?? 'general',
      availability: p.availability ?? 'in stock',
    }))
  } catch (err) {
    clearTimeout(timeoutId)
    throw err  // re-throw so Promise.allSettled marks it as rejected
  }
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function scrapeIndianProducts(query, category) {
  const urls = getUrlsForCategory(category)

  console.log(`[TinyFish] Scraping "${query}" (${category ?? 'mixed'}) from:`, urls)

  // Fan out to all target URLs in parallel; collect whatever succeeds
  const results = await Promise.allSettled(urls.map(url => scrapeFromUrl(url, query, category)))

  const succeeded = results.filter(r => r.status === 'fulfilled')
  const failed    = results.filter(r => r.status === 'rejected')

  if (failed.length) {
    failed.forEach(r => console.warn('[TinyFish] Scrape error:', r.reason?.message))
  }

  const products = succeeded.flatMap(r => r.value)

  if (products.length > 0) {
    console.log(`[TinyFish] Got ${products.length} products total, returning top 8`)
    return products.slice(0, 8)
  }

  // ── Fallback to mock catalog ─────────────────────────────────────────────
  console.warn('[TinyFish] All sources failed — falling back to mock catalog')
  try {
    const { getMockProducts } = await import('./mockCatalog.js')
    return getMockProducts(query, category)
  } catch {
    console.error('[TinyFish] Mock catalog not available either')
    return []
  }
}
