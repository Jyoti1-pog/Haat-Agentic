/**
 * delivery.js — what actually gets handed over once an order is paid
 *
 * Two kinds, both instant:
 *   file — a signed, time-limited download URL over an asset in data/digital/files
 *   code — one unlock code popped out of the product's pool and burned
 *
 * The signed URL is an HMAC over `entitlement_id|expiry`, checked on the way
 * back in. haat serves these files itself, so the 48h window is our own choice
 * rather than a storage provider's ceiling — set DIGITAL_URL_TTL_HOURS to change it.
 */

import crypto from 'crypto'
import { getDeliverable, peekCode, remainingStock } from './digitalCatalog.js'
import { consumeCode, createEntitlement, findEntitlement, newId } from './agentStore.js'

const TTL_HOURS = Number(process.env.DIGITAL_URL_TTL_HOURS ?? 48)

// A stable secret keeps links valid across restarts. Without one, links are
// still signed — they just stop working when the process recycles.
let ephemeralSecret = null
function signingSecret() {
  if (process.env.DIGITAL_SIGNING_SECRET) return process.env.DIGITAL_SIGNING_SECRET
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString('hex')
    console.warn(
      '[delivery] DIGITAL_SIGNING_SECRET not set — download links will not survive a restart, ' +
      'and on a multi-instance host a link signed by one instance will not verify on another.',
    )
  }
  return ephemeralSecret
}

const sign = (entitlementId, expMs) =>
  crypto.createHmac('sha256', signingSecret()).update(`${entitlementId}|${expMs}`).digest('hex')

export function buildSignedUrl(entitlementId, ttlHours = TTL_HOURS) {
  const exp = Date.now() + ttlHours * 3600 * 1000
  const sig = sign(entitlementId, exp)
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') ?? ''
  return {
    url: `${base}/api/digital/download/${entitlementId}?exp=${exp}&sig=${sig}`,
    expires_at: new Date(exp).toISOString(),
    ttl_hours: ttlHours,
  }
}

export function verifySignedUrl(entitlementId, exp, sig) {
  const expMs = Number(exp)
  if (!Number.isFinite(expMs)) return { valid: false, reason: 'malformed expiry' }
  if (Date.now() > expMs) return { valid: false, reason: 'link expired' }

  const expected = sign(entitlementId, expMs)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(String(sig ?? ''), 'utf8')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'bad signature' }
  }
  return { valid: true, reason: 'ok' }
}

// ── Fulfilment ───────────────────────────────────────────────────────────────
/**
 * Called once an order is confirmed paid. Writes the entitlement row and
 * returns the deliverable in the shape the agent tools hand back.
 *
 * Fulfilment is idempotent per order: if an entitlement already exists for this
 * buyer and product, it is returned as-is rather than burning a second code.
 */
export function fulfil({ order, product }) {
  const existing = findEntitlement(order.buyer_ref, product.id)
  if (existing) {
    return { entitlement: existing, deliverable: presentEntitlement(existing), reused: true }
  }

  const deliverable = getDeliverable(product.id)
  if (!deliverable) {
    throw new Error(`no deliverable configured for ${product.id}`)
  }

  const entitlementId = newId('ent')
  let delivered_code = null
  let delivered_asset_url = null
  let expires_at = null

  if (deliverable.kind === 'code') {
    if (remainingStock(product.id) <= 0) {
      throw new Error(`unlock code pool for ${product.id} is exhausted`)
    }
    delivered_code = peekCode(product.id)
    consumeCode(product.id, delivered_code, order.agent_session_id)
  } else if (deliverable.kind === 'link') {
    // The seller hosts it themselves — haat hands over the URL it was given and
    // does not proxy or sign it, because it is not haat's to expire.
    delivered_asset_url = deliverable.external_url
  } else {
    const signed = buildSignedUrl(entitlementId)
    delivered_asset_url = signed.url
    expires_at = signed.expires_at
  }

  const row = createEntitlement({
    id: entitlementId,
    order_id:  order.id,
    product_id: product.id,
    product_name: product.name,
    buyer_ref: order.buyer_ref,
    agent_session_id: order.agent_session_id,
    kind: deliverable.kind,
    storage_path: deliverable.storage_path,
    asset_id: deliverable.asset_id ?? null,
    filename: deliverable.filename,
    delivered_asset_url,
    delivered_code,
    expires_at,
    created_at: new Date().toISOString(),
  })

  return { entitlement: row, deliverable: presentEntitlement(row), reused: false }
}

/**
 * Re-mints the signed URL on every read rather than storing a frozen one, so a
 * buyer coming back on day three gets a working link instead of a dead one.
 */
export function presentEntitlement(entitlement) {
  if (entitlement.kind === 'code') {
    return {
      kind: 'code',
      product_name: entitlement.product_name,
      unlock_code: entitlement.delivered_code,
      note: 'Single-seat licence key. Redeem at haat.com/redeem.',
    }
  }
  if (entitlement.kind === 'link') {
    return {
      kind: 'link',
      product_name: entitlement.product_name,
      access_url: entitlement.delivered_asset_url,
      note: 'Access link provided by the seller. haat does not host or expire this URL.',
    }
  }
  const signed = buildSignedUrl(entitlement.id)
  return {
    kind: 'file',
    product_name: entitlement.product_name,
    filename: entitlement.filename,
    download_url: signed.url,
    expires_at: signed.expires_at,
    note: `Signed link, valid for ${signed.ttl_hours} hours. Re-fetch the order to get a fresh one.`,
  }
}
