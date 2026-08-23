/**
 * agentCommerce.js — REST mirror of the agent tool surface
 *
 * Everything the MCP server exposes as a tool is also reachable here over plain
 * HTTP, calling the identical service functions. Two reasons: agents that don't
 * speak MCP can still transact, and anyone auditing the system can drive the
 * whole loop with curl and read the responses without running a client.
 *
 * Mounted at /api/agent-commerce, plus /api/digital for the storefront
 * catalogue, cover art, and signed downloads.
 */

import { Router } from 'express'
import { createReadStream, existsSync } from 'fs'
import { join, normalize } from 'path'

import * as commerce from '../services/commerce.js'
import * as store from '../services/agentStore.js'
import * as razorpay from '../services/razorpay.js'
import { LIMITS, fmtBoth } from '../services/guardrails.js'
import { verifySignedUrl, presentEntitlement } from '../services/delivery.js'
import {
  allProducts, allSellers, getProduct, sellerFor, remainingStock,
  search, DIGITAL_ASSET_DIR,
} from '../services/digitalCatalog.js'
import { runAgent } from '../services/agentPlanner.js'
import * as llm from '../services/llm.js'

const router = Router()

const sessionOf = req =>
  req.body?.agent_session_id ?? req.query?.agent_session_id ?? req.params?.sessionId ?? 'anon'

// Service functions never throw across the boundary, but Razorpay or the
// filesystem can; this keeps one 500 from taking the demo page down.
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// ══ Discovery ════════════════════════════════════════════════════════════════
// A machine-readable description of the surface, so an agent that finds haat
// cold can learn what it may do here before it tries anything.
router.get('/manifest', (_req, res) => {
  res.json({
    name: 'haat agentic commerce — digital products',
    version: '1.0.0',
    description: 'Discover, purchase, and receive digital products from verified Indian craft sellers.',
    currency: 'INR',
    payment_provider: { name: 'razorpay', mode: razorpay.mode() },
    ai_buyer: { configured: llm.isConfigured(), model: llm.describe() },
    limits: {
      per_transaction: fmtBoth(LIMITS.perTransactionPaise),
      per_session: fmtBoth(LIMITS.perSessionPaise),
      per_transaction_paise: LIMITS.perTransactionPaise,
      per_session_paise: LIMITS.perSessionPaise,
    },
    tools: [
      { name: 'search_digital_products', method: 'POST', path: '/api/agent-commerce/search', input: ['query', 'max_price_inr', 'agent_session_id'] },
      { name: 'get_product',             method: 'GET',  path: '/api/agent-commerce/products/:product_id' },
      { name: 'create_order',            method: 'POST', path: '/api/agent-commerce/orders', input: ['product_id', 'buyer_ref', 'agent_session_id'] },
      { name: 'authorise_test_payment',  method: 'POST', path: '/api/agent-commerce/orders/:order_id/authorise', input: ['outcome'] },
      { name: 'confirm_payment',         method: 'POST', path: '/api/agent-commerce/orders/:order_id/confirm', input: ['razorpay_payment_id', 'razorpay_signature'] },
      { name: 'get_order_status',        method: 'GET',  path: '/api/agent-commerce/orders/:order_id' },
      { name: 'confirm_purchase_approval', method: 'POST', path: '/api/agent-commerce/approvals', input: ['product_id', 'approved', 'approved_by', 'agent_session_id'] },
      { name: 'get_budget',              method: 'GET',  path: '/api/agent-commerce/budget/:sessionId' },
    ],
    audit: { path: '/api/agent-commerce/ledger/:sessionId', note: 'Every call above is recorded here, refusals included.' },
  })
})

// ══ Tools ════════════════════════════════════════════════════════════════════
router.post('/search', wrap(async (req, res) => {
  const { query, max_price_inr } = req.body ?? {}
  res.json(await commerce.searchDigitalProducts({ query, max_price_inr, agent_session_id: sessionOf(req) }))
}))

router.get('/products/:product_id', wrap(async (req, res) => {
  const result = await commerce.getProductDetail({
    product_id: req.params.product_id,
    agent_session_id: sessionOf(req),
  })
  res.status(result.status === 'not_found' ? 404 : 200).json(result)
}))

router.post('/orders', wrap(async (req, res) => {
  const { product_id, buyer_ref } = req.body ?? {}
  const result = await commerce.createOrder({
    product_id, buyer_ref, agent_session_id: sessionOf(req),
  })
  // A refused order is a successful, meaningful answer — 200 with a decision,
  // not an HTTP error. 402 is reserved for the gate so a caller can branch on it.
  res.status(result.status === 'pending_approval' ? 402 : 200).json(result)
}))

router.post('/orders/:order_id/authorise', wrap(async (req, res) => {
  res.json(await commerce.authoriseTestPayment({
    order_id: req.params.order_id,
    outcome: req.body?.outcome ?? 'captured',
    agent_session_id: sessionOf(req),
  }))
}))

router.post('/orders/:order_id/confirm', wrap(async (req, res) => {
  const { razorpay_payment_id, razorpay_signature, payment_method } = req.body ?? {}
  res.json(await commerce.confirmPayment({
    order_id: req.params.order_id,
    razorpay_payment_id, razorpay_signature, payment_method,
    agent_session_id: sessionOf(req),
  }))
}))

router.get('/orders/:order_id', wrap(async (req, res) => {
  const result = await commerce.getOrderStatus({ order_id: req.params.order_id })
  res.status(result.status === 'not_found' ? 404 : 200).json(result)
}))

router.post('/approvals', wrap(async (req, res) => {
  const { product_id, approved = true, approved_by, note } = req.body ?? {}
  res.json(await commerce.confirmPurchaseApproval({
    product_id, approved, approved_by, note, agent_session_id: sessionOf(req),
  }))
}))

router.get('/budget/:sessionId', wrap(async (req, res) => {
  res.json(await commerce.getBudget({ agent_session_id: req.params.sessionId }))
}))

// ══ Audit trail ══════════════════════════════════════════════════════════════
// `since` lets the demo page poll for only what it hasn't rendered yet, so the
// ledger streams instead of redrawing.
router.get('/ledger/:sessionId', (req, res) => {
  const since = Number(req.query.since ?? 0) || 0
  const actions = store.listActions(req.params.sessionId, since)

  res.json({
    session_id: req.params.sessionId,
    cursor: since + actions.length,
    budget: commerce.budgetSnapshot(req.params.sessionId),
    orders: store.listOrders(req.params.sessionId).map(o => ({
      order_id: o.id,
      product_id: o.product_id,
      product_name: o.product_name,
      amount: fmtBoth(o.amount_paise),
      amount_paise: o.amount_paise,
      status: o.status,
      razorpay_order_id: o.razorpay_order_id,
      razorpay_payment_id: o.razorpay_payment_id,
      deliverable: (() => {
        const ent = store.findEntitlementByOrder(o.id)
        return ent ? presentEntitlement(ent) : null
      })(),
    })),
    actions: actions.map(a => ({
      ...a,
      amount: a.amount_paise == null ? null : fmtBoth(a.amount_paise),
    })),
  })
})

// ══ Platform activity ════════════════════════════════════════════════════════
/**
 * Every agent session on the platform, not just one. This is the operator's
 * view: who transacted, what was refused, and how much moved — the thing that
 * makes "show the audit trail" a property of the system rather than of one
 * demo page.
 */
router.get('/activity', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 60) || 60, 300)
  const all = store.listActions()

  const sessions = new Map()
  for (const a of all) {
    const s = sessions.get(a.agent_session_id) ?? {
      session_id: a.agent_session_id, actions: 0, blocked: 0, gated: 0,
      spent_paise: 0, first_at: a.created_at, last_at: a.created_at,
    }
    s.actions += 1
    if (a.decision === 'blocked') s.blocked += 1
    if (a.decision === 'pending_approval') s.gated += 1
    if (a.action_type === 'payment_confirmed') s.spent_paise += a.amount_paise ?? 0
    s.last_at = a.created_at
    sessions.set(a.agent_session_id, s)
  }

  const orders = store.listOrders()
  const paid = orders.filter(o => o.status === 'paid' || o.status === 'delivered')

  res.json({
    totals: {
      sessions: sessions.size,
      actions: all.length,
      blocked: all.filter(a => a.decision === 'blocked').length,
      gated: all.filter(a => a.decision === 'pending_approval').length,
      orders: orders.length,
      paid_orders: paid.length,
      gmv: fmtBoth(paid.reduce((s, o) => s + o.amount_paise, 0)),
      by_agent: paid.filter(o => o.channel !== 'human').length,
      by_people: paid.filter(o => o.channel === 'human').length,
    },
    sessions: [...sessions.values()]
      .sort((a, b) => b.last_at.localeCompare(a.last_at))
      .slice(0, 40)
      .map(s => ({ ...s, spent: fmtBoth(s.spent_paise) })),
    actions: all.slice(-limit).reverse().map(a => ({
      ...a,
      amount: a.amount_paise == null ? null : fmtBoth(a.amount_paise),
    })),
  })
})

router.post('/reset/:sessionId', (req, res) => {
  store.resetSession(req.params.sessionId)
  res.json({ ok: true, session_id: req.params.sessionId, note: 'orders, entitlements and audit rows cleared; unlock codes returned to the pool' })
})

/** Clean slate across every session — for setting up before a demo. */
router.post('/reset-all', (_req, res) => {
  store.resetAll()
  res.json({ ok: true, note: 'all sessions, orders, entitlements, audit rows and code pools reset' })
})

// ══ The agent itself ═════════════════════════════════════════════════════════
// Claude, given the tools above and a budget, deciding what to buy. Discovery
// and selection are the model's; none of the gating is.
router.post('/run', wrap(async (req, res) => {
  const { prompt, buyer_ref } = req.body ?? {}
  if (!prompt?.trim()) return res.status(400).json({ error: '"prompt" is required' })

  const result = await runAgent({
    prompt,
    agent_session_id: sessionOf(req),
    buyer_ref: buyer_ref ?? sessionOf(req),
  })
  res.json(result)
}))

// ══ Razorpay webhook ═════════════════════════════════════════════════════════
// The browser checkout path settles here. Signature is verified over the raw
// body captured by the json parser's verify hook in server.js.
router.post('/webhook/razorpay', wrap(async (req, res) => {
  const signature = req.headers['x-razorpay-signature']
  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))

  const check = razorpay.verifyWebhookSignature(raw, signature)
  if (!check.valid) {
    console.warn('[razorpay webhook] rejected:', check.reason)
    return res.status(400).json({ ok: false, reason: check.reason })
  }

  const event = req.body?.event
  const payment = req.body?.payload?.payment?.entity

  if (event === 'payment.captured' && payment) {
    const order = store.findOrderByRazorpayId(payment.order_id)
    if (order && order.status === 'created') {
      // Re-enter the same confirmation path the tools use rather than a
      // parallel one, so a webhook-settled order is indistinguishable from an
      // agent-settled one downstream.
      await commerce.confirmPayment({
        order_id: order.id,
        razorpay_payment_id: payment.id,
        razorpay_signature: null,
        payment_method: payment.method ?? 'card',
        agent_session_id: order.agent_session_id,
        // Signature is absent on webhooks; the webhook HMAC verified above is
        // the proof of authenticity, so the per-payment check is skipped.
        webhookVerified: true,
      })
    }
  } else if (event === 'payment.failed' && payment) {
    const order = store.findOrderByRazorpayId(payment.order_id)
    if (order) {
      store.updateOrder(order.id, { status: 'payment_failed', failure_reason: payment.error_description ?? 'declined' })
      store.logAction({
        agent_session_id: order.agent_session_id, action_type: 'payment_failed',
        product_id: order.product_id, product_name: order.product_name,
        amount_paise: order.amount_paise, decision: 'blocked',
        reason: `Razorpay reported payment.failed: ${payment.error_description ?? 'declined'}`,
      })
    }
  }

  res.json({ ok: true })
}))

// ══ Storefront checkout ══════════════════════════════════════════════════════
// A person buying, rather than an agent. Same payment verification, same
// delivery, same entitlements — only the authorisation policy differs, and the
// difference is stated in commerce.createHumanOrder.
export const shopRouter = Router()

shopRouter.post('/orders', wrap(async (req, res) => {
  const { product_id, buyer_ref } = req.body ?? {}
  const result = await commerce.createHumanOrder({ product_id, buyer_ref })
  res.status(result.status === 'not_found' ? 404 : 200).json(result)
}))

/** Stands in for the card step when Razorpay keys are absent, exactly as the agent path does. */
shopRouter.post('/orders/:order_id/authorise', wrap(async (req, res) => {
  res.json(await commerce.authoriseTestPayment({
    order_id: req.params.order_id,
    outcome: req.body?.outcome ?? 'captured',
  }))
}))

shopRouter.post('/orders/:order_id/confirm', wrap(async (req, res) => {
  const { razorpay_payment_id, razorpay_signature, payment_method } = req.body ?? {}
  res.json(await commerce.confirmPayment({
    order_id: req.params.order_id,
    razorpay_payment_id, razorpay_signature, payment_method,
  }))
}))

shopRouter.get('/orders/:order_id', wrap(async (req, res) => {
  const result = await commerce.getOrderStatus({ order_id: req.params.order_id })
  res.status(result.status === 'not_found' ? 404 : 200).json(result)
}))

/** Everything this buyer owns — the library. */
shopRouter.get('/library/:buyer_ref', wrap(async (req, res) => {
  res.json(await commerce.listLibrary({ buyer_ref: decodeURIComponent(req.params.buyer_ref) }))
}))

// ══ Storefront + assets (mounted separately at /api/digital) ═════════════════
export const digitalRouter = Router()

/**
 * Human storefront listing — includes SKUs not opened to agents.
 *
 * Returns the product as the catalogue holds it, not the agent-tool shape. The
 * two are deliberately different: an agent gets a narrowed summary with prices
 * in paise, a storefront card needs the whole row.
 */
digitalRouter.get('/products', (req, res) => {
  const results = search({ query: req.query.q ?? '', agentOnly: false, limit: 100 })
  res.json({ products: results.map(storefrontShape), total: results.length })
})

digitalRouter.get('/sellers', (_req, res) => res.json({ sellers: allSellers() }))

digitalRouter.get('/products/:id', (req, res) => {
  const p = getProduct(req.params.id)
  if (!p) return res.status(404).json({ error: 'Product not found' })
  res.json({ ...storefrontShape(p), seller_detail: sellerFor(p) })
})

function storefrontShape(p) {
  const stock = remainingStock(p.id)
  return {
    ...p,
    seller_verified: Boolean(sellerFor(p)?.haat_verified),
    remaining_stock: stock === Infinity ? null : stock,
  }
}

/** Cover art. Public — these are listing images, not the deliverable. */
digitalRouter.get('/covers/:file', (req, res) => {
  const safe = normalize(req.params.file).replace(/^(\.\.[/\\])+/, '')
  const path = join(DIGITAL_ASSET_DIR, 'covers', safe)
  if (!path.startsWith(join(DIGITAL_ASSET_DIR, 'covers')) || !existsSync(path)) {
    return res.status(404).json({ error: 'Not found' })
  }
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400')
  createReadStream(path).pipe(res)
})

/** The deliverable. Reachable only with an unexpired signature. */
digitalRouter.get('/download/:entitlementId', (req, res) => {
  const { entitlementId } = req.params
  const check = verifySignedUrl(entitlementId, req.query.exp, req.query.sig)
  if (!check.valid) {
    return res.status(403).json({ error: 'Link is not valid', reason: check.reason })
  }

  const ent = store.getEntitlement(entitlementId)
  if (!ent) return res.status(404).json({ error: 'No such entitlement' })
  if (ent.kind !== 'file') {
    return res.status(400).json({ error: `This entitlement is delivered as a ${ent.kind}, not a file` })
  }

  store.logAction({
    agent_session_id: ent.agent_session_id ?? 'anon',
    action_type: 'asset_downloaded',
    product_id: ent.product_id, product_name: ent.product_name,
    decision: 'allowed',
    reason: `signed link redeemed for "${ent.product_name}"`,
  })

  // A seller-uploaded deliverable lives in the store; a seeded one on disk.
  if (ent.asset_id) {
    const asset = store.getSellerAsset(ent.asset_id)
    if (!asset) return res.status(404).json({ error: 'Asset missing from storage' })
    res.set('Content-Disposition', `attachment; filename="${asset.filename}"`)
    res.type(asset.mimetype || 'application/octet-stream')
    return res.send(Buffer.from(asset.base64, 'base64'))
  }

  const safe = normalize(ent.storage_path ?? '').replace(/^(\.\.[/\\])+/, '')
  const path = join(DIGITAL_ASSET_DIR, 'files', safe)
  if (!path.startsWith(join(DIGITAL_ASSET_DIR, 'files')) || !existsSync(path)) {
    return res.status(404).json({ error: 'Asset missing from storage' })
  }

  res.set('Content-Disposition', `attachment; filename="${ent.filename ?? safe}"`)
  res.type('image/svg+xml')
  createReadStream(path).pipe(res)
})

/** Seller-uploaded cover art. Public — a listing image, not the deliverable. */
digitalRouter.get('/asset/:assetId', (req, res) => {
  const asset = store.getSellerAsset(req.params.assetId)
  if (!asset) return res.status(404).json({ error: 'Not found' })
  res.type(asset.mimetype || 'application/octet-stream')
  res.set('Cache-Control', 'public, max-age=86400')
  res.send(Buffer.from(asset.base64, 'base64'))
})

export default router
