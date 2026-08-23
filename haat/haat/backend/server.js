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

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()

// ── Middleware ─────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
app.use(express.json({ limit: '10mb' }))

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api',         searchRouter)   // POST /api/search  +  GET /api/products/:id
app.use('/api/voice',   voiceRouter)    // /api/voice/transcribe | /speak | /voices
app.use('/api/cart',    cartRouter)     // /api/cart/*
app.use('/api/agent',   agentRouter)   // POST /api/agent/shop
app.use('/api/chat',    chatRouter)    // POST /api/chat  (agentic conversation)
app.use('/api/auth',    authRouter)   // POST /api/auth/register|login  GET /api/auth/me

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
