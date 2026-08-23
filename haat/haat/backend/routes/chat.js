import { Router } from 'express'
import { runConversation } from '../services/conversationAgent.js'
import { optionalAuth }    from '../middleware/authMiddleware.js'

const router = Router()
router.use(optionalAuth)

// ── In-memory session store ────────────────────────────────────────────────────
// Sessions are ephemeral by design — chat context lives for the browser session.
// Using a Map keeps the backend stateless-friendly and removes the native SQLite dep.
const sessions = new Map()

function getOrCreateSession(id) {
  if (!sessions.has(id)) {
    const now = Date.now()
    sessions.set(id, {
      id,
      userId:       null,
      history:      [],
      lastQuery:    null,
      lastProducts: null,
      lastSource:   null,
      cart:         [],
      createdAt:    now,
      updatedAt:    now,
    })
  }
  return sessions.get(id)
}

// Evict sessions older than 24 hours — runs every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  let evicted = 0
  for (const [id, s] of sessions) {
    if (s.updatedAt < cutoff) { sessions.delete(id); evicted++ }
  }
  if (evicted > 0) console.log(`[Chat] Evicted ${evicted} stale sessions`)
}, 30 * 60 * 1000)

// ── POST /api/chat ─────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { message, sessionId } = req.body ?? {}

    if (!message?.trim()) return res.status(400).json({ error: '"message" is required' })

    const sid     = sessionId?.trim() || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const session = getOrCreateSession(sid)
    const user    = req.user ?? null

    console.log(`[Chat] Session ${sid} | User: ${user?.name ?? 'guest'} | Turn ${Math.floor(session.history.length / 2) + 1} | "${message.slice(0, 60)}"`)

    if (user && !session.userId) session.userId = user.id

    const result = await runConversation(message.trim(), session, user)

    session.updatedAt = Date.now()

    res.json({
      sessionId:   sid,
      message:     result.message,
      products:    result.products    ?? null,
      suggestions: result.suggestions ?? [],
      source:      result.source      ?? null,
      cart:        result.cart        ?? null,
      turnCount:   Math.floor(session.history.length / 2),
      user:        user ? { id: user.id, name: user.name, onboarded: user.onboarded } : null,
    })
  } catch (err) {
    console.error('[Chat] Unhandled error:', err.message)
    next(err)
  }
})

// ── GET /api/chat/:sessionId ───────────────────────────────────────────────────
router.get('/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })

  res.json({
    sessionId:    session.id,
    lastQuery:    session.lastQuery,
    lastProducts: session.lastProducts,
    source:       session.lastSource,
    turnCount:    Math.floor(session.history.length / 2),
    createdAt:    session.createdAt,
  })
})

// ── GET /api/chat/:sessionId/history ──────────────────────────────────────────
router.get('/:sessionId/history', (req, res) => {
  const session = sessions.get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })

  const visible = []
  for (const msg of session.history) {
    if (msg.role === 'user') {
      const content = Array.isArray(msg.content)
        ? msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
        : msg.content
      if (content) visible.push({ role: 'user', content })
    } else if (msg.role === 'assistant') {
      const content = Array.isArray(msg.content)
        ? msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
        : msg.content
      if (content) visible.push({ role: 'assistant', content })
    }
  }

  res.json({ sessionId: session.id, messages: visible })
})

// ── DELETE /api/chat/:sessionId ────────────────────────────────────────────────
router.delete('/:sessionId', (req, res) => {
  const existed = sessions.has(req.params.sessionId)
  sessions.delete(req.params.sessionId)
  res.json({ ok: true, existed })
})

export default router
