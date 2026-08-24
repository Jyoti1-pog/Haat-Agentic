/**
 * routes/mcp.js — haat as a remote MCP server
 *
 * The stdio server in mcp-server/ needs a host that can spawn a process. Hosted
 * clients cannot: Claude's custom connectors and ChatGPT's both connect to a URL
 * and speak MCP over HTTP. Pointing one of them at an `npx` config is not a
 * configuration mistake, it is asking for a transport that does not exist there.
 * This is that transport.
 *
 *   https://<deployment>/mcp            → shared session
 *   https://<deployment>/mcp/s/<token>  → a session of your own
 *
 * Stateless, because it runs on serverless. Each request builds its own Server
 * and transport and throws them away; nothing is held between invocations,
 * which is the only thing that works when consecutive calls land on different
 * instances. The MCP session id therefore cannot carry identity — the URL does,
 * which survives an instance change and needs no auth infrastructure.
 *
 * Tool calls re-enter haat through its own public REST surface rather than
 * reaching into the service layer. That costs one hop and buys exactness: the
 * hydrate/lock/persist middleware, the guardrails, the audit rows and the
 * idempotency all run precisely as they do for a REST agent, because they are
 * the same code path. An MCP buyer and a REST buyer cannot drift apart.
 */

import express from 'express'
import crypto from 'crypto'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { TOOLS, makeDispatch } from '../mcp/tools.js'

const router = express.Router()

const TIMEOUT = Number(process.env.HAAT_TIMEOUT_MS ?? 25_000)
const MAX_RETRIES = Number(process.env.HAAT_MAX_RETRIES ?? 4)
const RETRY_ON = new Set([429, 502, 503, 504])

// ── Where "haat" is, from inside haat ────────────────────────────────────────
/**
 * Derived from the request first, configuration second.
 *
 * A deployment knows its own hostname from the proxy headers on every request,
 * and that stays true on a preview URL, a branch URL and a custom domain without
 * anyone updating an env var. PUBLIC_BASE_URL is the override for when the
 * public name differs from what the proxy reports.
 */
function selfOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim()
  if (host) return `${proto}://${host}`

  const configured = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, '')
  if (configured) { try { new URL(configured); return configured } catch { /* fall through */ } }
  return `http://127.0.0.1:${process.env.PORT ?? 3001}`
}

/** Relative deliverable links mean nothing to an agent elsewhere. Give them an origin. */
function absolutise(value, origin) {
  if (typeof value === 'string') return value.startsWith('/api/') ? origin + value : value
  if (Array.isArray(value)) return value.map(v => absolutise(v, origin))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, absolutise(v, origin)]))
  }
  return value
}

function makeCall(origin, session) {
  const once = async (path, { method = 'GET', body } = {}) => {
    const apiKey = process.env.HAAT_API_KEY?.trim()
    const res = await fetch(`${origin}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: body ? JSON.stringify({ agent_session_id: session, ...body }) : undefined,
      signal: AbortSignal.timeout(TIMEOUT),
    })
    const json = await res.json().catch(() => ({}))
    if (res.status >= 500 && !RETRY_ON.has(res.status)) {
      throw new Error(json.error ?? `haat returned HTTP ${res.status}`)
    }
    return Object.assign(absolutise(json, origin), { __status: res.status })
  }

  // Writes are serialised, so a burst of agents can collide and get a retryable
  // 503. That is a transport concern; a language model should not have to reason
  // about it, so it is absorbed here and the call simply takes longer.
  return async (path, opts) => {
    let wait = 220
    for (let attempt = 0; ; attempt++) {
      const res = await once(path, opts)
      if (!RETRY_ON.has(res.__status) || attempt >= MAX_RETRIES) { delete res.__status; return res }
      await new Promise(r => setTimeout(r, wait + Math.random() * wait))
      wait = Math.min(wait * 2, 2000)
    }
  }
}

// ── Identity ─────────────────────────────────────────────────────────────────
/**
 * One connector is one agent with one budget.
 *
 * A token in the path gives a caller a session of their own without an account
 * or a login — and it survives the instance changes that make an in-memory MCP
 * session useless here. Bare /mcp still works so the thing is connectable in one
 * paste; it just shares a budget, which the docs say plainly and the token URL
 * exists to avoid.
 */
function identity(req) {
  const token = String(req.params.token ?? '').trim()
  const session = token
    ? `connector-${crypto.createHash('sha256').update(token).digest('hex').slice(0, 16)}`
    : 'connector-shared'

  const buyer = typeof req.query.buyer === 'string' ? req.query.buyer.trim() : ''
  return { session, buyerRef: buyer || session }
}

// ── Server ───────────────────────────────────────────────────────────────────
function buildServer({ session, buyerRef, call }) {
  const server = new Server({ name: 'haat', version: '1.0.0' }, { capabilities: { tools: {} } })
  const dispatch = makeDispatch({ call, session, buyerRef })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args = {} } = request.params
    try {
      const result = await dispatch(name, args)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (err) {
      // Reaching haat failed. That is distinct from haat refusing, which comes
      // back as an ordinary result with a reason — a refusal is an answer.
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', reason: err.message }, null, 2) }],
      }
    }
  })

  return server
}

// ── HTTP ─────────────────────────────────────────────────────────────────────
function cors(res) {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version',
    'Access-Control-Max-Age': '86400',
  })
}

async function handle(req, res) {
  cors(res)

  // Streamable HTTP asks the caller to accept both JSON and SSE, and the
  // transport 406s otherwise. Real clients are inconsistent about sending it,
  // and refusing one over a header it never sends helps nobody — this endpoint
  // only ever answers with JSON, so the header is normalised, not policed.
  req.headers.accept = 'application/json, text/event-stream'

  const { session, buyerRef } = identity(req)
  const origin = selfOrigin(req)

  const server = buildServer({ session, buyerRef, call: makeCall(origin, session) })
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,   // stateless: nothing survives the invocation
    enableJsonResponse: true,        // no long-lived SSE stream on serverless
  })

  res.on('close', () => {
    transport.close().catch(() => {})
    server.close().catch(() => {})
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    console.error('[mcp] request failed:', err.message)
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: err.message }, id: null })
    }
  }
}

router.options(['/', '/s/:token'], (_req, res) => { cors(res); res.status(204).end() })
router.post(['/', '/s/:token'], handle)

// Stateless means there is no stream to resume and no session to delete. Say so
// in JSON-RPC, which is what a client at this endpoint is equipped to read.
function notAllowed(_req, res) {
  cors(res)
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'This endpoint is stateless: use POST. There is no SSE stream to open.' },
    id: null,
  })
}
router.get(['/', '/s/:token'], notAllowed)
router.delete(['/', '/s/:token'], notAllowed)

export default router
