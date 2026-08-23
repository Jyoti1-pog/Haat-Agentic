/**
 * agentCommerce.js — client for the agentic-commerce surface
 *
 * Deliberately plain fetch rather than the shared axios client: these
 * endpoints carry no Supabase session, and the page must keep working when
 * nobody is signed in. A judge should be able to open /agent-checkout cold.
 */

const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/agent-commerce`
  : '/api/agent-commerce'

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok && res.status >= 500) {
    throw new Error(json.error ?? `Request failed (${res.status})`)
  }
  return json
}

export const getManifest = () => call('/manifest')

export const getLedger = (sessionId, since = 0) =>
  call(`/ledger/${encodeURIComponent(sessionId)}?since=${since}`)

export const resetSession = sessionId =>
  call(`/reset/${encodeURIComponent(sessionId)}`, { method: 'POST' })

export const searchProducts = (agent_session_id, query, max_price_inr = null) =>
  call('/search', { method: 'POST', body: { agent_session_id, query, max_price_inr } })

export const createOrder = (agent_session_id, product_id, buyer_ref) =>
  call('/orders', { method: 'POST', body: { agent_session_id, product_id, buyer_ref } })

export const authorisePayment = (agent_session_id, order_id, outcome = 'captured') =>
  call(`/orders/${order_id}/authorise`, { method: 'POST', body: { agent_session_id, outcome } })

export const confirmPayment = (agent_session_id, order_id, razorpay_payment_id, razorpay_signature) =>
  call(`/orders/${order_id}/confirm`, {
    method: 'POST',
    body: { agent_session_id, razorpay_payment_id, razorpay_signature },
  })

export const decideApproval = (agent_session_id, product_id, approved, approved_by = 'you') =>
  call('/approvals', { method: 'POST', body: { agent_session_id, product_id, approved, approved_by } })

export const runAgent = (agent_session_id, prompt, buyer_ref) =>
  call('/run', { method: 'POST', body: { agent_session_id, prompt, buyer_ref } })

/** Storefront catalogue — includes SKUs not opened to agents. */
export const listDigitalProducts = () => {
  const base = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/digital` : '/api/digital'
  return fetch(`${base}/products`).then(r => r.json())
}

/** Runs one purchase all the way through, as an agent would. */
export async function purchase(sessionId, productId, buyerRef, { outcome = 'captured' } = {}) {
  const order = await createOrder(sessionId, productId, buyerRef)
  if (order.status !== 'created') return order

  const auth = await authorisePayment(sessionId, order.order_id, outcome)
  return confirmPayment(sessionId, order.order_id, auth.razorpay_payment_id, auth.razorpay_signature)
}
