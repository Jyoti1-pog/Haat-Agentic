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
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), service: 'haat-backend' })
})

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.message)
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' })
})

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`\n🚀  haat backend running at http://localhost:${PORT}`)
  console.log(`    Health: http://localhost:${PORT}/api/health\n`)
})
