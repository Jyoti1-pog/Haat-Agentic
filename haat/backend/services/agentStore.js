/**
 * agentStore.js — persistence for the agentic-commerce surface
 *
 * The rest of haat keeps its catalogue in a flat JSON file and its carts in an
 * in-memory Map. This follows the same grain: one JSON file on disk, held in
 * memory, flushed after writes. That keeps the agent surface additive — no new
 * database dependency, no migration to run before a demo.
 *
 * What it holds
 * ─────────────
 *   orders          — one row per agent-initiated order attempt that got past the gates
 *   entitlements    — what a buyer_ref already owns (drives duplicate-purchase reuse)
 *   actions         — the audit trail; every tool call lands here, allowed or not
 *   sessions        — per-agent-session spend + granted approvals
 *   consumedCodes   — unlock codes popped out of a product's pool
 *
 * Money is stored as an integer number of paise everywhere. Razorpay's API is
 * denominated in paise, and integers keep the spend caps exact — no float drift
 * on a value that gates whether money moves.
 */

import crypto from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, '../data')
const STORE_PATH = join(DATA_DIR, 'agent-store.json')

const EMPTY = {
  orders: {}, entitlements: [], actions: [], sessions: {},
  consumedCodes: {}, conversations: {},
  sellerProducts: [], sellerDeliverables: [], sellerAssets: {},
}

// ── Load ─────────────────────────────────────────────────────────────────────
function load() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  if (!existsSync(STORE_PATH)) return structuredClone(EMPTY)
  try {
    return { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(STORE_PATH, 'utf8')) }
  } catch (err) {
    console.warn(`[agentStore] could not read ${STORE_PATH} (${err.message}) — starting empty`)
    return structuredClone(EMPTY)
  }
}

const state = load()

// ── Flush ────────────────────────────────────────────────────────────────────
// Debounced + written via a temp file so a crash mid-write can't leave a
// truncated store behind.
let flushTimer = null
function flush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    try {
      const tmp = `${STORE_PATH}.tmp`
      writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8')
      renameSync(tmp, STORE_PATH)
    } catch (err) {
      // Render's filesystem is ephemeral and can be read-only in some plans.
      // The in-memory store still serves the demo, so degrade rather than throw.
      console.warn(`[agentStore] flush failed: ${err.message}`)
    }
  }, 120)
  flushTimer.unref?.()
}

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
    flush()
  }
  return state.sessions[agentSessionId]
}

export function addSessionSpend(agentSessionId, paise) {
  const s = getSession(agentSessionId)
  s.spent_paise += paise
  flush()
  return s.spent_paise
}

export function grantApproval(agentSessionId, productId, amountPaise) {
  const s = getSession(agentSessionId)
  s.approvals[productId] = { granted_at: new Date().toISOString(), approved_amount_paise: amountPaise }
  flush()
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
  flush()
}

// ── Orders ───────────────────────────────────────────────────────────────────
export function createOrderRow(row) {
  state.orders[row.id] = row
  flush()
  return row
}

export function getOrder(orderId) {
  return state.orders[orderId] ?? null
}

export function updateOrder(orderId, patch) {
  const order = state.orders[orderId]
  if (!order) return null
  Object.assign(order, patch, { updated_at: new Date().toISOString() })
  flush()
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
  flush()
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
  flush()
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
  state.actions.push(row)
  flush()
  return row
}

export function listActions(agentSessionId, since = 0) {
  const rows = agentSessionId
    ? state.actions.filter(a => a.agent_session_id === agentSessionId)
    : state.actions
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
  flush()
  return product
}

export const listSellerProducts     = () => state.sellerProducts
export const listSellerDeliverables = () => state.sellerDeliverables

/** Uploaded deliverable bytes, kept base64 so they survive a store reload. */
export function putSellerAsset(id, { filename, mimetype, base64 }) {
  state.sellerAssets[id] = { filename, mimetype, base64, created_at: new Date().toISOString() }
  flush()
  return id
}

export const getSellerAsset = id => state.sellerAssets[id] ?? null

// ── Agent conversation ───────────────────────────────────────────────────────
// Kept per session so that a run interrupted by an approval gate resumes the
// same conversation instead of starting over and re-searching.
export function getConversation(agentSessionId) {
  return state.conversations[agentSessionId] ?? []
}

export function saveConversation(agentSessionId, messages) {
  state.conversations[agentSessionId] = messages
  flush()
}

/**
 * Wipes one session's trail — the demo page's "reset" control. Unlock codes it
 * burned go back in the pool, so the surface is genuinely returned to its
 * starting state and the next run behaves identically to the last.
 */
export function resetSession(agentSessionId) {
  delete state.sessions[agentSessionId]
  delete state.conversations[agentSessionId]
  state.actions = state.actions.filter(a => a.agent_session_id !== agentSessionId)
  for (const [id, o] of Object.entries(state.orders)) {
    if (o.agent_session_id === agentSessionId) delete state.orders[id]
  }
  state.entitlements = state.entitlements.filter(e => e.agent_session_id !== agentSessionId)
  releaseCodes(agentSessionId)
  flush()
}

/** Full clean slate across every session — for setting up before a demo. */
export function resetAll() {
  Object.assign(state, structuredClone(EMPTY))
  flush()
}

export default state
