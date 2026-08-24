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

// ── Razorpay Checkout ────────────────────────────────────────────────────────
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let checkoutScript = null

/** Loads Razorpay's hosted checkout once, and reuses it after that. */
function loadRazorpay() {
  if (globalThis.Razorpay) return Promise.resolve(true)
  checkoutScript ??= new Promise(resolve => {
    const el = document.createElement('script')
    el.src = CHECKOUT_SRC
    el.async = true
    el.onload = () => resolve(true)
    el.onerror = () => { checkoutScript = null; resolve(false) }
    document.head.appendChild(el)
  })
  return checkoutScript
}

/**
 * Opens Razorpay's card form and resolves with what it hands back.
 *
 * This is the real payment step for a person. The agent path cannot use it —
 * there is no browser to show a card form in — which is why authorise() exists
 * as a stand-in there. A shopper should never be given the stand-in.
 */
function payWithRazorpay(order, buyerRef) {
  return new Promise((resolve, reject) => {
    const rzp = new globalThis.Razorpay({
      key: order.razorpay_key_id,
      order_id: order.razorpay_order_id,
      amount: order.amount_paise,
      currency: order.currency ?? 'INR',
      name: 'haat',
      description: order.product?.name ?? 'Digital product',
      prefill: { email: buyerRef },
      notes: { haat_order_id: order.order_id },
      theme: { color: '#B8935A', backdrop_color: '#0F0D0A' },
      handler: response => resolve(response),
      modal: {
        // Closing the form is a decision, not a failure. Nothing was charged.
        ondismiss: () => reject(Object.assign(new Error('Payment cancelled.'), { cancelled: true })),
        escape: true,
      },
    })
    rzp.on('payment.failed', res => {
      reject(new Error(res?.error?.description ?? 'The payment was declined.'))
    })
    rzp.open()
  })
}

/**
 * One product, bought all the way through.
 *
 * Two payment paths, and which one runs is decided by the server, not here: if
 * it returned a Razorpay key, the buyer pays through Razorpay's hosted card
 * form. If it did not — no keys configured on this deployment — the same
 * authorise-then-confirm stand-in the agent path uses fills in, and the caller
 * is told, so the UI can say plainly that no card was taken.
 *
 * Verification is identical either way: the signature is checked server-side,
 * and a real payment id is also confirmed against Razorpay's API before
 * anything is delivered.
 */
export async function purchase(productId, buyerRef, { outcome = 'captured' } = {}) {
  const order = await createOrder(productId, buyerRef)
  if (order.status !== 'created') return order

  const common = { razorpay_order_id: order.razorpay_order_id, razorpay_mode: order.razorpay_mode }

  if (order.razorpay_key_id) {
    const ready = await loadRazorpay()
    if (!ready) {
      return {
        ...common,
        status: 'error',
        reason: 'Could not reach Razorpay checkout. Check your connection and try again.',
      }
    }
    const res = await payWithRazorpay(order, buyerRef)
    const done = await confirm(order.order_id, res.razorpay_payment_id, res.razorpay_signature)
    return { ...done, ...common, paid_with: 'razorpay' }
  }

  const auth = await authorise(order.order_id, outcome)
  const done = await confirm(order.order_id, auth.razorpay_payment_id, auth.razorpay_signature)
  return { ...done, ...common, paid_with: 'simulated' }
}

export const inr = n => `₹${Number(n).toLocaleString('en-IN')}`
