/**
 * shop.js — storefront client
 *
 * Plain fetch, no auth header. A purchase needs a buyer reference, not a
 * session, so anyone can transact without signing up.
 */

const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok && res.status >= 500) throw new Error(json.error ?? `Request failed (${res.status})`)
  return json
}

export const listProducts = () => call('/digital/products')
export const getProduct   = id => call(`/digital/products/${id}`)
export const listSellers  = () => call('/digital/sellers')
export const getLibrary   = buyer => call(`/shop/library/${encodeURIComponent(buyer)}`)
export const getOrder     = id => call(`/shop/orders/${id}`)

export const createOrder = (product_id, buyer_ref) =>
  call('/shop/orders', { method: 'POST', body: { product_id, buyer_ref } })

export const authorise = (order_id, outcome = 'captured') =>
  call(`/shop/orders/${order_id}/authorise`, { method: 'POST', body: { outcome } })

export const confirm = (order_id, razorpay_payment_id, razorpay_signature) =>
  call(`/shop/orders/${order_id}/confirm`, {
    method: 'POST',
    body: { razorpay_payment_id, razorpay_signature },
  })

/**
 * One product, bought all the way through.
 *
 * When Razorpay keys are configured the card step belongs in their hosted
 * checkout; without them the same authorise-then-confirm path the agent uses
 * stands in, and the caller is told which happened so the UI can say so.
 */
export async function purchase(productId, buyerRef, { outcome = 'captured' } = {}) {
  const order = await createOrder(productId, buyerRef)
  if (order.status !== 'created') return order

  const auth = await authorise(order.order_id, outcome)
  const done = await confirm(order.order_id, auth.razorpay_payment_id, auth.razorpay_signature)

  return { ...done, razorpay_order_id: order.razorpay_order_id, razorpay_mode: order.razorpay_mode }
}

export const inr = n => `₹${Number(n).toLocaleString('en-IN')}`
