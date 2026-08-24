import crypto from 'crypto'

/**
 * agentAuth.js — who is this agent, and whose budget is it spending?
 *
 * A session id is just a string the caller sends. With one agent that is fine.
 * With several it is not: nothing stops agent B from passing agent A's session
 * id and spending A's remaining budget, or reading A's ledger. The isolation
 * that makes per-session caps meaningful has to be enforced, not assumed.
 *
 * So when API keys are configured, every agent request carries one, and the
 * session id is namespaced by a fingerprint of that key. Two agents that both
 * pick "session-1" get two genuinely separate sessions and cannot see or spend
 * each other's. An agent cannot reach another's session even by guessing,
 * because it cannot produce the other's fingerprint without the other's key.
 *
 * Configure with HAAT_API_KEYS as a comma-separated list. Entries may be a bare
 * key or `key:label`, where the label appears in the audit trail:
 *
 *   HAAT_API_KEYS=sk_live_abc:claude-desktop,sk_live_def:acme-procurement
 *
 * Leave it unset and the surface is open, which is the right default for local
 * development and for a demo anyone should be able to try. It is the wrong
 * default the moment real money is involved, and /api/health says which mode is
 * live so that is never a guess.
 */

function parseKeys() {
  const raw = process.env.HAAT_API_KEYS ?? ''
  const map = new Map()
  for (const entry of raw.split(',').map(s => s.trim()).filter(Boolean)) {
    const idx = entry.indexOf(':')
    if (idx === -1) map.set(entry, entry.slice(0, 8))
    else map.set(entry.slice(0, idx).trim(), entry.slice(idx + 1).trim())
  }
  return map
}

export const isEnforced = () => parseKeys().size > 0

export const describe = () => {
  const n = parseKeys().size
  return n ? `${n} key(s) required` : 'open (no HAAT_API_KEYS set)'
}

/** Short, stable, and reveals nothing about the key it came from. */
const fingerprint = key => crypto.createHash('sha256').update(key).digest('hex').slice(0, 12)

function bearer(req) {
  const h = req.headers.authorization ?? ''
  if (h.startsWith('Bearer ')) return h.slice(7).trim()
  return req.headers['x-haat-key']?.trim() ?? null
}

/**
 * Attaches `req.agent = { key, label, scope }`. `scope` is '' when keys are not
 * configured, so session ids pass through unchanged and nothing breaks for
 * anyone already using the open surface.
 */
export function agentAuth(req, res, next) {
  const keys = parseKeys()

  if (!keys.size) {
    req.agent = { key: null, label: 'anonymous', scope: '' }
    return next()
  }

  const token = bearer(req)
  if (!token || !keys.has(token)) {
    return res.status(401).json({
      status: 'unauthorized',
      reason: token
        ? 'That API key is not recognised.'
        : 'This haat requires an API key. Send it as "Authorization: Bearer <key>".',
      hint: 'An MCP client sets HAAT_API_KEY; a REST caller sets the Authorization header.',
    })
  }

  req.agent = { key: token, label: keys.get(token), scope: fingerprint(token) }
  next()
}

/**
 * The session id a request actually operates on.
 *
 * Namespacing here rather than trusting the caller is the whole point: the
 * client picks a name, the server decides which namespace it lands in.
 */
export function scopedSession(req, requested) {
  const id = requested || 'default'
  const scope = req.agent?.scope
  return scope ? `${scope}:${id}` : id
}
