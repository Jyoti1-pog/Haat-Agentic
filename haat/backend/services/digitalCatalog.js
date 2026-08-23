/**
 * digitalCatalog.js — the digital half of the haat catalogue
 *
 * Digital SKUs live alongside the physical ones rather than in a separate
 * marketplace, but they carry extra fields the physical catalogue has no use
 * for (deliverable kind, stock of unlock codes, the agent-checkout toggle), so
 * they get their own seed file and this loader joins the three of them:
 *
 *   digital-products.json     → the SKU
 *   sellers.json              → who sells it, and whether haat has verified them
 *   digital-deliverables.json → what is actually handed over on payment
 *
 * Read once at boot, same as routes/search.js does with products.json.
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { consumedCodes, listSellerProducts, listSellerDeliverables } from './agentStore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = name => JSON.parse(readFileSync(join(__dirname, '../data', name), 'utf8'))

const SEED_PRODUCTS     = read('digital-products.json')
const SELLERS           = read('sellers.json')
const SEED_DELIVERABLES = read('digital-deliverables.json')

export const DIGITAL_ASSET_DIR = join(__dirname, '../data/digital')

// ── Lookups ──────────────────────────────────────────────────────────────────
// Seed rows are the committed fixture; seller rows are whatever has been added
// through the dashboard at runtime. Everything downstream reads the union, so a
// product a seller listed a minute ago is as buyable by an agent as a seeded one.
export const allProducts = () => [...SEED_PRODUCTS, ...listSellerProducts()]
export const allSellers  = () => SELLERS

const allDeliverables = () => [...SEED_DELIVERABLES, ...listSellerDeliverables()]

export const getProduct = id => allProducts().find(p => p.id === id) ?? null
export const getSeller  = id => SELLERS.find(s => s.id === id) ?? null
export const getDeliverable = productId => allDeliverables().find(d => d.product_id === productId) ?? null

export function sellerFor(product) {
  return product ? getSeller(product.seller_id) : null
}

/** Unlock codes left in the pool. File-delivered goods are unlimited. */
export function remainingStock(productId) {
  const deliverable = getDeliverable(productId)
  if (!deliverable || deliverable.kind !== 'code') return Infinity
  return (deliverable.code_pool?.length ?? 0) - consumedCodes(productId).length
}

/** The next unconsumed code, without consuming it. */
export function peekCode(productId) {
  const deliverable = getDeliverable(productId)
  if (!deliverable?.code_pool) return null
  const used = new Set(consumedCodes(productId).map(c => c.code))
  return deliverable.code_pool.find(c => !used.has(c)) ?? null
}

// ── Search ───────────────────────────────────────────────────────────────────
/**
 * Keyword scoring over the digital catalogue. Deliberately the same shape as
 * routes/search.js — an agent searching haat should not get a different ranking
 * model than a human does.
 *
 * `agentOnly` restricts results to SKUs the seller opened to AI buyers; the
 * storefront passes false, the agent tools pass true.
 */
export function search({ query = '', maxPricePaise = null, agentOnly = true, limit = 12 } = {}) {
  const terms = String(query).toLowerCase().split(/[^a-z0-9₹$]+/i).filter(t => t.length > 2)

  let pool = allProducts().filter(p => p.available)
  if (agentOnly) pool = pool.filter(p => p.agent_checkout_enabled)
  if (maxPricePaise != null) pool = pool.filter(p => p.price * 100 <= maxPricePaise)

  const scored = pool.map(p => {
    const hay = {
      name: p.name.toLowerCase(),
      desc: (p.description ?? '').toLowerCase(),
      tags: (p.tags ?? []).map(t => t.toLowerCase()),
      sub:  (p.subcategory ?? '').toLowerCase(),
      loc:  [p.city, p.state, p.region].filter(Boolean).join(' ').toLowerCase(),
    }

    let score = 0
    for (const t of terms) {
      if (hay.name.includes(t))                 score += 4
      if (hay.sub.includes(t))                  score += 3
      if (hay.tags.some(tag => tag.includes(t))) score += 3
      if (hay.desc.includes(t))                 score += 2
      if (hay.loc.includes(t))                  score += 2
    }
    if (p.featured) score += 1
    score += (p.rating ?? 0) * 0.5

    return { p, score }
  })

  // An empty or unmatched query still returns the catalogue — an agent asking
  // broadly ("what digital goods do you have") should get an answer, not zero
  // results it might read as "this merchant sells nothing".
  const matched = terms.length ? scored.filter(s => s.score > (terms.length ? 0.5 : 0)) : scored
  const ranked = (matched.length ? matched : scored).sort((a, b) => b.score - a.score)

  return ranked.slice(0, limit).map(({ p }) => p)
}

// ── Public shapes ────────────────────────────────────────────────────────────
/** What an agent sees in a search result — never includes the deliverable itself. */
export function toAgentSummary(product) {
  const seller = sellerFor(product)
  const stock  = remainingStock(product.id)
  return {
    product_id:   product.id,
    name:         product.name,
    description:  product.description,
    price_paise:  product.price * 100,
    price_inr:    product.price,
    price_usd:    product.priceUSD,
    currency:     'INR',
    deliverable_kind: product.digital_deliverable_type,
    delivery_mode:    product.delivery_mode,
    license:      product.license,
    seller_name:  product.seller,
    seller_verified: Boolean(seller?.haat_verified),
    remaining_stock: stock === Infinity ? null : stock,
    single_use:   product.max_purchases === 1,
  }
}

export function toAgentDetail(product) {
  return {
    ...toAgentSummary(product),
    category:     product.category,
    subcategory:  product.subcategory,
    file_size:    product.file_size,
    rating:       product.rating,
    reviews:      product.reviews,
    origin:       [product.city, product.state].filter(Boolean).join(', '),
    tags:         product.tags,
    agent_checkout_enabled: product.agent_checkout_enabled,
    max_purchases: product.max_purchases,
    image:        product.image,
  }
}
