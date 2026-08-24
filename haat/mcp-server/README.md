# haat-mcp

An MCP server that lets an AI agent buy digital goods from [haat](../README.md) —
pattern packs, brushes, typefaces, field recordings and courses made by Indian
craftspeople — and receive them, end to end, with no human in the transaction.

It speaks HTTP to a haat deployment, so the agent does not need haat's code or
its data. Point it at a URL and it works.

```bash
npx haat-mcp                                   # → http://localhost:3001
HAAT_URL=https://haat.example.com npx haat-mcp
```

## Connecting a client

Claude Desktop, Claude Code, or any MCP host:

```json
{
  "mcpServers": {
    "haat": {
      "command": "npx",
      "args": ["-y", "haat-mcp"],
      "env": {
        "HAAT_URL": "https://haat.example.com",
        "HAAT_AGENT_SESSION": "claude-desktop-1",
        "HAAT_BUYER_REF": "you@example.com"
      }
    }
  }
}
```

| Variable | Default | Why it matters |
|---|---|---|
| `HAAT_URL` | `http://localhost:3001` | Which haat to buy from |
| `HAAT_AGENT_SESSION` | `mcp-<pid>-<ts>` | One session, one spend budget. Give each client its own or they share a wallet. |
| `HAAT_BUYER_REF` | the session id | Who owns the purchase. Use the person's email and it lands in *their* library. |
| `HAAT_API_KEY` | — | Required if the deployment enforces keys. Your session is namespaced to it, so no other agent can reach or spend it |
| `HAAT_TIMEOUT_MS` | `30000` | Per-request timeout |

## Tools

| Tool | What it does |
|---|---|
| `search_digital_products` | Find goods open to AI-buyer checkout |
| `get_product` | Licence, origin, stock. Never the deliverable |
| `get_budget` | Limits in force and what's left |
| `create_order` | Runs the guardrails, then creates a real Razorpay order. Moves no money |
| `authorise_payment` | Stands in for the browser card step |
| `confirm_payment` | Verifies the signature, marks paid, delivers |
| `get_order_status` | Status plus a freshly minted download link |
| `get_library` | Everything this buyer already owns |
| `get_audit_log` | This session's trail, refusals included, each with a reason |

A purchase is three calls: `create_order` → `authorise_payment` → `confirm_payment`.
An order is not a purchase until the third one returns.

Download links come back **absolute**, resolved against `HAAT_URL`. haat itself
emits them relative — correct for its own same-origin web UI, useless to an agent
handing a link to someone nowhere near the server — so they get an origin
attached here, at the boundary where "relative to haat" stops meaning anything.

## What `create_order` can answer

It is not a boolean. Read the `status`:

- **`created`** — proceed to payment.
- **`blocked`** — a hard rule refused it. Do not retry; pick something else.
  Unverified seller, seller didn't open the SKU to agents, or out of stock.
- **`pending_approval`** — over the per-transaction cap. Needs one explicit human
  approval, scoped to that item at that price. **You cannot grant this yourself.**
- **`already_entitled`** — the buyer owns it. The existing copy comes back
  instead of a second charge.

Always call `create_order` rather than deciding for yourself that something will
be refused. The attempt is what gets written to the audit ledger; a purchase you
talked yourself out of leaves no record.

## The tool that is deliberately missing

There is no approval tool here. An agent that could approve its own over-cap
spending would make the gate decoration. Approval comes from a person — through
haat's ledger UI, or `POST /api/agent-commerce/approvals` — and only then can the
agent retry.

## Why this holds even if you don't trust this file

It carries no business logic. Every guardrail — spend caps, the
seller-verification rule, stock, the approval gate — is enforced inside haat. A
modified or hostile copy of this server still cannot buy from an unverified
seller or exceed a cap, because it was never the thing deciding.

That is the point of putting the rules on the server: the client is untrusted by
construction.

## Two servers, and which to use

| | `haat-mcp` (this) | `backend/mcp/server.js` |
|---|---|---|
| Talks to haat by | HTTP | direct module imports |
| Runs where | anywhere | same machine as the backend |
| Use when | connecting a real agent to a deployed haat | developing haat itself |

Both publish the same tool contracts against the same service layer, so an agent
cannot tell them apart — and neither can bypass a rule the other enforces.
