import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'

// Auth is handled entirely by Supabase on the frontend.
// This router only exposes lightweight helper endpoints the backend may need.

const router = Router()

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the authenticated user extracted from the Supabase JWT.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

export default router
