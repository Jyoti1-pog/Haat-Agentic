/**
 * mcp/tools.js — the haat tool surface, defined once
 *
 * Both MCP doors serve these: the stdio server an agent runs locally, and the
 * remote Streamable-HTTP endpoint at /mcp that a hosted client (Claude's custom
 * connectors, ChatGPT's, anything speaking MCP over HTTP) connects to without
 * installing anything.
 *
 * Dispatch is injected rather than hard-wired, because the two doors reach haat
 * differently — one over the public internet, one over its own origin — but must
 * behave identically. Neither holds business logic: every guardrail is enforced
 * by the REST layer underneath, so a modified client still cannot exceed a cap
 * or buy from an unverified seller.
 */

export const TOOLS = [
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
/**
 * Binds the tool surface to one transport and one agent session.
 *
 * `call(path, opts)` is the only thing that differs between the doors, and the
 * session is what keeps a budget attached to a particular agent across calls —
 * without it every request would start with a fresh allowance, which would make
 * the spend caps decorative.
 */
export function makeDispatch({ call, session, buyerRef }) {
  const q = encodeURIComponent

  return async function dispatch(name, args = {}) {
    switch (name) {
      case 'search_digital_products':
        return call('/api/agent-commerce/search', {
          method: 'POST',
          body: { query: args.query ?? '', max_price_inr: args.max_price_inr ?? null },
        })

      case 'get_product':
        return call(`/api/agent-commerce/products/${q(args.product_id)}?agent_session_id=${q(session)}`)

      case 'get_budget':
        return call(`/api/agent-commerce/budget/${q(session)}`)

      case 'create_order':
        return call('/api/agent-commerce/orders', {
          method: 'POST',
          body: { product_id: args.product_id, buyer_ref: args.buyer_ref ?? buyerRef },
        })

      case 'authorise_payment':
        return call(`/api/agent-commerce/orders/${q(args.order_id)}/authorise`, {
          method: 'POST',
          body: { outcome: args.outcome ?? 'captured' },
        })

      case 'confirm_payment':
        return call(`/api/agent-commerce/orders/${q(args.order_id)}/confirm`, {
          method: 'POST',
          body: {
            razorpay_payment_id: args.razorpay_payment_id,
            razorpay_signature: args.razorpay_signature,
          },
        })

      case 'get_order_status':
        return call(`/api/agent-commerce/orders/${q(args.order_id)}`)

      case 'get_library':
        return call(`/api/shop/library/${q(args.buyer_ref ?? buyerRef)}`)

      case 'get_audit_log': {
        const led = await call(`/api/agent-commerce/ledger/${q(session)}`)
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
}
