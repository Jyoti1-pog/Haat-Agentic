/**
 * sellerProducts.js — seller-side product listing
 *
 * haat sells digital goods only, so there is no product type to choose: every
 * listing is digital and the only real question is how it is delivered — a file
 * haat hosts and signs, a pool of unlock codes, or a link the seller hosts.
 *
 * Created products are held in the runtime store rather than written back into
 * the seed file, so the committed catalogue stays a fixture and anything listed
 * during a demo can be cleared without a git diff. They are otherwise
 * first-class: an agent can find and buy a product a seller listed a minute ago,
 * and it passes through exactly the same guardrails.
 */

import { Router } from 'express'
import multer from 'multer'
import * as store from '../services/agentStore.js'
import { getSeller, allSellers, allProducts, remainingStock } from '../services/digitalCatalog.js'
import { fmtBoth } from '../services/guardrails.js'

const router = Router()

// Deliverables are held in memory then base64'd into the store. Fine at this
// size; a real deployment would stream these to object storage instead.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  // Busboy decodes multipart text fields as latin1 unless told otherwise, which
  // turns every em dash and every Devanagari character a seller types into
  // mojibake. This catalogue is full of both.
  defParamCharset: 'utf8',
})

const FIELDS = [{ name: 'cover', maxCount: 1 }, { name: 'deliverable', maxCount: 1 }]

const clean = v => (typeof v === 'string' ? v.trim() : v)
const asBool = v => v === true || v === 'true' || v === 'on' || v === '1'

// ── GET /api/seller/sellers ──────────────────────────────────────────────────
// Who a listing can be attributed to, and whether haat has verified them —
// surfaced so the form can warn that an unverified seller's products will be
// refused to AI buyers before they spend time filling the rest in.
router.get('/sellers', (_req, res) => {
  res.json({
    sellers: allSellers().map(s => ({
      id: s.id, name: s.name, city: s.city, state: s.state,
      haat_verified: s.haat_verified, verified_since: s.verified_since,
    })),
  })
})

// ── GET /api/seller/products ─────────────────────────────────────────────────
router.get('/products', (req, res) => {
  const sellerId = req.query.seller_id
  const rows = store.listSellerProducts()
    .filter(p => !sellerId || p.seller_id === sellerId)
  res.json({ products: rows, total: rows.length })
})

// ── POST /api/seller/products ────────────────────────────────────────────────
router.post('/products', upload.fields(FIELDS), (req, res) => {
  const b = req.body ?? {}
  const errors = []

  const name        = clean(b.name)
  const description = clean(b.description)
  const price       = Number(b.price)
  const seller_id   = clean(b.seller_id)

  if (!name)                       errors.push('name is required')
  if (!description)                errors.push('description is required')
  if (!Number.isFinite(price) || price <= 0) errors.push('price must be a positive number of rupees')
  if (!seller_id)                  errors.push('seller_id is required')
  else if (!getSeller(seller_id))  errors.push(`no such seller: ${seller_id}`)

  // ── Delivery ───────────────────────────────────────────────────────────────
  let deliverableRow = null
  let digital = {}

  {
    const kind = clean(b.digital_deliverable_type)
    if (!['file', 'code', 'link'].includes(kind)) {
      errors.push('digital_deliverable_type must be one of: file, code, link')
    }

    const maxPurchasesRaw = clean(b.max_purchases)
    const max_purchases = maxPurchasesRaw === '' || maxPurchasesRaw == null
      ? null                                   // blank means unlimited
      : Number(maxPurchasesRaw)
    if (max_purchases !== null && (!Number.isInteger(max_purchases) || max_purchases < 1)) {
      errors.push('max_purchases must be a whole number of 1 or more, or blank for unlimited')
    }

    const file = req.files?.deliverable?.[0]
    const codePool = String(b.code_pool ?? '')
      .split('\n').map(c => c.trim()).filter(Boolean)
    const external_url = clean(b.external_url)

    if (kind === 'file' && !file)          errors.push('a deliverable file is required for file delivery')
    if (kind === 'code' && !codePool.length) errors.push('at least one unlock code is required for code delivery')
    if (kind === 'link' && !external_url)  errors.push('an access URL is required for link delivery')
    if (kind === 'code' && new Set(codePool).size !== codePool.length) {
      errors.push('unlock codes must be unique')
    }
    if (kind === 'link' && external_url && !/^https:\/\//i.test(external_url)) {
      errors.push('the access URL must be https')
    }

    if (!errors.length) {
      const productId = store.newId('dp')
      const deliverableId = store.newId('dd')
      let asset_id = null

      if (kind === 'file') {
        asset_id = store.newId('asset')
        store.putSellerAsset(asset_id, {
          filename: file.originalname,
          mimetype: file.mimetype,
          base64: file.buffer.toString('base64'),
        })
      }

      deliverableRow = {
        id: deliverableId,
        product_id: productId,
        kind,
        storage_path: null,
        asset_id,
        filename: file?.originalname ?? null,
        code_pool: kind === 'code' ? codePool : null,
        external_url: kind === 'link' ? external_url : null,
        created_at: new Date().toISOString(),
      }

      digital = {
        id: productId,
        product_type: 'digital',
        digital_deliverable_type: kind,
        delivery_mode: 'instant',
        max_purchases,
        agent_checkout_enabled: asBool(b.agent_checkout_enabled),
        file_size: file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : null,
        license: clean(b.license) || null,
      }
    }
  }

  if (errors.length) return res.status(400).json({ ok: false, errors })

  // ── Assemble ───────────────────────────────────────────────────────────────
  const seller = getSeller(seller_id)
  const id = digital.id ?? store.newId('sp')

  let coverUrl = clean(b.image) || null
  const cover = req.files?.cover?.[0]
  if (cover) {
    const coverId = store.newId('asset')
    store.putSellerAsset(coverId, {
      filename: cover.originalname,
      mimetype: cover.mimetype,
      base64: cover.buffer.toString('base64'),
    })
    coverUrl = `/api/digital/asset/${coverId}`
  }

  const product = {
    id,
    name,
    description,
    price,
    priceUSD: Number((price / Number(process.env.INR_PER_USD ?? 83.5)).toFixed(2)),
    category:    'digital',
    subcategory: clean(b.subcategory) || null,
    image: coverUrl,
    seller: seller.name,
    seller_id,
    city:   seller.city,
    state:  seller.state,
    region: clean(b.region) || null,
    tags: String(b.tags ?? '').split(',').map(t => t.trim()).filter(Boolean),
    occasions: [],
    material: clean(b.material) || null,
    rating: 0,
    reviews: 0,
    featured: false,
    available: true,
    created_at: new Date().toISOString(),
    listed_by: 'seller-dashboard',


    ...digital,
  }

  store.createSellerProduct(product, deliverableRow)

  res.status(201).json({
    ok: true,
    product,
    deliverable: deliverableRow
      ? { ...deliverableRow, code_pool: deliverableRow.code_pool ? `${deliverableRow.code_pool.length} code(s) stored` : null }
      : null,
    agent_visible: Boolean(digital.agent_checkout_enabled && seller.haat_verified),
    note: !seller.haat_verified && digital.agent_checkout_enabled
      ? 'Listed, but AI buyers cannot purchase it: haat has not verified this seller yet.'
      : undefined,
    catalogue_size: allProducts().length,
  })
})

export default router

// ── GET /api/seller/dashboard/:seller_id ─────────────────────────────────────
/**
 * What a seller needs to see: what they have listed, what sold, what it earned,
 * and — the part only this marketplace has — how much of that an agent bought
 * rather than a person.
 *
 * Computed from the order ledger rather than kept as a running total, so it
 * cannot drift out of step with what actually happened.
 */
router.get('/dashboard/:seller_id', (req, res) => {
  const seller = getSeller(req.params.seller_id)
  if (!seller) return res.status(404).json({ error: 'No such seller' })

  const mine = allProducts().filter(p => p.seller_id === seller.id)
  const ids = new Set(mine.map(p => p.id))

  const orders = store.listOrders()
    .filter(o => ids.has(o.product_id) && (o.status === 'paid' || o.status === 'delivered'))

  const byProduct = new Map()
  for (const o of orders) {
    const row = byProduct.get(o.product_id) ?? { units: 0, paise: 0, agent: 0, human: 0 }
    row.units += 1
    row.paise += o.amount_paise
    if (o.channel === 'human') row.human += 1
    else row.agent += 1
    byProduct.set(o.product_id, row)
  }

  const revenuePaise = orders.reduce((s, o) => s + o.amount_paise, 0)
  const agentUnits = orders.filter(o => o.channel !== 'human').length

  res.json({
    seller: {
      id: seller.id, name: seller.name, city: seller.city, state: seller.state,
      haat_verified: seller.haat_verified, verified_since: seller.verified_since,
    },
    totals: {
      listings: mine.length,
      agent_enabled: mine.filter(p => p.agent_checkout_enabled).length,
      units_sold: orders.length,
      revenue_paise: revenuePaise,
      revenue: fmtBoth(revenuePaise),
      sold_to_agents: agentUnits,
      sold_to_people: orders.length - agentUnits,
    },
    products: mine.map(p => {
      const s = byProduct.get(p.id) ?? { units: 0, paise: 0, agent: 0, human: 0 }
      const stock = remainingStock(p.id)
      return {
        id: p.id, name: p.name, image: p.image, price: p.price,
        subcategory: p.subcategory,
        deliverable: p.digital_deliverable_type,
        agent_checkout_enabled: p.agent_checkout_enabled,
        listed_by: p.listed_by ?? 'seed',
        remaining_stock: stock === Infinity ? null : stock,
        units_sold: s.units,
        revenue: fmtBoth(s.paise),
        revenue_paise: s.paise,
        sold_to_agents: s.agent,
        sold_to_people: s.human,
      }
    }).sort((a, b) => b.revenue_paise - a.revenue_paise),
    recent_sales: orders
      .slice(-12).reverse()
      .map(o => ({
        order_id: o.id, product_name: o.product_name,
        amount: fmtBoth(o.amount_paise),
        channel: o.channel === 'human' ? 'person' : 'agent',
        at: o.paid_at ?? o.created_at,
      })),
  })
})
