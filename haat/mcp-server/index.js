#!/usr/bin/env node
/**
 * haat-mcp — a standalone MCP server for the haat marketplace
 *
 * This is the distributable one. The in-repo server at backend/mcp/server.js
 * imports haat's service modules directly, so it only works on a machine that
 * has the code and the data. This one speaks to a haat deployment over plain
 * HTTP, which means an agent anywhere can transact against a hosted haat with
 * nothing installed but this file.
 *
 *   npx haat-mcp                              → talks to http://localhost:3001
 *   HAAT_URL=https://haat.example.com npx haat-mcp
 *
 * It holds no business logic on purpose. Every guardrail — spend caps, the
 * seller-verification rule, stock, the approval gate — is enforced server-side
 * by haat, and this process cannot weaken any of it. A compromised or modified
 * copy of this file still cannot buy from an unverified seller or exceed a cap,
 * because it is not the thing making those decisions.
 *
 * Note what is absent: there is no approval tool. An agent that could approve
 * its own over-cap spending would make the gate decoration. Approval comes from
 * a human, through haat's ledger UI or its REST endpoint.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// ── Configuration ────────────────────────────────────────────────────────────
const HAAT_URL = (process.env.HAAT_URL ?? 'http://localhost:3001').replace(/\/$/, '')

// One MCP process is one agent session; give each client its own so they do not
// share a spend budget.
const SESSION   = process.env.HAAT_AGENT_SESSION ?? `mcp-${process.pid}-${Date.now().toString(36)}`
const BUYER_REF = process.env.HAAT_BUYER_REF ?? SESSION
const TIMEOUT   = Number(process.env.HAAT_TIMEOUT_MS ?? 30_000)

// Deployments that enforce keys namespace your session to the key, so two
// agents cannot collide or spend each other's budget. Open ones ignore it.
const API_KEY   = process.env.HAAT_API_KEY ?? ''

// ── HTTP ─────────────────────────────────────────────────────────────────────
async function call(path, { method = 'GET', body } = {}) {
  const ctrl = AbortSignal.timeout(TIMEOUT)
  const res = await fetch(`${HAAT_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: body ? JSON.stringify({ agent_session_id: SESSION, ...body }) : undefined,
    signal: ctrl,
  })

  const json = await res.json().catch(() => ({}))

  // A refusal is a real answer with a reason attached, not a transport failure.
  // Only genuine server faults become errors.
  if (res.status === 401) {
    throw new Error(
      `${json.reason ?? 'Unauthorized'} Set HAAT_API_KEY in this server's env.`,
    )
  }
  if (res.status >= 500) {
    throw new Error(json.error ?? `haat returned HTTP ${res.status}`)
  }
  return absolutise(json)
}

/**
 * haat emits deliverable links relative to itself, which is correct for its own
 * web UI — same origin. It is wrong for us: an agent hands these to a person who
 * is nowhere near haat, and "/api/digital/download/..." resolves to nothing on
 * their machine.
 *
 * This is the boundary where "relative to haat" stops being meaningful, so this
 * is where they get an origin attached. Absolute URLs pass through untouched, so
 * setting PUBLIC_BASE_URL on the server is equally fine.
 */
function absolutise(value) {
  if (typeof value === 'string') {
    return value.startsWith('/api/') ? HAAT_URL + value : value
  }
  if (Array.isArray(value)) return value.map(absolutise)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, absolutise(v)]))
  }
  return value
}

// ── Tools ────────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'search_digital_products',
    description:
      'Search haat for digital goods made by Indian craftspeople — pattern packs, brushes, typefaces, ' +
      'field recordings, courses — that are open to AI-buyer checkout. Returns price in INR, the seller ' +
      'and whether haat has verified them, licence terms, and remaining stock for licence keys. ' +
      'You can only buy products returned by this tool.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the buyer wants, in plain words. Omit to list everything.' },
        max_price_inr: { type: 'number', description: 'Optional price ceiling in rupees.' },
      },
      required: [],
    },
  },
  {
    name: 'get_product',
    description:
      'Full detail on one product — licence terms, origin, file size, remaining stock, how it is ' +
      'delivered. Never returns the deliverable itself; that only arrives after payment.',
    inputSchema: {
      type: 'object',
      properties: { product_id: { type: 'string' } },
      required: ['product_id'],
    },
  },
  {
    name: 'get_budget',
    description:
      'The spending limits this session is operating under and how much of the budget remains. ' +
      'Call this rather than guessing — haat enforces limits you are not told in advance.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_order',
    description:
      'Create a payable Razorpay order for one product. haat runs its spend caps, the ' +
      'seller-verification rule and the stock check before anything is created, so this may answer ' +
      '"blocked" (a hard refusal — do not retry), "pending_approval" (needs one explicit human ' +
      'approval you cannot give yourself), or "already_entitled" (the buyer owns it). Those are ' +
      'answers, not errors. Always call this rather than deciding for yourself that something will ' +
      'be refused — the attempt is what gets recorded in the audit ledger. Creating an order moves no money.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        buyer_ref: { type: 'string', description: 'Who the purchase is for. Defaults to this session.' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'authorise_payment',
    description:
      'Authorise payment on an order. Razorpay card capture normally happens in a browser you do not ' +
      'have, so this stands in for that step and returns a payment id and signature to pass to ' +
      'confirm_payment. Use outcome "captured" unless deliberately demonstrating a decline.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string' },
        outcome: { type: 'string', enum: ['captured', 'failed'], default: 'captured' },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'confirm_payment',
    description:
      'Verify the payment signature server-side; if it holds, mark the order paid and deliver the ' +
      'product. Returns a signed download link, a licence key, or an access URL. This is the step ' +
      'that actually spends budget — an order is not a purchase until this returns.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string' },
        razorpay_payment_id: { type: 'string' },
        razorpay_signature: { type: 'string' },
      },
      required: ['order_id', 'razorpay_payment_id', 'razorpay_signature'],
    },
  },
  {
    name: 'get_order_status',
    description:
      'Status of an order, plus the deliverable if it has been delivered. Signed download links are ' +
      're-minted fresh on every call, so this is how you recover a link that has expired.',
    inputSchema: {
      type: 'object',
      properties: { order_id: { type: 'string' } },
      required: ['order_id'],
    },
  },
  {
    name: 'get_library',
    description:
      'Everything a buyer already owns, newest first, with a working link or key for each. Check here ' +
      'before buying something a person may already have.',
    inputSchema: {
      type: 'object',
      properties: { buyer_ref: { type: 'string', description: 'Defaults to this session’s buyer.' } },
      required: [],
    },
  },
  {
    name: 'get_audit_log',
    description:
      'This session’s audit trail — every action taken, including the refusals, each with a ' +
      'human-readable reason. Use it to explain to a person what happened and why.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
]

// ── Dispatch ─────────────────────────────────────────────────────────────────
async function dispatch(name, args) {
  switch (name) {
    case 'search_digital_products':
      return call('/api/agent-commerce/search', {
        method: 'POST',
        body: { query: args.query ?? '', max_price_inr: args.max_price_inr ?? null },
      })

    case 'get_product':
      return call(`/api/agent-commerce/products/${encodeURIComponent(args.product_id)}?agent_session_id=${encodeURIComponent(SESSION)}`)

    case 'get_budget':
      return call(`/api/agent-commerce/budget/${encodeURIComponent(SESSION)}`)

    case 'create_order':
      return call('/api/agent-commerce/orders', {
        method: 'POST',
        body: { product_id: args.product_id, buyer_ref: args.buyer_ref ?? BUYER_REF },
      })

    case 'authorise_payment':
      return call(`/api/agent-commerce/orders/${encodeURIComponent(args.order_id)}/authorise`, {
        method: 'POST',
        body: { outcome: args.outcome ?? 'captured' },
      })

    case 'confirm_payment':
      return call(`/api/agent-commerce/orders/${encodeURIComponent(args.order_id)}/confirm`, {
        method: 'POST',
        body: {
          razorpay_payment_id: args.razorpay_payment_id,
          razorpay_signature: args.razorpay_signature,
        },
      })

    case 'get_order_status':
      return call(`/api/agent-commerce/orders/${encodeURIComponent(args.order_id)}`)

    case 'get_library':
      return call(`/api/shop/library/${encodeURIComponent(args.buyer_ref ?? BUYER_REF)}`)

    case 'get_audit_log': {
      const led = await call(`/api/agent-commerce/ledger/${encodeURIComponent(SESSION)}`)
      return {
        status: 'ok',
        session_id: led.session_id,
        budget: led.budget,
        actions: (led.actions ?? []).map(a => ({
          at: a.created_at, action: a.action_type, decision: a.decision,
          product: a.product_name, amount: a.amount, reason: a.reason,
        })),
      }
    }

    default:
      return { status: 'error', reason: `unknown tool: ${name}` }
  }
}

// ── Server ───────────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'haat', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args = {} } = request.params
  try {
    const result = await dispatch(name, args)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  } catch (err) {
    // Reaching haat failed — a genuine error, distinct from haat refusing.
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'error',
          reason: err.message,
          hint: `Could not reach haat at ${HAAT_URL}. Is it running, and is HAAT_URL correct?`,
        }, null, 2),
      }],
      isError: true,
    }
  }
})

// ── Boot ─────────────────────────────────────────────────────────────────────
// A reachability check up front turns "the tool mysteriously fails" into one
// clear line at startup.
try {
  const m = await call('/api/agent-commerce/manifest')
  console.error(
    `[haat-mcp] connected to ${HAAT_URL} — razorpay ${m.payment_provider?.mode}, ` +
    `caps ${m.limits?.per_transaction}/txn · ${m.limits?.per_session}/session`,
  )
  if (m.auth?.required && !API_KEY) {
    console.error('[haat-mcp] WARNING: this haat requires an API key. Set HAAT_API_KEY or every call will 401.')
  }
} catch (err) {
  console.error(`[haat-mcp] WARNING: cannot reach haat at ${HAAT_URL} (${err.message}). Tools will error until it is up.`)
}

await server.connect(new StdioServerTransport())

// stdout is the MCP channel; anything written there corrupts the protocol.
console.error(`[haat-mcp] ready — session ${SESSION}, buyer ${BUYER_REF}, ${TOOLS.length} tools`)
