/**
 * guardrails.js — the bounded/gated half of agentic checkout
 *
 * Every rule in here is a plain comparison against a number or a boolean. That
 * is the point: an agent may reason about *what* to buy, but whether money is
 * allowed to move is decided by code you can read top to bottom and predict.
 * No model call, no probability, no prompt that could be talked around.
 *
 * All rules run server-side on every attempt. Nothing here trusts a field the
 * agent supplied about itself — the caller passes an id, and the amounts, the
 * seller status, and the running session total are all looked up locally.
 *
 * Returns an evaluation, never a thrown error, so the caller can log the full
 * set of checks — the ones that passed included — to the audit trail.
 */

import { getSession, hasApproval } from './agentStore.js'

// ── Configuration ────────────────────────────────────────────────────────────
// Amounts in paise. Overridable per deployment; the defaults are chosen so the
// catalogue exercises every rule.
// The session ceiling has to sit above the per-transaction cap by more than the
// priciest SKU, or the gate is unreachable — an item too expensive to approve
// gets blocked by the session budget first and the approval step never runs.
export const LIMITS = {
  // A per-item cap below the price of ordinary stock turns the approval gate
  // into a toll on every purchase, which is not what a spend cap is for. ₹5,000
  // clears the whole catalogue, so what bounds an agent is its session budget —
  // the total it may spend — with the per-item cap left to catch a single
  // purchase far outside the norm. Lower AGENT_TXN_CAP_PAISE to demonstrate the
  // gate on one item.
  perTransactionPaise: Number(process.env.AGENT_TXN_CAP_PAISE ?? 500_000),      // ₹5,000
  perSessionPaise:     Number(process.env.AGENT_SESSION_CAP_PAISE ?? 2_500_000), // ₹25,000
  usdRate:             Number(process.env.INR_PER_USD ?? 83.5),
}

export const fmtINR = paise => `₹${(paise / 100).toLocaleString('en-IN')}`
export const fmtUSD = paise => `$${(paise / 100 / LIMITS.usdRate).toFixed(2)}`
export const fmtBoth = paise => `${fmtINR(paise)} (${fmtUSD(paise)})`

/**
 * @param {object} args
 * @param {object} args.product         resolved digital product row
 * @param {object|null} args.seller     resolved seller row
 * @param {number} args.amountPaise     the exact amount that would be charged
 * @param {string} args.agentSessionId
 * @param {number} args.availableCodes  remaining unlock codes (Infinity for file goods)
 * @returns {{decision:'allowed'|'blocked'|'pending_approval', reason:string, checks:object[]}}
 */
export function evaluate({ product, seller, amountPaise, agentSessionId, availableCodes = Infinity }) {
  const checks = []
  const add = (rule, pass, reason, decision = null) => {
    checks.push({ rule, pass, reason, ...(decision ? { decision } : {}) })
    return pass
  }

  // 1 ── The product has to be real and on sale.
  if (!product) {
    add('product_exists', false, 'no such product', 'blocked')
    return verdict('blocked', 'no such product', checks)
  }
  add('product_exists', true, `${product.name} resolved`)

  if (!product.available) {
    add('product_available', false, `"${product.name}" is not currently available`, 'blocked')
    return verdict('blocked', `"${product.name}" is not currently available`, checks)
  }
  add('product_available', true, 'listed as available')

  // 2 ── The seller must have switched this SKU on for agent checkout. A digital
  //      product a human can buy is not automatically one an agent may buy.
  if (!product.agent_checkout_enabled) {
    const reason = `"${product.name}" is not enabled for AI-buyer checkout by its seller`
    add('agent_checkout_enabled', false, reason, 'blocked')
    return verdict('blocked', reason, checks)
  }
  add('agent_checkout_enabled', true, 'seller enabled AI-buyer checkout')

  // 3 ── Unverified sellers cannot take an agent's money. A human can read a
  //      seller page and judge for themselves; an agent gets a hard rule.
  if (!seller?.haat_verified) {
    const reason = `seller not haat-verified: ${seller?.name ?? 'unknown seller'}`
    add('seller_verified', false, reason, 'blocked')
    return verdict('blocked', reason, checks)
  }
  add('seller_verified', true, `${seller.name} verified since ${seller.verified_since}`)

  // 4 ── Stock. A code-kind product with an empty pool must refuse loudly rather
  //      than take payment for something it cannot deliver.
  if (availableCodes <= 0) {
    const reason = `"${product.name}" has no unlock codes left in stock`
    add('stock_available', false, reason, 'blocked')
    return verdict('blocked', reason, checks)
  }
  add('stock_available', true, availableCodes === Infinity ? 'unlimited (file delivery)' : `${availableCodes} code(s) in pool`)

  // 5 ── Per-session cap. Checked before the per-transaction cap because a
  //      session that is already spent out cannot be rescued by an approval —
  //      the budget is the budget.
  const session = getSession(agentSessionId)
  const wouldTotal = session.spent_paise + amountPaise
  if (wouldTotal > LIMITS.perSessionPaise) {
    const reason =
      `exceeds session budget of ${fmtBoth(LIMITS.perSessionPaise)} — ` +
      `${fmtBoth(session.spent_paise)} already spent, this would take it to ${fmtBoth(wouldTotal)}`
    add('session_cap', false, reason, 'blocked')
    return verdict('blocked', reason, checks)
  }
  add('session_cap', true, `${fmtBoth(wouldTotal)} of ${fmtBoth(LIMITS.perSessionPaise)} session budget`)

  // 6 ── Per-transaction cap. This one gates rather than blocks: a human can
  //      lift it for one specific item at one specific price.
  if (amountPaise > LIMITS.perTransactionPaise) {
    if (hasApproval(agentSessionId, product.id, amountPaise)) {
      add('transaction_cap', true, `over cap but explicitly approved by a human for ${fmtBoth(amountPaise)}`)
      return verdict('allowed', `approved by human for ${fmtBoth(amountPaise)}`, checks)
    }
    const reason = `exceeds per-transaction cap of ${fmtBoth(LIMITS.perTransactionPaise)} — needs explicit human approval`
    add('transaction_cap', false, reason, 'pending_approval')
    return verdict('pending_approval', reason, checks)
  }
  add('transaction_cap', true, `${fmtBoth(amountPaise)} is within the ${fmtBoth(LIMITS.perTransactionPaise)} per-transaction cap`)

  return verdict('allowed', 'within all limits', checks)
}

function verdict(decision, reason, checks) {
  return { decision, reason, checks }
}

/** Snapshot for the UI's spend meter and for the agent's own budget awareness. */
export function budgetSnapshot(agentSessionId) {
  const session = getSession(agentSessionId)
  const remaining = Math.max(0, LIMITS.perSessionPaise - session.spent_paise)
  return {
    spent_paise:       session.spent_paise,
    session_cap_paise: LIMITS.perSessionPaise,
    txn_cap_paise:     LIMITS.perTransactionPaise,
    remaining_paise:   remaining,
    spent:             fmtBoth(session.spent_paise),
    session_cap:       fmtBoth(LIMITS.perSessionPaise),
    txn_cap:           fmtBoth(LIMITS.perTransactionPaise),
    remaining:         fmtBoth(remaining),
    pending_approvals: Object.entries(session.approvals).map(([product_id, a]) => ({ product_id, ...a })),
  }
}
