/**
 * storage.js — where the runtime state actually lives
 *
 * haat holds a small amount of mutable state: orders, entitlements, the audit
 * trail, burned licence keys, seller listings. Locally that is a JSON file next
 * to the code, which is fine.
 *
 * It is not fine on a serverless host. Vercel gives each invocation its own
 * filesystem and its own memory, so an order created by one request does not
 * exist for the next — and a purchase is three requests. The flow would break
 * for every agent, every time.
 *
 * So the store is pluggable, chosen by what is configured:
 *
 *   redis   Upstash over its REST API. HTTP rather than a TCP connection, which
 *           is what makes it work from a serverless function with no pooling.
 *           Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 *   file    a JSON file on disk. The local default.
 *   memory  nothing persisted. Only sensible for tests.
 *
 * Everything is one key. The state is small and always read and written whole,
 * so splitting it buys nothing and costs consistency.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, statSync, unlinkSync, appendFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../data')
const FILE_PATH = join(DATA_DIR, 'agent-store.json')
const KEY = process.env.HAAT_STORE_KEY ?? 'haat:store:v1'

// Trimmed for the same reason PUBLIC_BASE_URL is: these are pasted by hand into
// a dashboard, and a stray space turns a working connection into an obscure fetch
// failure at the first write.
const env = name => process.env[name]?.trim() || undefined
const REDIS_URL = env('UPSTASH_REDIS_REST_URL') ?? env('KV_REST_API_URL')
const REDIS_TOKEN = env('UPSTASH_REDIS_REST_TOKEN') ?? env('KV_REST_API_TOKEN')

export function driver() {
  if (REDIS_URL && REDIS_TOKEN) return 'redis'
  if (process.env.HAAT_STORE === 'memory') return 'memory'
  return 'file'
}

export const describe = () =>
  driver() === 'redis' ? `redis (${new URL(REDIS_URL).host})` : driver()

/**
 * Serverless has no persistent local disk. Falling back to `file` there would
 * look like it worked and then silently lose every order, so say so loudly at
 * boot instead.
 */
export function warnIfMisconfigured() {
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  if (serverless && driver() !== 'redis') {
    console.error(
      '[storage] FATAL-ish: running serverless without Upstash Redis configured. ' +
      'State cannot survive between requests, so multi-step purchases will fail. ' +
      'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
    )
    return false
  }
  return true
}

// ── Redis over REST ──────────────────────────────────────────────────────────
async function redis(command) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text().catch(() => '')}`)
  const { result, error } = await res.json()
  if (error) throw new Error(`Upstash: ${error}`)
  return result
}

// ── Public API ───────────────────────────────────────────────────────────────
/** @returns {Promise<object|null>} the stored state, or null if there is none */
export async function load() {
  switch (driver()) {
    case 'redis': {
      const raw = await redis(['GET', KEY])
      return raw ? JSON.parse(raw) : null
    }
    case 'file': {
      if (!existsSync(FILE_PATH)) return null
      try { return JSON.parse(readFileSync(FILE_PATH, 'utf8')) } catch { return null }
    }
    default:
      return null
  }
}

export async function save(state) {
  switch (driver()) {
    case 'redis':
      await redis(['SET', KEY, JSON.stringify(state)])
      return
    case 'file': {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
      // Temp file then rename, so a crash mid-write cannot truncate the store.
      const tmp = `${FILE_PATH}.tmp`
      writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8')
      renameSync(tmp, FILE_PATH)
      return
    }
    default:
      return
  }
}

/** Used by the health endpoint to prove the store is actually reachable. */
export async function ping() {
  if (driver() !== 'redis') return { ok: true, driver: driver() }
  try {
    await redis(['PING'])
    return { ok: true, driver: describe() }
  } catch (err) {
    return { ok: false, driver: describe(), error: err.message }
  }
}

// ── Mutual exclusion ─────────────────────────────────────────────────────────
/**
 * The store is read whole and written whole. That is fine for one process, and
 * wrong the moment there are two: both hydrate the same state, both mutate their
 * own copy, and the second write erases the first. Measured on two instances,
 * eight concurrent purchases became five — three agents were charged and had
 * nothing recorded.
 *
 * So mutating requests take a lock around the whole read-modify-write cycle.
 * This serialises writes, which at marketplace-demo volume costs nothing and is
 * the difference between an audit trail that is true and one that is not.
 * Reads are never locked.
 *
 * Every lock carries a TTL, so a process that dies holding one cannot wedge the
 * system — the worst case is a short stall.
 */
const LOCK_KEY = `${KEY}:lock`
const LOCK_TTL_MS = Number(process.env.HAAT_LOCK_TTL_MS ?? 10_000)
const LOCK_WAIT_MS = Number(process.env.HAAT_LOCK_WAIT_MS ?? 8_000)

const sleep = ms => new Promise(r => setTimeout(r, ms))
const token = () => `${process.pid}-${Math.random().toString(36).slice(2)}`

/**
 * @returns {Promise<Function>} release — always call it, ideally in a finally.
 */
export async function acquireLock() {
  const mine = token()
  const deadline = Date.now() + LOCK_WAIT_MS
  let backoff = 12

  while (Date.now() < deadline) {
    if (await tryAcquire(mine)) {
      return async () => { await release(mine) }
    }
    await sleep(backoff + Math.random() * backoff)   // jitter, so racers separate
    backoff = Math.min(backoff * 2, 250)
  }

  // Waiting timed out. Proceeding without the lock is how writes get lost
  // silently, which is the exact failure this exists to prevent — so refuse
  // instead. A refused request is one the caller can retry; a lost write is
  // money taken with nothing recorded.
  const err = new Error('Could not acquire the store lock — the service is busy. Retry shortly.')
  err.status = 503
  err.retryable = true
  throw err
}

async function tryAcquire(mine) {
  switch (driver()) {
    case 'redis':
      // SET NX PX is atomic: exactly one caller can create the key.
      return (await redis(['SET', LOCK_KEY, mine, 'NX', 'PX', String(LOCK_TTL_MS)])) === 'OK'

    case 'file': {
      const path = `${FILE_PATH}.lock`
      try {
        // 'wx' fails if the file exists — the filesystem's own atomic test-and-set.
        const fd = openSync(path, 'wx')
        writeFileSync(fd, mine)
        closeSync(fd)
        return true
      } catch {
        // Break a lock left behind by a process that died.
        try {
          if (Date.now() - statSync(path).mtimeMs > LOCK_TTL_MS) unlinkSync(path)
        } catch { /* someone else cleaned it up first */ }
        return false
      }
    }

    default:
      return true
  }
}

async function release(mine) {
  switch (driver()) {
    case 'redis':
      // Only delete a lock we still own; ours may have expired and been retaken.
      await redis(['EVAL',
        'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
        '1', LOCK_KEY, mine,
      ]).catch(() => {})
      return

    case 'file': {
      const path = `${FILE_PATH}.lock`
      try {
        if (readFileSync(path, 'utf8') === mine) unlinkSync(path)
      } catch { /* already gone */ }
      return
    }

    default:
      return
  }
}

// ── Blobs ────────────────────────────────────────────────────────────────────
/**
 * Uploaded files live in their own keys, never in the hot state.
 *
 * They were in it. A 2 MB deliverable became 2.7 MB of base64 inside the single
 * blob that is read and written on every request — measured at 98% of the store.
 * Four uploads and writes would start failing outright on Upstash's request cap,
 * and long before that every request would be moving megabytes to change one
 * field.
 *
 * Now a file is fetched only when it is actually served.
 */
export async function putBlob(id, value) {
  const json = JSON.stringify(value)
  switch (driver()) {
    case 'redis':
      await redis(['SET', `${KEY}:blob:${id}`, json])
      return
    case 'file': {
      const dir = join(DATA_DIR, 'blobs')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, `${id}.json`), json, 'utf8')
      return
    }
    default:
      memoryBlobs.set(id, json)
  }
}

export async function getBlob(id) {
  switch (driver()) {
    case 'redis': {
      const raw = await redis(['GET', `${KEY}:blob:${id}`])
      return raw ? JSON.parse(raw) : null
    }
    case 'file': {
      const path = join(DATA_DIR, 'blobs', `${id}.json`)
      if (!existsSync(path)) return null
      try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
    }
    default: {
      const raw = memoryBlobs.get(id)
      return raw ? JSON.parse(raw) : null
    }
  }
}

const memoryBlobs = new Map()

// ── Audit log ────────────────────────────────────────────────────────────────
/**
 * Append-only, and kept out of the hot state for the same reason.
 *
 * Five audit rows per purchase at ~600 bytes each was most of the ~5 KB every
 * purchase added to a blob rewritten on every request. An audit trail is the one
 * thing here that must grow without bound, so it gets a structure that appends
 * instead of one that rewrites: RPUSH on Redis, a JSONL file locally. Neither
 * needs the write lock, because appending cannot lose a concurrent append.
 */
export async function appendActions(rows) {
  if (!rows.length) return
  switch (driver()) {
    case 'redis':
      await redis(['RPUSH', `${KEY}:actions`, ...rows.map(r => JSON.stringify(r))])
      return
    case 'file': {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
      appendFileSync(join(DATA_DIR, 'actions.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8')
      return
    }
    default:
      memoryActions.push(...rows)
  }
}

export async function readActions() {
  switch (driver()) {
    case 'redis': {
      const rows = await redis(['LRANGE', `${KEY}:actions`, '0', '-1'])
      return (rows ?? []).map(r => { try { return JSON.parse(r) } catch { return null } }).filter(Boolean)
    }
    case 'file': {
      const path = join(DATA_DIR, 'actions.jsonl')
      if (!existsSync(path)) return []
      return readFileSync(path, 'utf8').split('\n').filter(Boolean)
        .map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    }
    default:
      return [...memoryActions]
  }
}

export async function clearActions(predicate) {
  const kept = predicate ? (await readActions()).filter(a => !predicate(a)) : []
  switch (driver()) {
    case 'redis':
      await redis(['DEL', `${KEY}:actions`])
      if (kept.length) await appendActions(kept)
      return
    case 'file': {
      const path = join(DATA_DIR, 'actions.jsonl')
      writeFileSync(path, kept.map(r => JSON.stringify(r)).join('\n') + (kept.length ? '\n' : ''), 'utf8')
      return
    }
    default:
      memoryActions.length = 0
      memoryActions.push(...kept)
  }
}

const memoryActions = []
