import jwt from 'jsonwebtoken'

// Supabase signs all JWTs with SUPABASE_JWT_SECRET
// (Supabase dashboard → Project Settings → API → JWT Secret)
const secret = () => process.env.SUPABASE_JWT_SECRET || ''

// ── requireAuth — blocks unauthenticated requests ────────────────────────────
export function requireAuth(req, res, next) {
  const user = extractUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  req.user = user
  next()
}

// ── optionalAuth — attaches user if token present, continues either way ───────
export function optionalAuth(req, res, next) {
  req.user = extractUser(req) ?? null
  next()
}

// ── Internal: verify Supabase JWT, return normalised user or null ─────────────
function extractUser(req) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return null
    const token   = header.slice(7)
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] })

    // Supabase embeds user_metadata inside the JWT
    const meta = payload.user_metadata ?? {}

    return {
      id:        payload.sub,
      email:     payload.email ?? null,
      name:      meta.full_name ?? meta.name ?? null,
      avatar:    meta.avatar_url ?? null,
      onboarded: meta.onboarded ?? false,
      role:      payload.role ?? 'authenticated',
    }
  } catch {
    return null
  }
}
