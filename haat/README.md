# haat

**Digital goods made by Indian craftspeople — and a marketplace an AI agent can
actually buy from.**

Pattern packs from Madhubani painters. Brushes scanned off Sanganer printing
blocks. A Devanagari typeface drawn from woodblock proofs. Field recordings from
the Varanasi ghats at four in the morning. Nothing ships; everything arrives the
moment it is paid for.

haat has two front doors, and both are real:

- **A person** browses, checks out, and the file, licence key or access link
  lands in their library.
- **An AI agent** does the same thing on its own — over MCP or REST — with every
  money decision bounded, gated, and written into an audit trail as it happens.

Both doors run the same code. Payment verification, delivery and entitlements
are one implementation. Only the authorisation policy differs, because spend caps
are an agent's leash, not a shopper's.

---

## The one idea

> The agent decides **what** to buy. It does not decide **whether it may**.

Discovery and selection are the model's job — that is where judgement is worth
having. Every rule about whether money moves is a plain comparison against a
number or a boolean, running server-side, with no model anywhere near it:

| Rule | Outcome |
|---|---|
| Seller not haat-verified | Blocked, at any price |
| Seller did not open the SKU to agents | Blocked |
| Licence pool empty | Blocked — refuse rather than take money for something undeliverable |
| Over ₹2,000 in one transaction | **Gated** — needs one explicit human approval, scoped to that item at that price |
| Over ₹7,000 in a session | Blocked. No approval can lift it |
| Buyer already owns a single-seat licence | Returned, not charged for again |

The agent is not even told the caps. An earlier version put them in the system
prompt and the model started *self-policing* — shown a ₹4,999 item, it announced
the purchase would be refused and never attempted it, so no decision reached the
ledger. A guardrail an agent can talk itself into enforcing is one it can talk
itself out of. Now it must attempt, and the server rules.

---

## Quick start

```bash
npm run install:all
cp backend/.env.example backend/.env    # optional — see Configuration
npm run dev
```

| | |
|---|---|
| **http://localhost:3000** | The shop |
| **http://localhost:3000/agent-checkout** | The ledger — press *Run scripted demo* |
| **http://localhost:3001** | API |

It runs with **no keys at all**. Without Razorpay credentials the order flow
still works end to end — order ids are minted locally and every response and
audit row is stamped `unconfigured`, so nothing can be mistaken for a real
payment. The HMAC round-trip is still genuinely performed.

### Try it in this order

1. **Buy something.** Open a product → *Buy now* → any email → *Pay*. Real
   Razorpay order, server-verified signature, real delivery. It is in `/library`
   under that email and the download link works.
2. **Then open `/agent-checkout` and press Run scripted demo.** It buys a pattern
   pack, is refused on an unverified seller, has a card decline and retries,
   then stops dead at ₹4,999 and waits for you. Approve it and it finishes, then
   hits the session ceiling on the next attempt.

---

## What's in the box

| Route | |
|---|---|
| `/` · `/catalogue` · `/product/:id` | The shop — 16 products across eight kinds |
| `/cart` · `/checkout` · `/library` | Buying, and what you own |
| `/sell` · `/seller` | List a product; sales, revenue, agent-vs-person split |
| `/agent-checkout` | The live ledger — one agent session, written as it happens |
| `/ops` | Platform-wide activity: every session, every refusal, with reasons |

Three ways a product can be delivered, all instant: a **file** (haat signs a
48-hour URL per buyer), a **licence key** (popped from the seller's pool and
burned), or an **access link** (the seller hosts it; haat does not pretend to
expire something that is not its to expire).

---

## Connecting an agent

```json
{
  "mcpServers": {
    "haat": {
      "command": "npx",
      "args": ["-y", "haat-mcp"],
      "env": {
        "HAAT_URL": "https://your-haat-deployment.com",
        "HAAT_AGENT_SESSION": "claude-desktop-1",
        "HAAT_BUYER_REF": "you@example.com"
      }
    }
  }
}
```

Give each client its own `HAAT_AGENT_SESSION` or they share a spend budget, and
set `HAAT_BUYER_REF` to the person's email so purchases land in a library they
can actually open.

A purchase is three calls: `create_order` → `authorise_payment` →
`confirm_payment`. An order is not a purchase until the third returns.

**There is no approval tool.** An agent that could approve its own over-cap
spending would make the gate decoration. Approval comes from a person, through
the ledger UI or `POST /api/agent-commerce/approvals`.

Full details: [`mcp-server/README.md`](mcp-server/README.md). Everything is also
available over plain REST — `GET /api/agent-commerce/manifest` describes the
whole surface to an agent that arrives cold.

---

## Architecture

```
        a person                     an AI agent
            │                         │        │
            │                      MCP│        │REST
            ▼                         ▼        ▼
      /api/shop/*              /api/agent-commerce/*
            │                              │
            │                    guardrails.js  ← deterministic, no model
            │                              │
            └──────────┬───────────────────┘
                       ▼
                  commerce.js          one implementation
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   razorpay.js    delivery.js    agentStore.js
   orders +       signed URLs,   orders, entitlements,
   HMAC verify    key pools      audit trail
```

The ledger UI reads the server's audit trail rather than its own state, so it
renders the same feed whether an action came from the scripted demo, the AI
buyer, an MCP client in another process, or someone with `curl`. It cannot show
a decision the server did not make.

---

## Configuration

Everything is optional.

| Variable | If unset |
|---|---|
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | The natural-language buyer is unavailable; scripted demo still drives every guardrail |
| `RAZORPAY_KEY_ID` / `_SECRET` | Orders minted locally, stamped `unconfigured` |
| `DIGITAL_SIGNING_SECRET` | Download links work but do not survive a restart |
| `PUBLIC_BASE_URL` | Links come back relative (the MCP server absolutises them anyway) |
| `AGENT_TXN_CAP_PAISE` / `AGENT_SESSION_CAP_PAISE` | ₹2,000 / ₹7,000 |

The AI buyer runs on **OpenAI or Anthropic**, whichever key is present
(`LLM_PROVIDER` forces one). Tools are declared once in plain JSON Schema and
translated at the boundary, so the commerce code never learns which is live.

Keep the session ceiling above the priciest SKU. If it sits below, an over-cap
item is blocked by the budget before the approval gate can run.

---

## Verifying it

```bash
npm run verify        # drives every guardrail over HTTP; non-zero on failure
```

Thirteen checks: a clean purchase, an unverified seller refused, a SKU the seller
kept to humans refused, the cap gated then approved then completed, a declined
card that leaves the budget untouched, the session ceiling, and a single-seat
licence returned rather than sold twice. No keys, no browser.

Reset between runs:

```bash
curl -X POST localhost:3001/api/agent-commerce/reset-all
```

A session reset returns the licence keys it burned to the pool, so the surface is
genuinely back to its starting state.

---

## Layout

```
backend/
  services/     commerce · guardrails · razorpay · delivery · llm · agentStore
  routes/       agentCommerce (agent + shop + assets) · sellerProducts · search
  mcp/          in-process MCP server, for developing haat itself
  scripts/      demo-agentic-checkout.js — the verification suite
  data/         catalogue, sellers, deliverables, generated cover art
mcp-server/     standalone MCP server (HTTP) — the one you hand to an agent
frontend/src/   pages, the ledger, the design system
```

Deeper technical detail — payments, delivery, the seller flow, what was adapted
and why — is in [`AGENTIC-COMMERCE.md`](AGENTIC-COMMERCE.md). Going live is in
[`DEPLOY.md`](DEPLOY.md).

---

## Going live

`vercel.json` and `api/index.js` are in place: the frontend builds to
`frontend/dist` and the whole Express app is served from one serverless function.

One thing to know before deploying — a purchase is three separate requests, and
on serverless each may hit a different instance. That needs a shared store
(Upstash Redis) and a fixed `DIGITAL_SIGNING_SECRET`, or orders vanish between
requests and every payment fails verification. [`DEPLOY.md`](DEPLOY.md) covers it.

---

## Notes

`backend/.env` is gitignored and no secret has ever been committed; the
`.env.example` files are blank templates.

There is no API-key auth on the agent endpoints — any client that can reach the
URL can transact within the caps. That is fine for a local demo and for judging,
and it is the first thing to add before real money.

Seller-uploaded files should go through a virus and content scan before general
availability. The current deliverables are all first-party seed assets.
