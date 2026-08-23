/**
 * agentPlanner.js — the AI buyer
 *
 * A model, handed the commerce tools and a budget, deciding what to buy. This
 * is the only place in the agent surface where a model is in the loop, and the
 * split is deliberate:
 *
 *   the model decides   — what to search for, which product fits the request,
 *                         whether an over-cap item is worth asking a human about
 *   the model cannot    — whether any of it is allowed
 *
 * The clearest expression of that line is which tools it is given.
 * `confirm_purchase_approval` is NOT among them. An agent that could call the
 * approval tool would be approving its own spending, and the gate would be
 * decoration. Approval arrives from outside: a person clicks it in the ledger
 * UI, or an operator hits the REST endpoint. Then the agent is resumed.
 *
 * Which model does the reasoning is not this file's business — services/llm.js
 * runs OpenAI or Anthropic behind one interface, chosen by whichever key is set.
 */

import * as commerce from '../services/commerce.js'
import { getConversation, saveConversation, logAction } from './agentStore.js'
import * as llm from './llm.js'

// ── Tool contracts ───────────────────────────────────────────────────────────
// Plain JSON Schema, translated per provider at the boundary. Same contracts the
// MCP server publishes, so an agent sees one surface however it connects.
const TOOLS = [
  {
    name: 'search_digital_products',
    description:
      'Search haat for digital products open to AI-buyer checkout. Returns price in INR, the seller ' +
      'and whether haat has verified them, licence terms and remaining stock. Start here — you ' +
      'cannot buy anything you have not found through this tool.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the buyer wants, in plain words. Empty string lists everything.' },
        max_price_inr: { type: ['number', 'null'], description: 'Optional ceiling in rupees.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_product',
    description: 'Full detail on one product: licence terms, file size, origin, stock. Never returns the deliverable itself.',
    parameters: {
      type: 'object',
      properties: { product_id: { type: 'string' } },
      required: ['product_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_budget',
    description: 'The spending limits you are operating under and how much of the session budget is left.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'create_order',
    description:
      'Create a payable Razorpay order for one product. Checked against the spend caps, the seller ' +
      'verification rule and stock before anything is created. May come back "blocked" or ' +
      '"pending_approval" — those are answers, not errors. Does NOT move money.',
    parameters: {
      type: 'object',
      properties: { product_id: { type: 'string' } },
      required: ['product_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'authorise_test_payment',
    description:
      'Stands in for the card step, which happens in a browser you do not have. Returns a payment id ' +
      'and signature to hand to confirm_payment. Use outcome "captured" unless demonstrating a decline.',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string' },
        outcome: { type: 'string', enum: ['captured', 'failed'] },
      },
      required: ['order_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'confirm_payment',
    description:
      'Verify the payment signature server-side and, if it holds, mark the order paid and deliver. ' +
      'Returns the download link or licence key. This is the step that actually spends budget.',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string' },
        razorpay_payment_id: { type: 'string' },
        razorpay_signature: { type: 'string' },
      },
      required: ['order_id', 'razorpay_payment_id', 'razorpay_signature'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_order_status',
    description: 'Current status of an order, plus the deliverable if it has been delivered.',
    parameters: {
      type: 'object',
      properties: { order_id: { type: 'string' } },
      required: ['order_id'],
      additionalProperties: false,
    },
  },
]

const system = () => `You are an AI buying agent operating inside haat, a marketplace for digital goods made by Indian craftspeople — pattern packs, brushes, typefaces, field recordings, courses. You are shopping on behalf of a person, using their money.

You act. You do not present a shortlist and wait to be told which one.

If the person says buy, buy: search, weigh the results yourself, pick the best fit for what they asked, and carry the purchase through to delivery before you reply. Coming back with "here are four options, which would you like?" is a failure — they asked you to do this so they would not have to choose.

How you work:
- Search first. You can only buy what search_digital_products returns.
- Read the results before choosing. Price, licence terms and remaining stock all matter; a single-seat licence key is not the same purchase as a royalty-free pattern pack. Prefer a verified seller, a sensible price against what was asked, and a licence that fits the use.
- To buy: create_order, then authorise_test_payment, then confirm_payment. All three, in that order, for each item. A created order is not a purchase; only confirm_payment delivers.
- Then report: what you bought, why that one, what it cost, and what was delivered.

You are NOT the authority on what is permitted.

haat enforces spending limits, seller-verification rules and stock checks on its own side, and it does not tell you all of them. You cannot work out from a price whether a purchase will be allowed, and you must never try. The only way to find out is to call create_order and read what comes back.

So: whenever the person asks for something, call create_order for it. Always. Even if you suspect it is too expensive, even if you think it will be refused. Announcing that something "exceeds the cap" without having attempted it is wrong twice over — you do not know that, and refusing without attempting leaves no record in the audit ledger, which is the whole point of the system.

create_order answers in one of four ways:
- "created" — proceed to authorise_test_payment and confirm_payment.
- "blocked" — a hard rule refused it. Do not retry and do not work around it. Say what was refused and why, then pick something else or stop.
- "pending_approval" — it needs one explicit human approval. You cannot approve this yourself; you have no tool for it, by design. Stop calling tools. Tell the person exactly what you want to buy, what it costs, why it is worth it, and what reason came back. Then end your turn and wait. If they approve, you will be resumed and can call create_order again.
- "already_entitled" — they own it. Nothing to buy; tell them so.

If you want to know your remaining budget, call get_budget. Do not guess it.

Never claim something was purchased or delivered unless a confirm_payment call actually returned it. If you were blocked, say you were blocked.

Reproduce any download link or licence key exactly as the tool returned it. Never rewrite, shorten, or prefix a URL.

Write plainly and briefly — two or three short paragraphs of prose, as a careful assistant reporting back on something already done. Do not use bullet lists, numbered lists, or markdown headings. Do not use bold. No exclamation marks.`

// ── Tool dispatch ────────────────────────────────────────────────────────────
async function execute(name, input, ctx) {
  const { agent_session_id, buyer_ref } = ctx
  switch (name) {
    case 'search_digital_products':
      return commerce.searchDigitalProducts({
        query: input.query ?? '',
        max_price_inr: input.max_price_inr ?? null,
        agent_session_id,
      })
    case 'get_product':
      return commerce.getProductDetail({ product_id: input.product_id, agent_session_id })
    case 'get_budget':
      return commerce.getBudget({ agent_session_id })
    case 'create_order':
      return commerce.createOrder({ product_id: input.product_id, buyer_ref, agent_session_id })
    case 'authorise_test_payment':
      return commerce.authoriseTestPayment({
        order_id: input.order_id, outcome: input.outcome ?? 'captured', agent_session_id,
      })
    case 'confirm_payment':
      return commerce.confirmPayment({
        order_id: input.order_id,
        razorpay_payment_id: input.razorpay_payment_id,
        razorpay_signature: input.razorpay_signature,
        agent_session_id,
      })
    case 'get_order_status':
      return commerce.getOrderStatus({ order_id: input.order_id })
    default:
      return { status: 'error', reason: `unknown tool: ${name}` }
  }
}

// ── The loop ─────────────────────────────────────────────────────────────────
export async function runAgent({ prompt, agent_session_id, buyer_ref }) {
  if (!llm.isConfigured()) {
    logAction({
      agent_session_id, action_type: 'agent_error', decision: 'blocked',
      reason: 'No LLM key set (OPENAI_API_KEY or ANTHROPIC_API_KEY) — the AI buyer cannot run. The scripted demo still works.',
    })
    return {
      status: 'unavailable',
      reply: 'The AI buyer needs OPENAI_API_KEY or ANTHROPIC_API_KEY set on the backend. Everything else — the tools, the guardrails, the ledger — still runs; use the scripted demo to drive them.',
      tool_calls: [],
    }
  }

  // A stored conversation is only replayable on the provider that produced it;
  // the message shapes differ. Switching providers starts a fresh conversation
  // rather than feeding one dialect to the other.
  const stored = getConversation(agent_session_id)
  const history = stored?.provider === llm.provider() ? (stored.messages ?? []) : []

  logAction({
    agent_session_id, action_type: 'agent_prompt', decision: 'allowed',
    actor: 'human', reason: `buyer instruction: "${prompt}"`,
    meta: { model: llm.describe() },
  })

  let pendingApproval = null

  try {
    const run = await llm.runToolLoop({
      system: system(),
      history,
      input: prompt,
      tools: TOOLS,
      execute: (name, args) => execute(name, args, { agent_session_id, buyer_ref }),
      onToolCall: (name, args, result) => {
        if (result?.status === 'pending_approval') {
          pendingApproval = { product_id: args.product_id, product: result.product, reason: result.reason }
        }
      },
    })

    saveConversation(agent_session_id, { provider: run.provider, messages: run.messages })

    logAction({
      agent_session_id, action_type: 'agent_reply', decision: 'allowed',
      reason: run.reply ? truncate(run.reply) : 'agent finished without a closing message',
      meta: { model: `${run.provider} · ${run.model}`, tool_calls: run.toolCalls.length },
    })

    return {
      status: pendingApproval ? 'awaiting_approval' : 'ok',
      reply: run.reply,
      tool_calls: run.toolCalls,
      pending_approval: pendingApproval,
      model: `${run.provider} · ${run.model}`,
      budget: commerce.budgetSnapshot(agent_session_id),
    }
  } catch (err) {
    logAction({
      agent_session_id, action_type: 'agent_error', decision: 'blocked',
      reason: `agent run failed: ${err.message}`,
    })
    return {
      status: 'error',
      reply: `The agent stopped: ${err.message}`,
      tool_calls: [],
      budget: commerce.budgetSnapshot(agent_session_id),
    }
  }
}

const truncate = (s, n = 240) => (s.length > n ? `${s.slice(0, n)}…` : s)
