import Anthropic from '@anthropic-ai/sdk'

const MODEL  = 'claude-sonnet-4-20250514'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Query parser ────────────────────────────────────────────────────────────
const PARSE_SYSTEM = `Parse shopping queries for haat, an Indian marketplace.
Return ONLY raw JSON (no markdown, no explanation):
{
  "categories": string[],
  "keywords": string[],
  "occasion": string|null,
  "budget": {"max": number}|null,
  "region": string|null,
  "giftFor": string|null,
  "summary": string
}
- categories: only from [sweets, clothing, sarees, spices, handicrafts]
- keywords: specific items, fabrics, colours, styles mentioned
- budget.max is in INR; infer from "under X", "₹X", "around X"
- occasion: Diwali, Holi, wedding, birthday, Eid, anniversary, housewarming, etc.
- region: Indian region, state, or city (e.g. Rajasthan, Bengal, Kashmir)
- summary: one short sentence describing the intent`

export async function parseQuery(query) {
  try {
    const msg = await client.messages.create({
      model:      MODEL,
      max_tokens: 400,
      system:     PARSE_SYSTEM,
      messages:   [{ role: 'user', content: query }],
    })

    const raw   = msg.content[0]?.text ?? ''
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(clean)
  } catch {
    return {
      categories: [], keywords: [query], occasion: null,
      budget: null, region: null, giftFor: null, summary: query,
    }
  }
}

// ── Narration ───────────────────────────────────────────────────────────────
const NARRATION_SYSTEM = `You narrate Indian product search results warmly and concisely for haat,
a platform connecting the Indian diaspora to home.
Write EXACTLY 2 sentences, 80 words max. Speak as if to a friend missing home.
Mention 1-2 specific products with their prices. Poetic but brief. No markdown.

Tone guidance: Write with slight Indian warmth and cadence.
Use occasional soft phrases like "wonderful", "lovely", "do try", "straight from" —
but keep it natural and modern. Never sound like a caricature.
Sound like a knowledgeable friend who grew up between two worlds.
Examples of good phrases: "Straight from the weavers of Varanasi...",
"You'll love how this one arrives packed with the smell of cardamom...",
"Do try the Kashmiri saffron — it's the real thing."`

export async function makeNarration(products, query) {
  if (!products?.length) {
    return "We searched every corner of India's bazaars for you. Try a different query and let our agents look again."
  }

  const top3 = products.slice(0, 3).map(p =>
    `${p.name} (₹${p.price}, ${p.city})`
  ).join(' · ')

  try {
    const msg = await client.messages.create({
      model:      MODEL,
      max_tokens: 160,
      system:     NARRATION_SYSTEM,
      messages:   [{
        role:    'user',
        content: `Query: "${query}"\nTop results: ${top3}`,
      }],
    })
    return msg.content[0]?.text?.trim() ?? ''
  } catch {
    return `Found ${products.length} authentic products from India's finest artisans and markets.`
  }
}
