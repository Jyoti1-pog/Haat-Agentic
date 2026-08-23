# haat — a digital marketplace with agentic checkout

haat sells digital goods made by Indian craftspeople: pattern packs, brushes,
typefaces, field recordings, courses. Nothing ships. Everything arrives the
moment it is paid for.

It has two front doors, and both are real:

- **A person** browses the catalogue, checks out, and the file, licence key or
  access link lands in their library.
- **An AI agent** does the same thing on its own — over MCP or REST — with every
  money decision bounded, gated, and written into an audit trail as it happens.

Both doors run the *same* code. Payment verification, delivery and entitlements
are one implementation; the only thing that differs is the authorisation policy,
because caps and approval gates are an agent's leash, not a shopper's.

---

## Quick start

```bash
npm run install:all
cp backend/.env.example backend/.env        # optional — see Configuration
cp frontend/.env.example frontend/.env      # set VITE_FRONTEND_ONLY=false
npm run dev
```

Then:

- **http://localhost:3000** — the shop. Buy something; it lands in your library.
- **http://localhost:3000/agent-checkout** — the ledger. Press *Run scripted demo*
  and watch an agent do it, guardrails and all.

To verify the whole surface from a terminal instead:

```bash
cd backend && npm run demo:agent
```

That drives every guardrail over plain HTTP and exits non-zero if any scenario
misses its expected outcome. It needs no API keys and no browser.

---

## What an agent can do

Seven tools, published identically over **MCP** (`backend/mcp/server.js`) and
**REST** (`/api/agent-commerce/*`). Both call the same functions in
`backend/services/commerce.js`, so the guardrails cannot be bypassed by coming
in through one door instead of the other.

| Tool | What it does |
|---|---|
| `search_digital_products` | Search SKUs whose seller opened them to AI buyers |
| `get_product` | Full detail — licence, stock, seller verification. Never the deliverable |
| `get_budget` | The limits in force and what is left of them |
| `create_order` | Runs the gates, then creates a real Razorpay order. Moves no money |
| `authorise_test_payment` | Stands in for the browser card step an agent cannot drive |
| `confirm_payment` | Verifies the signature, marks paid, delivers |
| `get_order_status` | Status plus the deliverable, with a freshly signed link |

`GET /api/agent-commerce/manifest` describes all of this to an agent that
arrives cold.

### The tool that is deliberately missing

There is no `confirm_purchase_approval` in the agent's toolset — not over MCP,
and not in the Claude loop in `agentPlanner.js`. An agent that could approve its
own over-cap spending would make the approval gate decoration. Approval comes
from a human, through the ledger UI or `POST /api/agent-commerce/approvals`.

---

## Listing a product (seller side)

`/sell` is the product-creation form, and the Product type toggle is its hinge.
Choose **Physical** and it asks for weight, dimensions and a shipping class.
Choose **Digital** and those disappear entirely — a pattern pack has nothing to
ship — and it asks instead how the thing is delivered:

| Delivery | What the seller provides | What the buyer gets |
|---|---|---|
| File download | One upload, up to 25 MB | Their own signed link, expiring in 48h |
| Unlock code | A pool of codes, one per line | One code, burned from the pool |
| Access link | An https URL they host | That URL, unexpired — it isn't haat's to expire |

Plus licence terms, `max_purchases` (blank = unlimited, `1` = single-seat), and
the switch that matters: **Enable for AI-buyer checkout**. A digital product a
human can buy is not automatically one an agent may buy, so the form asks
explicitly rather than defaulting it on, and warns up front when the chosen
seller is not haat-verified — those products are refused to agents at any price.

Products listed this way are first-class: an agent can find and buy one a minute
after it was created, through exactly the same guardrails. They are held in the
runtime store rather than written back into the seed file, so the committed
catalogue stays a fixture and a demo listing clears without a git diff.

`POST /api/seller/products` (multipart) is the same endpoint the form posts to.

---

## Buying as a person

`POST /api/shop/orders` → `…/authorise` → `…/confirm`, then
`GET /api/shop/library/:buyer_ref`.

A library is keyed to an email address rather than a login, which is what lets an
agent buy on someone's behalf and have it land where that person can see it —
marked as an agent purchase. Signed download links are re-minted on every read,
so a buyer returning on day three gets a working link rather than a dead one.

The checks a shopper meets are the ones that protect them: the product has to
exist and be in stock, and a single-seat licence already owned is returned
instead of sold twice. No spend caps — see below for why those are agent-only.

---

## Guardrails

These apply to **agents**, not to people. All in `backend/services/guardrails.js`. Every one is a plain comparison against
a number or a boolean, evaluated server-side on every attempt, and none of them
consults a model. An agent may reason about *what* to buy; whether money is
allowed to move is decided by code you can read top to bottom and predict.

| Rule | Behaviour |
|---|---|
| Product enabled for agent checkout | Hard block. A SKU humans can buy is not automatically one an agent may buy |
| Seller haat-verified | Hard block at any price |
| Stock | Hard block when an unlock-code pool is empty — refuse rather than take money for something undeliverable |
| Session budget (₹7,000) | Hard block. Cannot be lifted by any approval |
| Per-transaction cap (₹2,000) | **Gate**, not a block. Needs one explicit human approval, scoped to that item at that exact price |

An approval is consumed on use and does not survive a price change. The session
ceiling is checked before the per-transaction cap, because a session that is
already spent out cannot be rescued by approving an item.

Every call writes to `agent_actions` — the refusals included, each with a
human-readable reason. A decision that isn't logged didn't happen.

---

## Payments

Real Razorpay Orders API over REST, with real HMAC-SHA256 signature
verification (`backend/services/razorpay.js`). Amounts are integer paise
throughout — Razorpay's native unit, and no float drift on a value that gates
whether money moves.

Two payment paths converge on the same verification code:

- **Browser** — Razorpay Checkout returns a real payment id and signature.
  A `payment.captured` webhook at `/api/agent-commerce/webhook/razorpay`
  settles it, verified against the raw request body.
- **Agent** — there is no browser, so `authorise_test_payment` mints a payment
  id and signs it with the key secret. Everything downstream is identical; only
  the payer's card step is stood in for, and every such payment is labelled
  `simulated_card` in the order row and the audit log.

`outcome: "failed"` mints a deliberately invalid signature, so the declined-card
path is genuinely exercised rather than mocked.

**Without Razorpay keys** the flow still runs end to end: order ids are minted
locally, signatures use a per-process stand-in secret so the HMAC round-trip is
still really performed, and every response and audit row is stamped
`unconfigured`. `isConfigured()` stays false, so nothing reports a stand-in as a
real integration.

---

## Delivery

- **File** — a signed, time-limited URL (HMAC over `entitlement_id|expiry`,
  48h default) served from `backend/data/digital/files`. Links are re-minted on
  every read, so a buyer returning on day three gets a working link. Tampered
  signatures 403; expired links are refused.
- **Code** — one unlock code popped from the product's pool and burned.
- **Link** — an https URL the seller hosts, handed over as-is. haat does not
  proxy or expire it, because it is not haat's to expire.

Fulfilment is idempotent per buyer and product: an existing entitlement is
returned rather than a second code being burned.

---

## Configuration

Everything is optional. With no keys at all, the scripted demo, the guardrails,
the ledger and delivery all work.

| Variable | Effect if unset |
|---|---|
| `RAZORPAY_KEY_ID` / `_SECRET` | Orders minted locally, stamped `unconfigured` |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook endpoint rejects everything (agent path unaffected) |
| `DIGITAL_SIGNING_SECRET` | Download links work but don't survive a restart |
| `PUBLIC_BASE_URL` | Download links come back as relative paths |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | The AI buyer is unavailable; scripted demo still works. Either one works — see below |
| `AGENT_TXN_CAP_PAISE` / `AGENT_SESSION_CAP_PAISE` | ₹2,000 / ₹7,000 |

Keep the session ceiling comfortably above the priciest SKU. If it sits below,
an over-cap item is blocked by the budget before the approval gate can run, and
the gate becomes unreachable.

---

## The AI buyer, and which model runs it

`services/llm.js` runs the agent on **OpenAI or Anthropic**, chosen by whichever
key is present (`OPENAI_API_KEY` wins if both are; `LLM_PROVIDER` forces one).
Tools are declared once in plain JSON Schema and translated at the boundary, so
the commerce code never learns which provider it is talking to.

Set `OPENAI_MODEL` (default `gpt-4o`) or `ANTHROPIC_MODEL` to change models.
`GET /api/agent-commerce/manifest` reports which is live.

### The agent is not told the caps — on purpose

An early version put the spend limits in the system prompt. The model then
*self-policed*: shown a ₹4,999 item against a ₹2,000 cap, it announced the
purchase would be refused and never called `create_order` at all. That is the
exact failure the design exists to prevent — the agent substituting its own
judgement for the server's, and leaving no audit record either way.

So the prompt now withholds the numbers and says plainly: you are not the
authority on what is permitted, always attempt, let the server rule. The agent
calls `create_order`, the server returns `pending_approval`, `gate_triggered`
lands in the ledger, and the human sees a real decision to make.

A guardrail the agent can talk itself into enforcing is a guardrail it can talk
itself out of.

---

## Connecting an MCP client

```json
{
  "mcpServers": {
    "haat": {
      "command": "node",
      "args": ["<abs path>/haat/backend/mcp/server.js"],
      "env": {
        "RAZORPAY_KEY_ID": "rzp_test_...",
        "RAZORPAY_KEY_SECRET": "...",
        "HAAT_AGENT_SESSION": "claude-desktop-1",
        "HAAT_BUYER_REF": "you@example.com"
      }
    }
  }
}
```

One MCP process is one agent session — give each client its own
`HAAT_AGENT_SESSION` so they don't share a spend budget.

Actions taken over MCP appear in the `/agent-checkout` ledger for that session
id, because the page reads the server's audit trail rather than its own state.
The same feed renders whether the actions came from the scripted run, the Claude
loop, an MCP client in another process, or a judge with curl.

---

## Resetting between runs

```bash
curl -X POST localhost:3001/api/agent-commerce/reset/<session-id>   # one session
curl -X POST localhost:3001/api/agent-commerce/reset-all            # everything
```

A session reset returns the unlock codes that session burned to the pool, so the
surface is genuinely back at its starting state. Runtime state lives in
`backend/data/agent-store.json` (gitignored); deleting it is a full reset.

---

## Where things are

```
backend/
  services/
    commerce.js        the seven tools, one implementation
    guardrails.js      the deterministic rules
    razorpay.js        Orders API + signature verification
    delivery.js        signed URLs, code pool
    digitalCatalog.js  digital SKUs joined to sellers and deliverables
    agentStore.js      orders, entitlements, audit trail, sessions
    agentPlanner.js    Claude driving the tools (discovery only)
  routes/agentCommerce.js   REST mirror, ledger, webhook, signed downloads
  routes/sellerProducts.js  seller product creation (physical + digital)
  mcp/server.js             MCP stdio server (in-process, for development)
  routes/sellerProducts.js  seller listing + dashboard
  scripts/demo-agentic-checkout.js   scripted run / smoke test
  data/                     seed catalogue, sellers, deliverables, assets

mcp-server/                 standalone MCP server (HTTP — the distributable one)

frontend/src/
  pages/AgentCheckoutPage.jsx   the ledger surface
  pages/SellerDashboardPage.jsx sales, revenue, agent-vs-person split
  pages/OpsPage.jsx             platform-wide activity
  pages/SellerListingPage.jsx   the product-creation form
  styles/ledger.css             the bahi-khata design system
  lib/agentCommerce.js          client
```

---

## Notes on the build

Three things in the original PRD assumed a stack this repo doesn't have, and
were adapted rather than forced:

- **No Postgres or Supabase tables.** haat keeps its catalogue in a flat JSON
  file and its carts in an in-memory Map. The agent surface follows that grain:
  one JSON file, held in memory, flushed after writes. No new database
  dependency, no migration to run before a demo. (`services/db.js` and
  `userStore.js` reference `better-sqlite3`, which isn't installed and which
  nothing imports — they appear to be dead code and were left untouched.)
- **No seller records.** `seller` was a bare string on each product with no
  verification field, so `data/sellers.json` was added to give the
  seller-verification rule something real to check.
- **The PRD's own figures made the gate unreachable** — a $60 item under a $50
  session budget can never be approved. Caps are now ₹2,000 per transaction
  against a ₹7,000 session ceiling, which keeps the intended narrative and lets
  the approval path actually run.

Two pre-existing bugs were fixed in passing, both of which the digital category
surfaced:

- `lib/api.js` forwarded the storefront's category filter as `mode`, so the
  backend never received it and category filtering only ever happened
  client-side against whatever the keyword search had returned.
- The category pills filtered the current result set without re-querying, so
  selecting a category absent from that set showed zero results for a category
  that has stock.
- Multipart text fields were decoded as latin1 (busboy's default), which turned
  every em dash and every Devanagari or Tamil character a seller typed into
  mojibake. Fixed with `defParamCharset: 'utf8'`.
- The seal overlay used `position: fixed` inside the shell's `.page-enter`,
  whose transform animation makes it the containing block for fixed
  descendants — so the entrance animation centred on the document rather than
  the viewport and rendered several hundred pixels below the fold. It is now
  portalled to `<body>` and carries its own palette.

Deliberately not built, and worth flagging in the pitch rather than hiding:
uploaded seller files should go through a virus and content scan before general
availability. The current deliverables are all first-party seed assets.
