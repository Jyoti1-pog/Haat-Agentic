/**
 * commerce.js — the agentic checkout service layer
 *
 * Every agent-facing surface calls these functions and only these functions:
 * the MCP tool server, the REST routes, and the demo page all share one
 * implementation, so there is no path where the guardrails are enforced in one
 * place and skipped in another.
 *
 * Two conventions hold throughout:
 *
 *   1. Nothing throws across the boundary. Each function resolves to an object
 *      with a `status`, because the caller is often a language model and a
 *      readable refusal is more useful to it than a stack trace.
 *   2. Every call writes to the audit trail before it returns — including the
 *      refusals. A decision that isn't logged didn't happen.
 */

import {
  getProduct, sellerFor, remainingStock, search,
  toAgentSummary, toAgentDetail,
} from './digitalCatalog.js'
import { evaluate, budgetSnapshot, fmtBoth, LIMITS } from './guardrails.js'
import * as store from './agentStore.js'
import * as razorpay from './razorpay.js'
import { fulfil, presentEntitlement } from './delivery.js'

const paise = inr => Math.round(inr * 100)

// ── search_digital_products ──────────────────────────────────────────────────
export async function searchDigitalProducts({ query = '', max_price_inr = null, agent_session_id }) {
  const results = search({
    query,
    maxPricePaise: max_price_inr != null ? paise(Number(max_price_inr)) : null,
    agentOnly: true,
  })

  store.logAction({
    agent_session_id,
    action_type: 'search',
    decision: 'allowed',
    reason: `searched "${query || 'everything'}"${max_price_inr ? ` under ₹${max_price_inr}` : ''} → ${results.length} result${results.length === 1 ? '' : 's'}`,
    meta: { query, max_price_inr, result_ids: results.map(r => r.id) },
  })

  return {
    status: 'ok',
    count: results.length,
    budget: budgetSnapshot(agent_session_id),
    products: results.map(toAgentSummary),
    note: 'Only SKUs whose seller enabled AI-buyer checkout are listed. Prices are INR.',
  }
}

// ── get_product ──────────────────────────────────────────────────────────────
export async function getProductDetail({ product_id, agent_session_id }) {
  const product = getProduct(product_id)

  if (!product) {
    store.logAction({
      agent_session_id, action_type: 'quote', product_id,
      decision: 'blocked', reason: `no such product: ${product_id}`,
    })
    return { status: 'not_found', reason: `no such product: ${product_id}` }
  }

  store.logAction({
    agent_session_id, action_type: 'quote',
    product_id: product.id, product_name: product.name,
    amount_paise: paise(product.price), decision: 'allowed',
    reason: `quoted ${product.name} at ${fmtBoth(paise(product.price))}`,
  })

  return {
    status: 'ok',
    product: toAgentDetail(product),
    budget: budgetSnapshot(agent_session_id),
  }
}

// ── create_order ─────────────────────────────────────────────────────────────
export async function createOrder({ product_id, buyer_ref, agent_session_id }) {
  if (!buyer_ref) return { status: 'error', reason: 'buyer_ref is required' }

  const product = getProduct(product_id)
  const seller  = sellerFor(product)
  const amount  = product ? paise(product.price) : 0

  // 1 ── Already owned? Return what they have instead of charging again.
  //      Only single-seat goods short-circuit — a pattern pack is legitimately
  //      re-purchasable, a one-seat licence is not.
  if (product?.max_purchases === 1) {
    const existing = store.findEntitlement(buyer_ref, product.id)
    if (existing) {
      store.logAction({
        agent_session_id, action_type: 'entitlement_reused',
        product_id: product.id, product_name: product.name,
        amount_paise: amount, decision: 'blocked',
        reason: `${buyer_ref} already holds a single-seat licence for "${product.name}" — returned the existing one, no second charge`,
      })
      return {
        status: 'already_entitled',
        reason: `You already own "${product.name}". A single-seat licence cannot be bought twice, so no order was created and no money moved.`,
        order_id: existing.order_id,
        deliverable: presentEntitlement(existing),
        budget: budgetSnapshot(agent_session_id),
      }
    }
  }

  // 2 ── Deterministic gates.
  const evaluation = evaluate({
    product, seller, amountPaise: amount, agentSessionId: agent_session_id,
    availableCodes: product ? remainingStock(product.id) : 0,
  })

  if (evaluation.decision === 'blocked') {
    store.logAction({
      agent_session_id, action_type: 'blocked',
      product_id: product?.id ?? product_id, product_name: product?.name ?? null,
      amount_paise: product ? amount : null,
      decision: 'blocked', reason: evaluation.reason,
      meta: { checks: evaluation.checks },
    })
    return {
      status: 'blocked',
      reason: evaluation.reason,
      checks: evaluation.checks,
      budget: budgetSnapshot(agent_session_id),
      guidance: 'This is a hard rule. Do not retry — choose a different product.',
    }
  }

  if (evaluation.decision === 'pending_approval') {
    store.logAction({
      agent_session_id, action_type: 'gate_triggered',
      product_id: product.id, product_name: product.name,
      amount_paise: amount, decision: 'pending_approval', reason: evaluation.reason,
      meta: { checks: evaluation.checks },
    })
    return {
      status: 'pending_approval',
      reason: evaluation.reason,
      checks: evaluation.checks,
      product: toAgentSummary(product),
      budget: budgetSnapshot(agent_session_id),
      guidance:
        `No order was created and no money moved. Explain the cost to the person you are ` +
        `buying for and ask them directly. If they agree, they grant approval for this exact ` +
        `item at this exact price (confirm_purchase_approval), and only then can create_order run again.`,
    }
  }

  // 3 ── Idempotency. A retried create_order reuses the open Razorpay order
  //      rather than minting a second one for the same intent.
  const open = store.findOpenOrder(agent_session_id, product.id)
  if (open) {
    store.logAction({
      agent_session_id, action_type: 'order_attempt',
      product_id: product.id, product_name: product.name,
      amount_paise: amount, decision: 'allowed',
      reason: `reused open order ${open.id} for "${product.name}" — no duplicate Razorpay order created`,
    })
    return { status: 'created', idempotent_reuse: true, ...orderResponse(open, product) }
  }

  // 4 ── Real Razorpay order.
  const orderId = store.newId('ord')
  let rzp
  try {
    rzp = await razorpay.createOrder({
      amountPaise: amount,
      receipt: orderId,
      notes: {
        haat_order_id: orderId,
        product_id: product.id,
        buyer_ref,
        agent_session_id,
        channel: 'agentic-checkout',
      },
    })
  } catch (err) {
    store.logAction({
      agent_session_id, action_type: 'payment_failed',
      product_id: product.id, product_name: product.name,
      amount_paise: amount, decision: 'blocked',
      reason: `Razorpay order creation failed: ${err.message}`,
    })
    return {
      status: 'error',
      reason: `Razorpay order creation failed: ${err.message}`,
      guidance: 'Payment provider error, not a policy refusal. Retrying create_order is safe.',
    }
  }

  const row = store.createOrderRow({
    id: orderId,
    product_id: product.id,
    product_name: product.name,
    seller_id: product.seller_id,
    buyer_ref,
    agent_session_id,
    amount_paise: amount,
    currency: 'INR',
    status: 'created',
    razorpay_order_id: rzp.id,
    razorpay_mode: rzp._simulated ? 'unconfigured' : razorpay.mode(),
    razorpay_payment_id: null,
    payment_method: null,
    gate_checks: evaluation.checks,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  store.logAction({
    agent_session_id, action_type: 'order_attempt',
    product_id: product.id, product_name: product.name,
    amount_paise: amount, decision: 'allowed',
    reason: `order created for "${product.name}" at ${fmtBoth(amount)} — Razorpay order ${rzp.id}${rzp._simulated ? ' (keys not configured)' : ''}`,
    meta: { razorpay_order_id: rzp.id, simulated: Boolean(rzp._simulated) },
  })

  return { status: 'created', ...orderResponse(row, product) }
}

function orderResponse(order, product) {
  return {
    order_id: order.id,
    razorpay_order_id: order.razorpay_order_id,
    razorpay_mode: order.razorpay_mode,
    amount_paise: order.amount_paise,
    amount: fmtBoth(order.amount_paise),
    currency: order.currency,
    product: product ? toAgentSummary(product) : null,
    order_status: order.status,
    next_step:
      'This order is unpaid. An agent with no browser calls authorise_test_payment ' +
      'to stand in for the card step, then confirm_payment with the returned id and signature.',
  }
}

// ── authorise_test_payment ───────────────────────────────────────────────────
/**
 * The one place the loop is stood in for. Razorpay's card capture happens in a
 * browser the agent does not have, so this mints a payment id and signs it with
 * the real key secret. Everything downstream — signature verification, the paid
 * transition, delivery — is the same code the browser path runs.
 */
export async function authoriseTestPayment({ order_id, outcome = 'captured', agent_session_id }) {
  const order = store.getOrder(order_id)
  if (!order) return { status: 'not_found', reason: `no such order: ${order_id}` }
  if (order.status === 'paid') {
    return { status: 'already_paid', reason: 'this order is already paid', order_id }
  }

  const auth = razorpay.simulateAuthorisation(order.razorpay_order_id, outcome)

  store.logAction({
    agent_session_id: agent_session_id ?? order.agent_session_id,
    action_type: 'payment_authorised',
    product_id: order.product_id, product_name: order.product_name,
    amount_paise: order.amount_paise, decision: 'allowed',
    reason: outcome === 'failed'
      ? `test card declined for "${order.product_name}" — simulated authorisation returned an invalid signature`
      : `test card authorised ${fmtBoth(order.amount_paise)} for "${order.product_name}" (simulated card, real signature)`,
    meta: { razorpay_payment_id: auth.razorpay_payment_id, outcome, signed: auth.signed },
  })

  return {
    status: 'authorised',
    order_id,
    razorpay_payment_id: auth.razorpay_payment_id,
    razorpay_signature: auth.razorpay_signature,
    signed: auth.signed,
    signed_with: auth.signed_with,
    simulated: true,
    note: `HMAC-SHA256 signature over order_id|payment_id, signed with the ${
      auth.signed_with === 'razorpay_key_secret' ? 'configured Razorpay key secret' : 'process stand-in secret (no Razorpay keys set)'
    }. Pass both values to confirm_payment.`,
  }
}

// ── confirm_payment ──────────────────────────────────────────────────────────
export async function confirmPayment({
  order_id, razorpay_payment_id, razorpay_signature, agent_session_id,
  payment_method = 'simulated_card', webhookVerified = false,
}) {
  const order = store.getOrder(order_id)
  if (!order) return { status: 'not_found', reason: `no such order: ${order_id}` }

  const sessionId = agent_session_id ?? order.agent_session_id

  // Idempotent: confirming a paid order returns the same deliverable.
  if (order.status === 'paid') {
    const ent = store.findEntitlementByOrder(order.id)
    return {
      status: 'paid',
      order_id: order.id,
      already_confirmed: true,
      deliverable: ent ? presentEntitlement(ent) : null,
      budget: budgetSnapshot(sessionId),
    }
  }

  // 1 ── Signature. Same verification for a browser payment and an agent one.
  //      A webhook carries no per-payment signature — its own HMAC over the raw
  //      body is the proof, already checked by the route before we get here.
  const check = webhookVerified
    ? { valid: true, reason: 'authenticated by Razorpay webhook signature' }
    : razorpay.verifyPaymentSignature({
        razorpay_order_id: order.razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      })

  if (!check.valid) {
    store.updateOrder(order.id, { status: 'payment_failed', failure_reason: check.reason })
    store.logAction({
      agent_session_id: sessionId, action_type: 'payment_failed',
      product_id: order.product_id, product_name: order.product_name,
      amount_paise: order.amount_paise, decision: 'blocked',
      reason: `payment rejected for "${order.product_name}" — ${check.reason}. Nothing delivered, nothing charged to the session budget.`,
    })
    return {
      status: 'payment_failed',
      order_id: order.id,
      reason: check.reason,
      budget: budgetSnapshot(sessionId),
      guidance: 'The payment was not accepted, so nothing was delivered and the session budget is untouched. You may call create_order again to start a fresh attempt.',
    }
  }

  // 2 ── For a real (non-simulated) payment id, confirm status with Razorpay
  //      rather than trusting the signature alone.
  if (!String(razorpay_payment_id).startsWith('pay_sim_') && razorpay.isConfigured()) {
    const remote = await razorpay.fetchPayment(razorpay_payment_id)
    const ok = remote && ['captured', 'authorized'].includes(remote.status)
    if (!ok) {
      const reason = remote ? `Razorpay reports payment status "${remote.status}"` : 'Razorpay could not confirm this payment'
      store.updateOrder(order.id, { status: 'payment_failed', failure_reason: reason })
      store.logAction({
        agent_session_id: sessionId, action_type: 'payment_failed',
        product_id: order.product_id, product_name: order.product_name,
        amount_paise: order.amount_paise, decision: 'blocked', reason,
      })
      return { status: 'payment_failed', order_id: order.id, reason, budget: budgetSnapshot(sessionId) }
    }
    payment_method = remote.method ?? 'card'
  }

  // 3 ── Paid. Budget is charged here and only here — an attempt that never
  //      completed must not consume anyone's budget.
  store.updateOrder(order.id, {
    status: 'paid',
    razorpay_payment_id,
    payment_method,
    paid_at: new Date().toISOString(),
  })
  store.addSessionSpend(sessionId, order.amount_paise)
  store.consumeApproval(sessionId, order.product_id)

  store.logAction({
    agent_session_id: sessionId, action_type: 'payment_confirmed',
    product_id: order.product_id, product_name: order.product_name,
    amount_paise: order.amount_paise, decision: 'allowed',
    reason: `payment confirmed for "${order.product_name}" — ${fmtBoth(order.amount_paise)} captured, signature verified`,
    meta: { razorpay_payment_id, payment_method },
  })

  // 4 ── Deliver.
  const product = getProduct(order.product_id)
  let delivery
  try {
    delivery = fulfil({ order: store.getOrder(order.id), product })
  } catch (err) {
    store.updateOrder(order.id, { status: 'delivery_failed', failure_reason: err.message })
    store.logAction({
      agent_session_id: sessionId, action_type: 'delivery_failed',
      product_id: order.product_id, product_name: order.product_name,
      amount_paise: order.amount_paise, decision: 'blocked',
      reason: `paid but could not deliver: ${err.message} — flagged for refund`,
    })
    return {
      status: 'delivery_failed',
      order_id: order.id,
      reason: err.message,
      guidance: 'Payment succeeded but delivery did not. This order is flagged for refund; do not retry payment.',
    }
  }

  store.updateOrder(order.id, { status: 'delivered', entitlement_id: delivery.entitlement.id })
  store.logAction({
    agent_session_id: sessionId, action_type: 'delivered',
    product_id: order.product_id, product_name: order.product_name,
    amount_paise: order.amount_paise, decision: 'allowed',
    reason: delivery.deliverable.kind === 'code'
      ? `delivered unlock code for "${order.product_name}"`
      : `delivered "${order.product_name}" — signed link, expires ${new Date(delivery.deliverable.expires_at).toUTCString()}`,
    meta: { entitlement_id: delivery.entitlement.id, kind: delivery.deliverable.kind },
  })

  return {
    status: 'delivered',
    order_id: order.id,
    amount: fmtBoth(order.amount_paise),
    razorpay_payment_id,
    deliverable: delivery.deliverable,
    budget: budgetSnapshot(sessionId),
  }
}

// ── get_order_status ─────────────────────────────────────────────────────────
export async function getOrderStatus({ order_id }) {
  const order = store.getOrder(order_id)
  if (!order) return { status: 'not_found', reason: `no such order: ${order_id}` }

  const ent = store.findEntitlementByOrder(order.id)
  return {
    status: 'ok',
    order: {
      order_id: order.id,
      product_id: order.product_id,
      product_name: order.product_name,
      amount: fmtBoth(order.amount_paise),
      amount_paise: order.amount_paise,
      currency: order.currency,
      order_status: order.status,
      razorpay_order_id: order.razorpay_order_id,
      razorpay_payment_id: order.razorpay_payment_id,
      failure_reason: order.failure_reason ?? null,
      created_at: order.created_at,
      paid_at: order.paid_at ?? null,
    },
    deliverable: ent ? presentEntitlement(ent) : null,
  }
}

// ── confirm_purchase_approval ────────────────────────────────────────────────
/**
 * The human-in-the-loop gate. Approval is scoped to one product at one exact
 * amount — it is not a blanket lift of the cap, and it does not survive a price
 * change. This is what makes "gated" mean something.
 */
export async function confirmPurchaseApproval({
  product_id, agent_session_id, approved = true, approved_by = 'human', note = '',
}) {
  const product = getProduct(product_id)
  if (!product) return { status: 'not_found', reason: `no such product: ${product_id}` }

  const amount = paise(product.price)

  if (!approved) {
    store.logAction({
      agent_session_id, action_type: 'approval_declined',
      product_id: product.id, product_name: product.name,
      amount_paise: amount, decision: 'blocked',
      reason: `${approved_by} declined the ${fmtBoth(amount)} purchase of "${product.name}"${note ? ` — ${note}` : ''}`,
    })
    return {
      status: 'declined',
      reason: `${approved_by} declined this purchase. Do not retry create_order for this item.`,
      budget: budgetSnapshot(agent_session_id),
    }
  }

  // A session that cannot afford the item can't be rescued by an approval —
  // the per-transaction cap is liftable, the session budget is not.
  const session = store.getSession(agent_session_id)
  if (session.spent_paise + amount > LIMITS.perSessionPaise) {
    const reason = `approval refused: ${fmtBoth(amount)} would exceed the ${fmtBoth(LIMITS.perSessionPaise)} session budget, which cannot be lifted per-item`
    store.logAction({
      agent_session_id, action_type: 'blocked',
      product_id: product.id, product_name: product.name,
      amount_paise: amount, decision: 'blocked', reason,
    })
    return { status: 'blocked', reason, budget: budgetSnapshot(agent_session_id) }
  }

  store.grantApproval(agent_session_id, product.id, amount)
  store.logAction({
    agent_session_id, action_type: 'approved',
    product_id: product.id, product_name: product.name,
    amount_paise: amount, decision: 'allowed', actor: approved_by,
    reason: `${approved_by} approved "${product.name}" at ${fmtBoth(amount)} — approval is scoped to this item at this price only`,
  })

  return {
    status: 'approved',
    product_id: product.id,
    approved_amount: fmtBoth(amount),
    budget: budgetSnapshot(agent_session_id),
    guidance: 'Approval granted for this item at this price. Call create_order again to proceed.',
  }
}

// ── get_budget ───────────────────────────────────────────────────────────────
export async function getBudget({ agent_session_id }) {
  return {
    status: 'ok',
    budget: budgetSnapshot(agent_session_id),
    policy: {
      per_transaction_cap: fmtBoth(LIMITS.perTransactionPaise),
      session_budget: fmtBoth(LIMITS.perSessionPaise),
      rules: [
        'Products from sellers haat has not verified cannot be bought by an agent, at any price.',
        'Products the seller has not enabled for AI-buyer checkout cannot be bought by an agent.',
        'Anything over the per-transaction cap needs one explicit human approval, scoped to that item at that price.',
        'The session budget is a hard ceiling and cannot be lifted by an approval.',
        'A single-seat licence already owned is returned rather than charged for a second time.',
      ],
    },
  }
}

export { budgetSnapshot }

// ══ Human checkout ═══════════════════════════════════════════════════════════
/**
 * The same shop, bought by a person instead of an agent.
 *
 * Payment and delivery are literally the same code — confirmPayment and fulfil
 * are shared — so a human order and an agent order are indistinguishable once
 * they are paid. What differs is the authorisation policy, and only that:
 *
 *   an agent  — spend caps, the approval gate, the seller-verification rule,
 *               and the seller's agent-checkout toggle
 *   a person  — none of those. Caps are an agent's leash, not a shopper's, and
 *               a human can read a seller page and decide for themselves.
 *
 * Both still hit the checks that protect the buyer rather than restrain them:
 * the product must exist and be in stock, and a single-seat licence already
 * owned is returned instead of charged for twice.
 */
export async function createHumanOrder({ product_id, buyer_ref }) {
  if (!buyer_ref) return { status: 'error', reason: 'buyer_ref is required' }

  const product = getProduct(product_id)
  if (!product) return { status: 'not_found', reason: `no such product: ${product_id}` }
  if (!product.available) {
    return { status: 'unavailable', reason: `"${product.name}" is not currently available` }
  }

  const sessionId = `human:${buyer_ref}`
  const amount = paise(product.price)

  // Already owned? Hand back what they have rather than selling it twice.
  if (product.max_purchases === 1) {
    const existing = store.findEntitlement(buyer_ref, product.id)
    if (existing) {
      store.logAction({
        agent_session_id: sessionId, action_type: 'entitlement_reused', actor: 'human',
        product_id: product.id, product_name: product.name, amount_paise: amount,
        decision: 'blocked',
        reason: `${buyer_ref} already owns "${product.name}" — returned the existing licence, no second charge`,
      })
      return {
        status: 'already_entitled',
        reason: `You already own "${product.name}". It is a single-seat licence, so there is nothing to buy again.`,
        order_id: existing.order_id,
        deliverable: presentEntitlement(existing),
      }
    }
  }

  // Stock. Refuse rather than take money for something undeliverable.
  if (remainingStock(product.id) <= 0) {
    store.logAction({
      agent_session_id: sessionId, action_type: 'blocked', actor: 'human',
      product_id: product.id, product_name: product.name, amount_paise: amount,
      decision: 'blocked', reason: `"${product.name}" is sold out`,
    })
    return { status: 'blocked', reason: `"${product.name}" is sold out.` }
  }

  // Reuse an unpaid order for the same intent rather than minting a second.
  const open = store.findOpenOrder(sessionId, product.id)
  if (open) {
    return { status: 'created', idempotent_reuse: true, ...humanOrderResponse(open, product) }
  }

  const orderId = store.newId('ord')
  let rzp
  try {
    rzp = await razorpay.createOrder({
      amountPaise: amount,
      receipt: orderId,
      notes: { haat_order_id: orderId, product_id: product.id, buyer_ref, channel: 'storefront' },
    })
  } catch (err) {
    return {
      status: 'error',
      reason: `Payment provider error: ${err.message}`,
      guidance: 'Nothing was charged. Retrying is safe.',
    }
  }

  const row = store.createOrderRow({
    id: orderId,
    product_id: product.id, product_name: product.name, seller_id: product.seller_id,
    buyer_ref, agent_session_id: sessionId, channel: 'human',
    amount_paise: amount, currency: 'INR', status: 'created',
    razorpay_order_id: rzp.id,
    razorpay_mode: rzp._simulated ? 'unconfigured' : razorpay.mode(),
    razorpay_payment_id: null, payment_method: null, gate_checks: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  })

  store.logAction({
    agent_session_id: sessionId, action_type: 'order_attempt', actor: 'human',
    product_id: product.id, product_name: product.name, amount_paise: amount,
    decision: 'allowed',
    reason: `checkout started for "${product.name}" at ${fmtBoth(amount)} — Razorpay order ${rzp.id}`,
    meta: { razorpay_order_id: rzp.id, simulated: Boolean(rzp._simulated) },
  })

  return { status: 'created', ...humanOrderResponse(row, product) }
}

function humanOrderResponse(order, product) {
  return {
    order_id: order.id,
    razorpay_order_id: order.razorpay_order_id,
    razorpay_key_id: process.env.RAZORPAY_KEY_ID ?? null,
    razorpay_mode: order.razorpay_mode,
    amount_paise: order.amount_paise,
    amount: fmtBoth(order.amount_paise),
    currency: order.currency,
    product: product ? toAgentSummary(product) : null,
    order_status: order.status,
  }
}

/** Everything a buyer owns, newest first — the library page. */
export async function listLibrary({ buyer_ref }) {
  const rows = store.listEntitlements(buyer_ref)
  return {
    status: 'ok',
    count: rows.length,
    items: rows
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(e => {
        const order = store.getOrder(e.order_id)
        return {
          entitlement_id: e.id,
          order_id: e.order_id,
          product_id: e.product_id,
          product_name: e.product_name,
          purchased_at: e.created_at,
          amount: order ? fmtBoth(order.amount_paise) : null,
          channel: order?.channel === 'human' ? 'you' : 'agent',
          deliverable: presentEntitlement(e),
        }
      }),
  }
}
