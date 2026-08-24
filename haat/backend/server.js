import 'dotenv/config'   // ← must be first: loads .env before any service module runs
import express      from 'express'
import cors         from 'cors'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join }  from 'path'

import searchRouter from './routes/search.js'
import voiceRouter  from './routes/voice.js'
import cartRouter   from './routes/cart.js'
import agentRouter  from './routes/agent.js'
import chatRouter   from './routes/chat.js'
import authRouter   from './routes/auth.js'
import agentCommerceRouter, { digitalRouter, shopRouter } from './routes/agentCommerce.js'
import sellerProductsRouter from './routes/sellerProducts.js'
import * as store from './services/agentStore.js'
import * as storage from './services/storage.js'
import * as llm from './services/llm.js'
import * as razorpay from './services/razorpay.js'
import { describe as describeAuth } from './middleware/agentAuth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()

// ── Middleware ─────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]
// The agent-facing commerce surface is deliberately open: an API that only our
// own frontend can call is not something a third-party AI buyer can transact
// against. It carries no cookies and no session auth, so there is nothing for a
// cross-origin caller to ride on.
app.use(['/api/agent-commerce', '/api/digital', '/api/seller', '/api/shop'], cors({ origin: '*' }))
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))

// `verify` keeps the raw bytes around for the Razorpay webhook, whose signature
// is computed over the exact body — a re-serialised object will not match.
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => { req.rawBody = buf },
}))

// ── State ──────────────────────────────────────────────────────────────────
// Load the store before the handler runs and write it back before the response
// leaves. On a long-lived server the load is a no-op after boot; on serverless
// it is the only reason a three-request purchase can complete at all, because
// the instance handling confirm_payment never saw create_order.
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api')) return next()

  // Reads need current state but change nothing, so they never queue.
  if (req.method === 'GET' || req.method === 'OPTIONS') {
    await store.hydrate()
    return next()
  }

  // Writes hold a lock across the whole cycle — hydrate, handle, persist.
  // Without it two instances both read the same state, both mutate their own
  // copy, and the second write erases the first. Measured: eight concurrent
  // purchases across two instances landed as five.
  let release
  try {
    release = await storage.acquireLock()
  } catch (err) {
    // Busy rather than broken: a 503 with Retry-After is something an agent
    // client knows how to handle, and it keeps the audit trail honest.
    res.set('Retry-After', '1')
    return res.status(503).json({ status: 'busy', reason: err.message, retryable: true })
  }
  let flushed = false
  const flush = async () => {
    if (flushed) return
    flushed = true
    // The lock covers only the shared-state write. Audit rows and blobs append
    // to their own keys, where a concurrent writer cannot clobber them, so they
    // are flushed after the lock is released — over a network store that was
    // most of the hold time, and every millisecond held is time another agent
    // spends queued.
    try { await store.persistState() } catch { /* logged in persist */ }
    finally { await release() }
    try { await store.persistAppends() } catch { /* logged in persist */ }
  }

  // Persist BEFORE the response goes out, not after.
  //
  // Writing on 'finish' means the client is told "delivered" while the write is
  // still in flight — so an agent that buys something and immediately asks for
  // its budget reads the state from before its own purchase. That is invisible
  // locally, where the write lands in microseconds, and reproducible against a
  // real deployment where the store is a network hop away. It was caught by the
  // guardrail suite run against production: a budget check returned the value
  // from one purchase earlier.
  //
  // Durable-then-acknowledged is also just the correct order: nothing should be
  // reported as done before it is stored.
  for (const method of ['json', 'send']) {
    const original = res[method].bind(res)
    res[method] = body => {
      flush().finally(() => original(body))
      return res
    }
  }

  // Safety net: a handler that streams, redirects, or dies without calling
  // json/send still has to release the lock.
  res.on('close', () => { flush().catch(() => {}) })

  await store.hydrate()
  next()
})

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api',         searchRouter)   // POST /api/search  +  GET /api/products/:id
app.use('/api/voice',   voiceRouter)    // /api/voice/transcribe | /speak | /voices
app.use('/api/cart',    cartRouter)     // /api/cart/*
app.use('/api/agent',   agentRouter)   // POST /api/agent/shop
app.use('/api/chat',    chatRouter)    // POST /api/chat  (agentic conversation)
app.use('/api/auth',    authRouter)   // POST /api/auth/register|login  GET /api/auth/me

// Agentic commerce — digital products
app.use('/api/agent-commerce', agentCommerceRouter) // tools, ledger, webhook, agent run
app.use('/api/digital',        digitalRouter)       // storefront listing, covers, signed downloads
app.use('/api/shop',           shopRouter)          // human checkout: orders, payment, library
app.use('/api/seller',         sellerProductsRouter) // seller product listing

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const store_ = await storage.ping()
  res.status(store_.ok ? 200 : 503).json({
    ok: store_.ok,
    service: 'haat-backend',
    timestamp: new Date().toISOString(),
    store: store_,
    ai_buyer: llm.describe(),
    agent_auth: describeAuth(),
    payments: { provider: 'razorpay', mode: razorpay.mode(), credentials: razorpay.credentialCheck() },
  })
})

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.message)
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' })
})

// ── Start ──────────────────────────────────────────────────────────────────
// Under Vercel the platform invokes the exported app; there is nothing to listen
// on, and calling listen() would be wrong. Locally we bind a port as usual.
storage.warnIfMisconfigured()

if (!process.env.VERCEL) {
  const PORT = process.env.PORT ?? 3001
  await store.hydrate()
  app.listen(PORT, () => {
    console.log(`\n  haat backend running at http://localhost:${PORT}`)
    console.log(`    store:    ${storage.describe()}`)
    console.log(`    ai buyer: ${llm.describe()}`)
    console.log(`    health:   http://localhost:${PORT}/api/health\n`)
  })
}

export default app
