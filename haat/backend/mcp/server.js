#!/usr/bin/env node
/**
 * mcp/server.js — haat digital products, as MCP tools
 *
 * Speaks MCP over stdio, so any MCP client (Claude Desktop, Claude Code, a
 * custom host) can transact against haat directly. Each tool is a thin adapter
 * over services/commerce.js — the same functions the REST layer calls — so the
 * guardrails cannot be bypassed by coming in through this door instead.
 *
 * Run:  node mcp/server.js
 *
 * Claude Desktop / Claude Code config:
 *   {
 *     "mcpServers": {
 *       "haat": {
 *         "command": "node",
 *         "args": ["<abs path>/haat/backend/mcp/server.js"],
 *         "env": {
 *           "RAZORPAY_KEY_ID": "rzp_test_...",
 *           "RAZORPAY_KEY_SECRET": "...",
 *           "HAAT_AGENT_SESSION": "claude-desktop-1",
 *           "HAAT_BUYER_REF": "you@example.com"
 *         }
 *       }
 *     }
 *   }
 *
 * Note on what is deliberately absent: there is no confirm_purchase_approval
 * tool here. An agent that could approve its own over-cap spending would make
 * the approval gate meaningless. Approval comes from a human, through the
 * ledger UI or the REST endpoint — never through this server.
 */

import 'dotenv/config'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import * as commerce from '../services/commerce.js'
import { LIMITS, fmtBoth } from '../services/guardrails.js'
import { mode as razorpayMode } from '../services/razorpay.js'

// One MCP process is one agent session. Override per client so two clients
// don't share a spend budget.
const AGENT_SESSION = process.env.HAAT_AGENT_SESSION ?? `mcp-${process.pid}`
const BUYER_REF     = process.env.HAAT_BUYER_REF ?? AGENT_SESSION

const TOOLS = [
  {
    name: 'search_digital_products',
    description:
      'Search haat for digital products open to AI-buyer checkout. Returns price in INR, the seller ' +
      'and whether haat has verified them, licence terms, and remaining stock for licence keys. ' +
      'You can only buy products returned by this tool.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Plain-language description of what to look for. Omit or leave empty to list everything.' },
        max_price_inr: { type: 'number', description: 'Optional price ceiling in rupees.' },
      },
      required: [],
    },
  },
  {
    name: 'get_product',
    description: 'Full detail on one product — licence terms, origin, file size, stock, agent-checkout status. Never returns the deliverable itself.',
    inputSchema: {
      type: 'object',
      properties: { product_id: { type: 'string' } },
      required: ['product_id'],
    },
  },
  {
    name: 'get_budget',
    description: `The spending limits in force (per transaction ${fmtBoth(LIMITS.perTransactionPaise)}, per session ${fmtBoth(LIMITS.perSessionPaise)}) and how much of this session's budget remains.`,
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_order',
    description:
      'Create a payable Razorpay order for one product. Runs the spend caps, the seller-verification ' +
      'rule and the stock check first. May return status "blocked" (a hard refusal — do not retry) or ' +
      '"pending_approval" (needs a human to approve this item at this price before it can proceed). ' +
      'Creating an order does not move money.',
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
    name: 'authorise_test_payment',
    description:
      'Authorise payment on an order. Razorpay card capture normally happens in a browser you do not ' +
      'have, so this stands in for that step and returns a payment id and signature to pass to ' +
      'confirm_payment. Use outcome "captured" unless you are deliberately demonstrating a decline.',
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
      'Verify the payment signature server-side; if valid, mark the order paid and deliver the product. ' +
      'Returns a signed download link or an unlock code. This is the step that consumes session budget.',
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
    description: 'Status of an order, plus the deliverable if it has been delivered. Signed links are re-minted fresh on each call.',
    inputSchema: {
      type: 'object',
      properties: { order_id: { type: 'string' } },
      required: ['order_id'],
    },
  },
]

const server = new Server(
  { name: 'haat-agentic-commerce', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args = {} } = request.params
  const ctx = { agent_session_id: AGENT_SESSION }

  try {
    let result
    switch (name) {
      case 'search_digital_products':
        result = await commerce.searchDigitalProducts({
          query: args.query ?? '', max_price_inr: args.max_price_inr ?? null, ...ctx,
        })
        break
      case 'get_product':
        result = await commerce.getProductDetail({ product_id: args.product_id, ...ctx })
        break
      case 'get_budget':
        result = await commerce.getBudget(ctx)
        break
      case 'create_order':
        result = await commerce.createOrder({
          product_id: args.product_id, buyer_ref: args.buyer_ref ?? BUYER_REF, ...ctx,
        })
        break
      case 'authorise_test_payment':
        result = await commerce.authoriseTestPayment({
          order_id: args.order_id, outcome: args.outcome ?? 'captured', ...ctx,
        })
        break
      case 'confirm_payment':
        result = await commerce.confirmPayment({
          order_id: args.order_id,
          razorpay_payment_id: args.razorpay_payment_id,
          razorpay_signature: args.razorpay_signature,
          ...ctx,
        })
        break
      case 'get_order_status':
        result = await commerce.getOrderStatus({ order_id: args.order_id })
        break
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        }
    }

    // A refusal is a real answer and must not be flagged as a transport error —
    // the model needs to read the reason, not a failure.
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ status: 'error', reason: err.message }, null, 2) }],
      isError: true,
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)

// stdout is the MCP channel; anything logged there corrupts the protocol.
console.error(
  `[haat-mcp] ready — session ${AGENT_SESSION}, buyer ${BUYER_REF}, razorpay ${razorpayMode()}, ` +
  `caps ${fmtBoth(LIMITS.perTransactionPaise)}/txn · ${fmtBoth(LIMITS.perSessionPaise)}/session`,
)
