# Deploying haat

Goal: a live URL that multiple AI agents can transact against at once, through
`haat-mcp`.

The repo is ready for this. Two steps need your accounts and cannot be done for
you: logging into Vercel, and provisioning a Redis. Both take about a minute.

---

## Why a Redis is not optional

A purchase is **three separate HTTP requests** — `create_order`,
`authorise_payment`, `confirm_payment`. On Vercel each one may be handled by a
different instance, with its own memory and its own read-only filesystem.

Without shared state, the instance handling `confirm_payment` has never heard of
the order and answers *"no such order"*. Every purchase, every agent, every time.

So the store is pluggable ([`backend/services/storage.js`](backend/services/storage.js)):
a JSON file locally, Upstash Redis in production. Upstash specifically because it
speaks HTTP rather than a pooled TCP connection, which is what makes it work from
a serverless function.

The app refuses to pretend otherwise — boot it serverless without Redis and it
logs a loud warning rather than failing silently later.

---

## 1. Provision Redis

**Through Vercel** (simplest — it sets the variables for you):

Vercel dashboard → your project → **Storage** → **Marketplace** → Upstash →
create a Redis database. Vercel injects `KV_REST_API_URL` and
`KV_REST_API_TOKEN`, both of which the storage layer reads.

**Or directly:** create a free database at [upstash.com](https://upstash.com),
then copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from its
**REST API** panel.

---

## 2. Deploy

```bash
npx vercel login
npx vercel --prod
```

[`vercel.json`](vercel.json) already handles the rest: it builds the frontend to
`frontend/dist`, serves the whole Express app from `api/index.js` as one
function, rewrites `/api/*` to it, and sends everything else to the SPA.

---

## 3. Environment variables

Vercel dashboard → **Settings** → **Environment Variables**. Set for
**Production**, then redeploy.

| Variable | Required | Notes |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | **Yes** | Or `KV_REST_API_URL` from the Vercel integration |
| `UPSTASH_REDIS_REST_TOKEN` | **Yes** | Or `KV_REST_API_TOKEN` |
| `DIGITAL_SIGNING_SECRET` | **Yes** | See below — this one bites |
| `PUBLIC_BASE_URL` | Recommended | `https://your-app.vercel.app`. Makes download links absolute for anyone reading them outside the site |
| `OPENAI_API_KEY` | Optional | The natural-language buyer. `ANTHROPIC_API_KEY` works too |
| `RAZORPAY_KEY_ID` / `_SECRET` | Optional | Without them, orders are minted locally and stamped `unconfigured` |
| `HAAT_API_KEYS` | Strongly advised | `key:label` pairs, comma separated. See below |
| `AGENT_TXN_CAP_PAISE` / `AGENT_SESSION_CAP_PAISE` | Optional | Defaults ₹2,000 / ₹7,000 |

### Give each agent its own key

```
HAAT_API_KEYS=sk_live_abc:claude-desktop,sk_live_def:acme-procurement
```

Without keys the surface is open and a session id is just a string the caller
sends — so nothing stops one agent passing another's session id and spending its
remaining budget, or reading its ledger.

With keys set, every agent request carries one and **the session is namespaced to
a fingerprint of that key**. Two agents that both pick `session-1` get two
genuinely separate sessions. An agent cannot reach another's session even by
guessing, because it cannot produce the other's fingerprint without the key.

`/api/agent-commerce/manifest` stays public on purpose — an agent arriving cold
has to be able to read that a key is required before it can know to send one.

### `DIGITAL_SIGNING_SECRET` is not optional in production

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

It signs download links **and**, when Razorpay keys are absent, the stand-in
payment signatures. Without it each instance invents its own — so a payment
signed by one instance fails verification on another, and a download link signed
by one 403s on the next.

This is the exact bug a two-instance test caught before deploy: state crossed
instances correctly, but every payment failed because the secret did not.

---

## 4. Check it is actually live

```bash
curl https://your-app.vercel.app/api/health
```

```json
{ "ok": true, "store": { "ok": true, "driver": "redis (xxx.upstash.io)" } }
```

`ok: false` or `"driver": "file"` means Redis is not wired up. Fix that before
anything else — everything downstream depends on it.

Then prove a purchase survives across instances, which is the thing that was
broken:

```bash
BASE=https://your-app.vercel.app
cd backend && npm run demo:agent -- --base $BASE
```

Thirteen checks, no browser, no keys needed. It exercises a clean purchase, an
unverified seller refused, the cap gated then approved then completed, a declined
card, the session ceiling, and duplicate-licence protection. Non-zero exit on any
failure.

---

## 5. Hand the MCP to agents

Publish it once:

```bash
cd mcp-server && npm publish
```

Then anyone points a client at your deployment:

```json
{
  "mcpServers": {
    "haat": {
      "command": "npx",
      "args": ["-y", "haat-mcp"],
      "env": {
        "HAAT_URL": "https://your-app.vercel.app",
        "HAAT_AGENT_SESSION": "their-unique-session-id",
        "HAAT_BUYER_REF": "them@example.com"
      }
    }
  }
}
```

Two things to get right per client, or agents will interfere with each other:

- **`HAAT_AGENT_SESSION` must be unique per client.** It is the spend budget.
  Two agents sharing one will drain each other's ₹7,000.
- **`HAAT_BUYER_REF` should be the person's email**, so purchases land in a
  library they can open at `/library`.

Not publishing to npm? A client can run it straight from a checkout:

```json
{ "command": "node", "args": ["/abs/path/to/haat/mcp-server/index.js"] }
```

---

## Known limits

**State is split by access pattern.** The hot key holds only what a decision
needs — orders, entitlements, sessions — and is read and written whole on each
write. Two things that would have made that untenable live elsewhere: uploaded
files get their own keys (a 2 MB deliverable was becoming 98% of the hot blob),
and the audit log appends rather than rewrites (RPUSH on Redis, JSONL locally),
so it can grow without bound and needs no lock. Per purchase the hot blob grew
by ~5 KB before this and ~1.6 KB after. At very large volumes the next step is
per-order keys rather than one document.

**Write throughput is serialised.** Mutating requests take a lock around the
read-modify-write cycle, because without it concurrent agents lose writes — two
instances both read the same state, both mutate a copy, and the second write
erases the first. Measured before the fix: eight concurrent purchases across two
instances landed as five, three agents charged with nothing recorded. Sixteen
concurrent agents now complete cleanly in under two seconds. Reads are never
locked. If write volume ever outgrows this, the fix is per-entity keys rather
than one global lock.

**Leaving `HAAT_API_KEYS` empty leaves the surface open.** Anyone who knows the
URL can transact within the caps. Set keys before real money.

**Seller uploads are not scanned.** Files go into the store as-is. Anything
public-facing should virus-scan them first.

**Cold starts.** The first request after idle takes a second or two while the
function boots and hydrates. Agents tolerate this; it is worth knowing before you
watch a demo and think something has hung.
