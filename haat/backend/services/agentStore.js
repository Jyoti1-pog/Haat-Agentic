/**
 * agentStore.js — runtime state for the agentic-commerce surface
 *
 * Holds orders, entitlements, the audit trail, per-session budgets, burned
 * licence keys and seller listings. Money is stored as an integer number of
 * paise everywhere: Razorpay's API is denominated in paise, and integers keep
 * the spend caps exact — no float drift on a value that gates whether money moves.
 *
 * Reads and writes here are synchronous, deliberately. Every caller — the
 * guardrails, the order path, the ledger — reads state mid-decision, and making
 * that async would colour the whole codebase for no benefit.
 *
 * Durability is handled around the edges instead: services/storage.js loads the
 * state before a request runs and writes it after, which is what lets the same
 * synchronous code work on a serverless host where nothing survives in memory.
 * See hydrate() and persist() at the bottom.
 */

import crypto from 'crypto'
import * as storage from './storage.js'

const EMPTY = {
  orders: {}, entitlements: [], actions: [], sessions: {},
  consumedCodes: {}, conversations: {},
  sellerProducts: [], sellerDeliverables: [], sellerAssets: {},
}

// The live state. Replaced wholesale by hydrate(), mutated in place by everything else.
let state = structuredClone(EMPTY)
let dirty = false

/** Marks the state as needing a write. Called by every mutating function. */
const touch = () => { dirty = true }

// Written on persist(), not inline: audit rows append, blobs go to their own
// keys. Both stay out of the hot state that every request reads and rewrites.
let pendingActions = []
let pendingBlobs = []

export const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`

// ── Sessions ─────────────────────────────────────────────────────────────────
export function getSession(agentSessionId) {
  if (!state.sessions[agentSessionId]) {
    state.sessions[agentSessionId] = {
      agent_session_id: agentSessionId,
      created_at:       new Date().toISOString(),
      spent_paise:      0,
      approvals:        {},   // product_id → { granted_at, approved_amount_paise }
    }
    touch()
  }
  return state.sessions[agentSessionId]
}

export function addSessionSpend(agentSessionId, paise) {
  const s = getSession(agentSessionId)
  s.spent_paise += paise
  touch()
  return s.spent_paise
}

export function grantApproval(agentSessionId, productId, amountPaise) {
  const s = getSession(agentSessionId)
  s.approvals[productId] = { granted_at: new Date().toISOString(), approved_amount_paise: amountPaise }
  touch()
  return s.approvals[productId]
}

export function hasApproval(agentSessionId, productId, amountPaise) {
  const approval = getSession(agentSessionId).approvals[productId]
  if (!approval) return false
  // An approval authorises one specific amount. If the price changed after the
  // human approved it, the approval no longer applies.
  return approval.approved_amount_paise === amountPaise
}

export function consumeApproval(agentSessionId, productId) {
  const s = getSession(agentSessionId)
  delete s.approvals[productId]
  touch()
}

// ── Orders ───────────────────────────────────────────────────────────────────
export function createOrderRow(row) {
  state.orders[row.id] = row
  touch()
  return row
}

export function getOrder(orderId) {
  return state.orders[orderId] ?? null
}

export function updateOrder(orderId, patch) {
  const order = state.orders[orderId]
  if (!order) return null
  Object.assign(order, patch, { updated_at: new Date().toISOString() })
  touch()
  return order
}

export function findOrderByRazorpayId(razorpayOrderId) {
  return Object.values(state.orders).find(o => o.razorpay_order_id === razorpayOrderId) ?? null
}

/** Idempotency: an unpaid order already open for this session+product is reused. */
export function findOpenOrder(agentSessionId, productId) {
  return Object.values(state.orders).find(o =>
    o.agent_session_id === agentSessionId &&
    o.product_id === productId &&
    o.status === 'created'
  ) ?? null
}

// ── Entitlements ─────────────────────────────────────────────────────────────
export function createEntitlement(row) {
  state.entitlements.push(row)
  touch()
  return row
}

export function findEntitlement(buyerRef, productId) {
  return state.entitlements.find(e => e.buyer_ref === buyerRef && e.product_id === productId) ?? null
}

export function findEntitlementByOrder(orderId) {
  return state.entitlements.find(e => e.order_id === orderId) ?? null
}

export function getEntitlement(entitlementId) {
  return state.entitlements.find(e => e.id === entitlementId) ?? null
}

export function listEntitlements(buyerRef) {
  return buyerRef ? state.entitlements.filter(e => e.buyer_ref === buyerRef) : [...state.entitlements]
}

// ── Unlock-code pool ─────────────────────────────────────────────────────────
// Each burned code records which session burned it, so resetting a session can
// return exactly its own codes to the pool. Without that, a pool drains a
// little on every rehearsal and the demo eventually stops being repeatable.
export function consumedCodes(productId) {
  return state.consumedCodes[productId] ?? []
}

export function consumeCode(productId, code, agentSessionId = null) {
  if (!state.consumedCodes[productId]) state.consumedCodes[productId] = []
  state.consumedCodes[productId].push({ code, agent_session_id: agentSessionId, at: new Date().toISOString() })
  touch()
  return code
}

function releaseCodes(agentSessionId) {
  for (const [productId, burned] of Object.entries(state.consumedCodes)) {
    state.consumedCodes[productId] = burned.filter(c => c.agent_session_id !== agentSessionId)
  }
}

// ── Audit trail ──────────────────────────────────────────────────────────────
/**
 * Every tool call writes here — including the ones that were refused. `reason`
 * is always populated for anything that was blocked or gated, because the whole
 * point of the log is that a decision can be read back without the code.
 */
export function logAction({
  agent_session_id, action_type, product_id = null, product_name = null,
  amount_paise = null, decision = null, reason = '', actor = 'agent', meta = null,
}) {
  const row = {
    id: newId('act'),
    agent_session_id,
    action_type,
    product_id,
    product_name,
    amount_paise,
    decision,
    reason,
    actor,
    meta,
    created_at: new Date().toISOString(),
  }
  // Buffered rather than written here, so logAction stays synchronous for the
  // dozens of call sites that use it mid-decision. persist() flushes the buffer
  // as an append, which no concurrent writer can clobber.
  pendingActions.push(row)
  return row
}

/**
 * Reads the trail back from append-only storage.
 *
 * Async because the log deliberately does not live in the hot state — it is the
 * one thing here that must grow without bound, and rewriting it on every request
 * is what made each purchase cost ~5 KB of blob churn.
 */
export async function listActions(agentSessionId, since = 0) {
  const all = [...(await storage.readActions()), ...pendingActions]
  const rows = agentSessionId ? all.filter(a => a.agent_session_id === agentSessionId) : all
  return rows.slice(since)
}

export function listOrders(agentSessionId) {
  return Object.values(state.orders)
    .filter(o => !agentSessionId || o.agent_session_id === agentSessionId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

// ── Seller-created products ──────────────────────────────────────────────────
// Products a seller adds through the dashboard live here rather than being
// written back into the seed JSON, so the committed catalogue stays a fixture
// and anything created at runtime can be cleared without a git diff. The
// catalogue loader merges the two at read time.
export function createSellerProduct(product, deliverable) {
  state.sellerProducts.push(product)
  if (deliverable) state.sellerDeliverables.push(deliverable)
  touch()
  return product
}

export const listSellerProducts     = () => state.sellerProducts
export const listSellerDeliverables = () => state.sellerDeliverables

/**
 * Uploaded deliverable bytes.
 *
 * Only the metadata lands in the hot state; the bytes go to their own key and
 * are fetched when the file is actually served. Keeping them inline made a 2 MB
 * upload into 98% of a blob that is read and written on every single request.
 */
export function putSellerAsset(id, { filename, mimetype, base64 }) {
  state.sellerAssets[id] = { filename, mimetype, size: base64.length, created_at: new Date().toISOString() }
  pendingBlobs.push([id, { filename, mimetype, base64 }])
  touch()
  return id
}

export async function getSellerAsset(id) {
  const meta = state.sellerAssets[id]
  if (!meta) return null
  const blob = await storage.getBlob(id)
  return blob ? { ...meta, ...blob } : null
}

// ── Agent conversation ───────────────────────────────────────────────────────
// Kept per session so that a run interrupted by an approval gate resumes the
// same conversation instead of starting over and re-searching.
export function getConversation(agentSessionId) {
  return state.conversations[agentSessionId] ?? []
}

export function saveConversation(agentSessionId, messages) {
  state.conversations[agentSessionId] = messages
  touch()
}

/**
 * Wipes one session's trail — the demo page's "reset" control. Unlock codes it
 * burned go back in the pool, so the surface is genuinely returned to its
 * starting state and the next run behaves identically to the last.
 */
export function resetSession(agentSessionId) {
  delete state.sessions[agentSessionId]
  delete state.conversations[agentSessionId]
  pendingActions = pendingActions.filter(a => a.agent_session_id !== agentSessionId)
  pendingClears.push(a => a.agent_session_id === agentSessionId)
  for (const [id, o] of Object.entries(state.orders)) {
    if (o.agent_session_id === agentSessionId) delete state.orders[id]
  }
  state.entitlements = state.entitlements.filter(e => e.agent_session_id !== agentSessionId)
  releaseCodes(agentSessionId)
  touch()
}

/** Full clean slate across every session — for setting up before a demo. */
export function resetAll() {
  state = structuredClone(EMPTY)
  pendingActions = []
  pendingBlobs = []
  pendingClears.push(() => true)
  touch()
}

// Audit rows live outside the hot state, so clearing them is its own step,
// deferred to persist() like every other write.
let pendingClears = []

// ── Durability ───────────────────────────────────────────────────────────────
/**
 * Pulls the stored state in before a request is handled.
 *
 * On a long-lived server this matters once, at boot. On a serverless host it
 * matters on every invocation, because the process handling confirm_payment is
 * not the one that handled create_order and starts with nothing.
 */
export async function hydrate() {
  try {
    const stored = await storage.load()
    if (stored) state = { ...structuredClone(EMPTY), ...stored }
    dirty = false
  } catch (err) {
    // Losing a read is bad, but serving a stale-but-working store beats a 500.
    console.warn(`[agentStore] hydrate failed (${err.message}) — continuing with in-memory state`)
  }
}

/** Writes the state back, but only if something actually changed. */
export async function persist() {
  const actions = pendingActions
  const blobs = pendingBlobs
  pendingActions = []
  pendingBlobs = []

  try {
    // Appends first: an audit row for something that happened must survive even
    // if the state write below fails.
    if (actions.length) await storage.appendActions(actions)
    for (const predicate of pendingClears.splice(0)) await storage.clearActions(predicate)
    for (const [id, blob] of blobs) await storage.putBlob(id, blob)
    if (dirty) {
      await storage.save(state)
      dirty = false
    }
  } catch (err) {
    console.warn(`[agentStore] persist failed: ${err.message}`)
  }
}

export const isDirty = () => dirty
export default state
