import Anthropic from '@anthropic-ai/sdk'
import { scrapeIndianProducts } from './tinyfish.js'
import { searchCatalog } from '../routes/search.js'

// Lazy-init so the client is created after dotenv has loaded env vars
let _anthropic = null
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

// Use claude-sonnet-4-6 — best balance of speed + capability for real-time chat
const MODEL = 'claude-sonnet-4-6'

// Maximum turns in the agentic tool loop before giving up
const MAX_TOOL_ITERATIONS = 5

// ── System prompt ────────────────────────────────────────────────────────────
// Shapes Claude's entire personality and decision-making logic
const SYSTEM = `You are haat's AI shopping companion — a warm, knowledgeable friend who grew up between India and the diaspora. You help Indians living abroad find and buy authentic Indian products from real markets across India.

YOUR PERSONALITY:
- Warm, like that one friend who knows every bazaar in every Indian city
- Deeply knowledgeable: you know the difference between Banarasi and Kanjivaram silk, which halwai makes the best Mysore Pak, what's in season
- Efficient: you don't waste people's time asking unnecessary questions
- Honest: you mention price ranges, delivery realities, what's authentic vs touristy

YOUR DECISION RULES:
1. If the user's intent is clear enough to search → call search_products IMMEDIATELY. Do not ask permission.
   - Clear enough: "Diwali sweets", "silk saree under 5000", "Kashmiri saffron", "gift for mom"
2. If genuinely ambiguous (you truly cannot determine what to search) → ask ONE concise question. Not multiple.
3. After searching, respond with warmth and specifics. Name products. Mention cities of origin.
4. If user asks about a specific product from your results → call get_product_details
5. If user says they want to buy / take / order a product ("I'll take the halwa", "add the saree", "order this") → call add_to_cart with that product_id immediately. Confirm warmly.

RESPONSE FORMAT:
- Keep your conversational text short: 1-3 sentences max. Products speak for themselves.
- Use occasional Hindi words where natural (mithai, puja, kurta, saree, dupatta) but never forced
- ALWAYS end your response with this exact line format (mandatory, no exceptions):
  SUGGESTIONS: "option 1" | "option 2" | "option 3"
  (Give 3 relevant follow-up options the user might want)

EXAMPLES OF GOOD SUGGESTIONS:
- After showing sweets: SUGGESTIONS: "Show me more mithai options" | "Show under ₹1000" | "What about savoury snacks?"
- After showing sarees: SUGGESTIONS: "Show me Banarasi options" | "Filter under ₹5000" | "Show matching dupattas"
- After a question: SUGGESTIONS: "Yes, show me options" | "Under ₹2000 please" | "Something for Diwali"

You represent haat — a platform that believes the smell of cardamom should be able to cross an ocean.`

// ── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'search_products',
    description: 'Search for Indian products. Call this as soon as you have enough information. Do NOT ask the user first — just search.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query. Be specific and descriptive. Examples: "Diwali mithai gift box", "handwoven Banarasi silk saree", "Kashmiri saffron premium"',
        },
        category: {
          type: 'string',
          enum: ['sweets', 'clothing', 'sarees', 'spices', 'handicrafts', 'dry-fruits', 'tea', 'food', 'jewellery', 'any'],
          description: 'Product category. Use "any" if the query spans categories.',
        },
        budget_inr: {
          type: 'number',
          description: 'Maximum budget in INR if the user mentioned one.',
        },
        occasion: {
          type: 'string',
          description: 'Occasion if mentioned: Diwali, Holi, wedding, birthday, Eid, anniversary, puja, etc.',
        },
        region: {
          type: 'string',
          description: 'Indian region, state, or city preference if mentioned: Kashmir, Bengal, Rajasthan, Varanasi, etc.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product_details',
    description: 'Get full details of a specific product when the user asks about it, wants to know more, or is considering buying it.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID from the search results.',
        },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'add_to_cart',
    description: 'Add a product to the cart when the user says they want it, will take it, want to buy it, or ask to add it. Call this immediately — do not ask for confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID to add. Must be from the current session\'s search results.',
        },
        qty: {
          type: 'number',
          description: 'Quantity to add. Default 1.',
        },
      },
      required: ['product_id'],
    },
  },
]

// ── Normalise product from any source to a consistent schema ─────────────────
function normaliseProduct(p, index, source) {
  // Handle TinyFish live products (snake_case) vs catalog products (camelCase/flat)
  const isLive = source === 'live'

  return {
    id:          p.id ?? `live_${index}`,
    name:        p.name ?? 'Unknown Product',
    price:       typeof p.price === 'number' ? Math.round(p.price) : (parseInt(p.price) || 0),
    priceUSD:    p.priceUSD ?? +(( (typeof p.price === 'number' ? p.price : parseInt(p.price) || 0) ) / 83.5).toFixed(2),
    image:       p.image ?? p.image_url ?? p.imageUrl ?? `https://picsum.photos/seed/${p.id ?? index}/400/500`,
    description: p.description ?? '',
    category:    p.category ?? 'general',
    subcategory: p.subcategory ?? null,
    seller:      p.seller ?? p.seller_name ?? p.sellerName ?? 'Indian Artisan',
    city:        p.city ?? null,
    state:       p.state ?? null,
    region:      p.region ?? null,
    rating:      typeof p.rating === 'number' ? p.rating : 4.2,
    reviews:     p.reviews ?? 0,
    tags:        Array.isArray(p.tags) ? p.tags : [],
    occasions:   Array.isArray(p.occasions) ? p.occasions : [],
    material:    p.material ?? null,
    weight:      p.weight ?? null,
    featured:    p.featured ?? false,
    available:   p.available ?? (p.availability === 'in stock' || p.availability !== 'out of stock'),
    productUrl:  p.productUrl ?? p.product_url ?? null,
    source,
  }
}

// ── Execute a tool call ──────────────────────────────────────────────────────
async function executeTool(toolName, input, session) {
  console.log(`[Agent] → Tool: ${toolName}`, JSON.stringify(input))

  if (toolName === 'search_products') {
    const { query, category, budget_inr, occasion, region } = input
    let products = []
    let source = 'catalog'

    // ── Attempt 1: TinyFish live search ─────────────────────────────────
    try {
      const liveRaw = await scrapeIndianProducts(
        query,
        category && category !== 'any' ? category : null
      )
      if (liveRaw.length > 0) {
        products = liveRaw.map((p, i) => normaliseProduct(p, i, 'live'))
        source = 'live'
        console.log(`[Agent] TinyFish returned ${products.length} live products`)
      }
    } catch (err) {
      console.warn('[Agent] TinyFish failed, falling back to catalog:', err.message)
    }

    // ── Attempt 2: Catalog fallback ──────────────────────────────────────
    if (products.length === 0) {
      const intent = {
        keywords:   query.split(/\s+/).filter(Boolean),
        categories: category && category !== 'any' ? [category] : [],
        occasion:   occasion ?? null,
        budget:     budget_inr ? { max: budget_inr } : null,
        region:     region   ?? null,
      }
      const catalogRaw = searchCatalog(intent, 12)
      products = catalogRaw.map((p, i) => normaliseProduct(p, i, 'catalog'))
      source = 'catalog'
      console.log(`[Agent] Catalog returned ${products.length} products`)
    }

    // Apply budget filter post-search if needed
    if (budget_inr && budget_inr > 0) {
      const filtered = products.filter(p => p.price <= budget_inr)
      if (filtered.length > 0) products = filtered
    }

    // Store in session for follow-up reference
    session.lastProducts = products
    session.lastQuery    = query
    session.lastSource   = source

    // Return a compact summary to Claude (not the full image URLs, etc.)
    return {
      found:    products.length,
      source,
      products: products.map(p => ({
        id:          p.id,
        name:        p.name,
        price_inr:   p.price,
        price_usd:   p.priceUSD,
        category:    p.category,
        city:        p.city,
        state:       p.state,
        rating:      p.rating,
        description: p.description?.slice(0, 120),
        seller:      p.seller,
        tags:        p.tags?.slice(0, 5),
        available:   p.available,
      })),
    }
  }

  if (toolName === 'get_product_details') {
    const { product_id } = input
    const product = session.lastProducts?.find(p => p.id === product_id)
    if (!product) return { error: 'Product not found in current results. Ask the user to search again.' }
    return { product }
  }

  if (toolName === 'add_to_cart') {
    const { product_id, qty = 1 } = input
    const product = session.lastProducts?.find(p => p.id === product_id)
    if (!product) return { error: 'Product not found. Ask the user to search again first.' }

    // Track in session cart
    if (!session.cart) session.cart = []
    const existing = session.cart.find(i => i.id === product_id)
    if (existing) {
      existing.qty += qty
    } else {
      session.cart.push({ ...product, qty })
    }

    const total = session.cart.reduce((s, i) => s + i.price * i.qty, 0)
    console.log(`[Cart] +${qty}× ${product.name} | Cart total: ₹${total}`)

    return {
      added:    true,
      product:  { id: product.id, name: product.name, price: product.price, qty },
      cartSize: session.cart.length,
      cartTotal: total,
    }
  }

  return { error: `Unknown tool: ${toolName}` }
}

// ── Parse Claude's text response ─────────────────────────────────────────────
function parseResponse(raw) {
  // Extract SUGGESTIONS: "a" | "b" | "c" line
  const sugLine = raw.match(/SUGGESTIONS:\s*(.+)$/m)
  let suggestions = []

  if (sugLine) {
    // Parse pipe-separated quoted suggestions
    const matches = sugLine[1].match(/"([^"]+)"/g)
    if (matches) {
      suggestions = matches.map(s => s.replace(/"/g, '').trim()).filter(Boolean)
    }
  }

  // Strip the SUGGESTIONS line from the displayed message
  const message = raw
    .replace(/\n?SUGGESTIONS:\s*.+$/m, '')
    .trim()

  return { message, suggestions }
}

// ── Build personalized system prompt from user profile ───────────────────────
export function buildSystemPrompt(user) {
  if (!user) return SYSTEM

  const lines = []

  if (user.name)        lines.push(`User's name: ${user.name} (address them by name naturally, not every message)`)
  if (user.country)     lines.push(`Lives in: ${user.country}${user.countryCode ? ` (${user.countryCode})` : ''}`)
  if (user.homeState)   lines.push(`Originally from: ${user.homeState}, India (they may feel nostalgic about this region's specialties)`)
  if (user.dietary?.length)  lines.push(`Dietary preferences: ${user.dietary.join(', ')} — only suggest products that fit this`)
  if (user.budgetRange) {
    const rangeMap = { budget: '₹500–₹2,000', mid: '₹2,000–₹8,000', premium: '₹8,000+' }
    lines.push(`Typical budget range: ${rangeMap[user.budgetRange] ?? user.budgetRange} — match search results to this unless they specify otherwise`)
  }
  if (user.occasions?.length) lines.push(`Occasions they care about: ${user.occasions.join(', ')}`)

  if (!lines.length) return SYSTEM

  return SYSTEM + `\n\n─────────────────────────────────\nUSER PROFILE (use this to personalise every response):\n${lines.join('\n')}\n─────────────────────────────────`
}

// ── Trim history to stay within context limits ───────────────────────────────
// Keeps the last N turns (each turn = user + assistant pair)
function trimHistory(history, keepTurns = 10) {
  if (history.length <= keepTurns * 2) return history
  return history.slice(history.length - keepTurns * 2)
}

// ── Main export: run one conversation turn ────────────────────────────────────
// session = { history: Message[], lastProducts: Product[]|null, lastQuery: string|null, ... }
// user    = User object from userStore (or null for guest)
// Returns: { message: string, products: Product[]|null, suggestions: string[], source: string|null }
export async function runConversation(userMessage, session, user = null) {
  const systemPrompt = buildSystemPrompt(user)

  // Build message list: history + new user message
  const newUserMsg = { role: 'user', content: userMessage }
  let currentMessages = [...session.history, newUserMsg]

  let products  = null
  let source    = null

  // ── Agentic tool loop ────────────────────────────────────────────────────
  for (let turn = 0; turn < MAX_TOOL_ITERATIONS; turn++) {
    let response

    try {
      response = await getClient().messages.create({
        model:      MODEL,
        max_tokens: 1024,
        system:     systemPrompt,
        tools:      TOOLS,
        messages:   currentMessages,
      })
    } catch (err) {
      console.error('[Agent] Claude API error:', err.message)
      throw err
    }

    // ── Claude wants to call tools ───────────────────────────────────────
    if (response.stop_reason === 'tool_use') {
      const toolBlocks = response.content.filter(b => b.type === 'tool_use')
      const toolResults = []

      for (const block of toolBlocks) {
        let result
        try {
          result = await executeTool(block.name, block.input, session)
        } catch (err) {
          console.error(`[Agent] Tool ${block.name} threw:`, err.message)
          result = { error: err.message }
        }

        // If we got products from a search, keep them for the response
        if (block.name === 'search_products' && result.products) {
          products = session.lastProducts  // full normalised objects
          source   = result.source
        }

        toolResults.push({
          type:        'tool_result',
          tool_use_id: block.id,
          content:     JSON.stringify(result),
        })
      }

      // Append assistant turn + tool results, then loop back
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user',      content: toolResults },
      ]
      continue
    }

    // ── Claude finished (end_turn) ───────────────────────────────────────
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text')
      const raw = textBlock?.text ?? "I found some options for you. Let me know if you'd like to refine your search."

      const { message, suggestions } = parseResponse(raw)

      // Persist full conversation (with tool calls) to session history
      session.history = trimHistory([
        ...currentMessages,
        { role: 'assistant', content: response.content },
      ])

      const cartItems = session.cart ?? []
      const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0)

      console.log(`[Agent] Done. Message: "${message.slice(0, 80)}..." | Products: ${products?.length ?? 0} | Cart: ${cartItems.length} items`)

      return {
        message,
        products:    products ?? null,
        suggestions: suggestions.length > 0 ? suggestions : defaultSuggestions(products),
        source:      source ?? session.lastSource ?? null,
        cart:        cartItems.length > 0 ? { items: cartItems, total: cartTotal, count: cartItems.reduce((s,i)=>s+i.qty,0) } : null,
      }
    }

    // Unexpected stop reason — break and use fallback
    console.warn('[Agent] Unexpected stop_reason:', response.stop_reason)
    break
  }

  // ── Fallback response ────────────────────────────────────────────────────
  return {
    message:     "I'm having a moment connecting to the markets. Give me one more try?",
    products:    null,
    suggestions: ['Search for Diwali gifts', 'Show me popular sarees', 'Browse handicrafts'],
    source:      null,
  }
}

// ── Generate default suggestions when Claude doesn't provide them ─────────────
function defaultSuggestions(products) {
  if (!products || products.length === 0) {
    return ['Search for sweets', 'Show me sarees', 'Browse handicrafts']
  }
  const category = products[0]?.category ?? 'products'
  return [
    `Show more ${category}`,
    'Filter by price',
    'Tell me about the top result',
  ]
}
