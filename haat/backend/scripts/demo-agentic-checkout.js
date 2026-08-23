#!/usr/bin/env node
/**
 * demo-agentic-checkout.js — drives the whole agent loop over plain HTTP
 *
 * Two jobs. It is the smoke test for the agentic-commerce surface, and it is
 * the fallback demo path: no model, no API key, no browser — every guardrail
 * exercised deterministically, which is what you want on a stage.
 *
 *   node scripts/demo-agentic-checkout.js
 *   node scripts/demo-agentic-checkout.js --base https://haat-backend.onrender.com
 *
 * Exits non-zero if any scenario does not reach its expected outcome.
 */

import { argv } from 'process'

const arg = name => {
  const i = argv.indexOf(`--${name}`)
  return i > -1 ? argv[i + 1] : null
}

const BASE = (arg('base') ?? 'http://localhost:3001').replace(/\/$/, '')
const SESSION = arg('session') ?? `demo-${Date.now()}`
// Unique per run by default. Entitlements are keyed on the buyer, not the
// session, so a fixed address makes the second run of the day trip the
// single-seat reuse rule and "fail" a check that is in fact working.
const BUYER = arg('buyer') ?? `demo-${Date.now()}@haat.test`

const C = {
  dim: s => `\x1b[2m${s}\x1b[0m`,
  gold: s => `\x1b[33m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  red: s => `\x1b[31m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`,
}

let failures = 0

async function call(method, path, body, session = SESSION) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify({ agent_session_id: session, ...body }) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  return { http: res.status, ...json }
}

function check(label, actual, expected) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`  ${ok ? C.green('✓') : C.red('✗')} ${label} ${C.dim(`→ ${actual}${ok ? '' : ` (expected ${expected})`}`)}`)
  return ok
}

function step(n, title) {
  console.log(`\n${C.gold(`${n}.`)} ${C.bold(title)}`)
}

// ── Buy one product end to end ───────────────────────────────────────────────
async function purchase(productId, { expectFailure = false, session = SESSION, buyer = BUYER } = {}) {
  const order = await call('POST', '/api/agent-commerce/orders', { product_id: productId, buyer_ref: buyer }, session)
  if (order.status !== 'created') return order

  console.log(`  ${C.dim(`order ${order.order_id} · razorpay ${order.razorpay_order_id} · ${order.amount}`)}`)

  const auth = await call('POST', `/api/agent-commerce/orders/${order.order_id}/authorise`, {
    outcome: expectFailure ? 'failed' : 'captured',
  }, session)

  return call('POST', `/api/agent-commerce/orders/${order.order_id}/confirm`, {
    razorpay_payment_id: auth.razorpay_payment_id,
    razorpay_signature: auth.razorpay_signature,
  }, session)
}

// ── Run ──────────────────────────────────────────────────────────────────────
console.log(C.bold(`\nhaat agentic checkout — scripted run`))
console.log(C.dim(`base ${BASE} · session ${SESSION} · buyer ${BUYER}\n`))

const manifest = await call('GET', '/api/agent-commerce/manifest')
if (manifest.http !== 200) {
  console.error(C.red(`\nBackend not reachable at ${BASE} — start it with: npm run dev\n`))
  process.exit(1)
}
console.log(C.dim(`razorpay mode: ${manifest.payment_provider?.mode} · caps ${manifest.limits?.per_transaction}/txn, ${manifest.limits?.per_session}/session`))

await call('POST', `/api/agent-commerce/reset/${SESSION}`)

// 1 ── Discovery
step(1, 'Agent searches the catalogue')
const found = await call('POST', '/api/agent-commerce/search', { query: 'block print pattern' })
check('search returns results', found.count > 0, true)
console.log(C.dim(`  ${found.products.map(p => `${p.product_id} ${p.name} ₹${p.price_inr}`).join('\n  ')}`))

// 2 ── A clean purchase
step(2, 'Buys a pattern pack — within every limit')
const bought = await purchase('dp001')
check('delivered', bought.status, 'delivered')
if (bought.deliverable) console.log(C.dim(`  → ${bought.deliverable.download_url ?? bought.deliverable.unlock_code}`))

// 3 ── Unverified seller
step(3, 'Tries a product from an unverified seller')
const unverified = await call('POST', '/api/agent-commerce/orders', { product_id: 'dp005', buyer_ref: BUYER })
check('blocked', unverified.status, 'blocked')
console.log(C.dim(`  reason: ${unverified.reason}`))

// 4 ── Seller has not opened this SKU to agents
step(4, 'Tries a digital SKU the seller did not open to AI buyers')
const notEnabled = await call('POST', '/api/agent-commerce/orders', { product_id: 'dp006', buyer_ref: BUYER })
check('blocked', notEnabled.status, 'blocked')
console.log(C.dim(`  reason: ${notEnabled.reason}`))

// 5 ── The spend-cap gate, then human approval
step(5, 'Wants a ₹4,999 course — over the per-transaction cap')
const gated = await call('POST', '/api/agent-commerce/orders', { product_id: 'dp004', buyer_ref: BUYER })
check('pending_approval', gated.status, 'pending_approval')
console.log(C.dim(`  reason: ${gated.reason}`))

step(6, 'A human approves that one item at that one price')
const approval = await call('POST', '/api/agent-commerce/approvals', {
  product_id: 'dp004', approved: true, approved_by: 'demo-operator',
})
check('approved', approval.status, 'approved')

step(7, 'Agent retries — now allowed, and pays')
const afterApproval = await purchase('dp004')
check('delivered', afterApproval.status, 'delivered')
if (afterApproval.deliverable) console.log(C.dim(`  → unlock code ${afterApproval.deliverable.unlock_code}`))

// 8 ── Declined card
step(8, 'A card that declines — nothing delivered, budget untouched')
const beforeFail = (await call('GET', `/api/agent-commerce/budget/${SESSION}`)).budget.spent_paise
const failed = await purchase('dp002', { expectFailure: true })
check('payment_failed', failed.status, 'payment_failed')
const afterFail = (await call('GET', `/api/agent-commerce/budget/${SESSION}`)).budget.spent_paise
check('budget unchanged by the failure', afterFail, beforeFail)

// 9 ── Session budget is a hard ceiling
step(9, 'Next purchase would break the session budget')
const overBudget = await call('POST', '/api/agent-commerce/orders', { product_id: 'dp003', buyer_ref: BUYER })
check('blocked', overBudget.status, 'blocked')
console.log(C.dim(`  reason: ${overBudget.reason}`))

// 10 ── Duplicate purchase of a single-seat licence.
//       Runs in its own session and under its own buyer so the trail above
//       stays intact and this starts against a clean budget.
step(10, 'A second buyer purchases the same single-seat licence twice')
const dupSession = `${SESSION}-dup`
const dupBuyer   = `dup-${Date.now()}@haat.test`
const first = await purchase('dp003', { session: dupSession, buyer: dupBuyer })
check('first purchase delivered', first.status, 'delivered')
const second = await call('POST', '/api/agent-commerce/orders', { product_id: 'dp003', buyer_ref: dupBuyer }, dupSession)
check('second returns the existing entitlement', second.status, 'already_entitled')
console.log(C.dim(`  reason: ${second.reason}`))
const dupBudget = await call('GET', `/api/agent-commerce/budget/${dupSession}`)
check('charged exactly once', dupBudget.budget.spent_paise, 149900)

// ── Ledger ───────────────────────────────────────────────────────────────────
const ledger = await call('GET', `/api/agent-commerce/ledger/${SESSION}`)
console.log(`\n${C.bold('Audit trail')} ${C.dim(`(${ledger.actions.length} entries)`)}`)
for (const a of ledger.actions) {
  const t = new Date(a.created_at).toISOString().slice(11, 19)
  const mark = a.decision === 'blocked' ? C.red('BLOCKED')
    : a.decision === 'pending_approval' ? C.gold('GATED')
    : C.green('OK')
  console.log(`  ${C.dim(t)}  ${mark.padEnd(18)} ${a.action_type.padEnd(20)} ${a.reason}`)
}

console.log(`\n${C.bold('Spend')}: ${ledger.budget.spent} of ${ledger.budget.session_cap}`)

if (failures) {
  console.log(C.red(`\n${failures} check(s) failed\n`))
  process.exitCode = 1
} else {
  console.log(C.green(`\nAll checks passed\n`))
}
