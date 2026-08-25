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

/**
 * A GET here is almost always a person, not a client.
 *
 * Pasting the URL into the address bar is the obvious way to check whether a
 * server is up, and answering that with a JSON-RPC error tells someone who is
 * not an MCP client that they have broken something, when in fact they have
 * confirmed it works. So a browser gets a page that says what this is and what
 * to do with it. Anything not asking for HTML still gets the JSON-RPC 405,
 * because that is what a real client is equipped to read.
 */
router.get(['/', '/s/:token'], (req, res) => {
  if (!String(req.headers.accept ?? '').includes('text/html')) return notAllowed(req, res)

  cors(res)
  const { session } = identity(req)
  const origin = selfOrigin(req)
  const token = String(req.params.token ?? '').trim()
  const url = token ? `${origin}/mcp/s/${token}` : `${origin}/mcp`
  const shared = !token

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  res.status(200).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>haat · MCP endpoint</title>
<style>
  :root { color-scheme: dark }
  * { box-sizing: border-box }
  body { margin:0; background:#0F0D0A; color:#EDE6D8; font:400 16px/1.65 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif; padding:6vh 5vw }
  main { max-width: 60ch; margin: 0 auto }
  h1 { font-size: clamp(30px,6vw,44px); font-weight:400; letter-spacing:-.02em; margin:0 0 6px }
  .ok { display:inline-flex; align-items:center; gap:8px; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#8FA97E; margin-bottom:22px }
  .ok::before { content:''; width:7px; height:7px; border-radius:50%; background:#8FA97E }
  p { color:#A79E8E; margin:0 0 16px }
  code, .url { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13.5px }
  .url { display:block; padding:14px 16px; border:1px solid #2A251E; background:#151109; color:#B8935A; word-break:break-all; margin:0 0 8px }
  h2 { font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:#EDE6D8; font-weight:400; margin:34px 0 12px }
  ol { color:#A79E8E; padding-left:20px; margin:0 0 16px } li { margin-bottom:8px }
  .warn { border-left:2px solid #B8935A; padding:2px 0 2px 16px; margin:0 0 16px }
  a { color:#B8935A }
  hr { border:0; border-top:1px solid #2A251E; margin:34px 0 18px }
  .foot { font-size:13px; color:#6E675C }
</style></head><body><main>
  <h1>haat</h1>
  <div class="ok">MCP endpoint live</div>

  <p>This URL is for an AI client to connect to, not for a browser to open — you are
  seeing this page because you opened it in one. It working is what you just confirmed.</p>

  <h2>Your connector URL</h2>
  <div class="url">${esc(url)}</div>
  ${shared
    ? `<p class="warn">This is the <strong>shared</strong> endpoint — every agent using it draws on
       one spend budget. For a budget of your own, put any word you like on the end:
       <code>${esc(origin)}/mcp/s/my-agent</code></p>`
    : `<p class="warn">Session <code>${esc(session)}</code> — this token gives you a spend budget
       that is yours alone. Keep using the same one and your budget and history persist.</p>`}

  <h2>Connecting Claude</h2>
  <ol>
    <li>Open <strong>Settings → Connectors</strong> — in the Claude app or on claude.ai.</li>
    <li>Choose <strong>Add custom connector</strong>.</li>
    <li>Paste the URL above. Nothing to install, no key, no account.</li>
  </ol>
  <p>Pasting the URL into a chat message will not work — Claude cannot add a connector
  to itself from a conversation. It has to be added in Settings.</p>

  <hr>
  <p class="foot">9 tools · search, order, pay, deliver · every purchase bounded by spend
  caps and written to an audit trail.<br>
  <a href="${esc(origin)}/docs">Full documentation</a> ·
  <a href="${esc(origin)}/catalogue">Browse as a person</a></p>
</main></body></html>`)
})

router.delete(['/', '/s/:token'], notAllowed)

export default router
