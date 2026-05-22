---
name: architecture-decisions
description: ADR-style log of key architecture decisions made during mihir-ai-worker design
metadata:
  type: project
---

# Architecture Decisions

Ten key decisions made during design and implementation of the backend.
Each entry: context → decision → rationale → consequences.

---

## ADR-001 — Cloudflare Workers as the runtime

**Context:** Needed a backend that is cheap, globally distributed, and has zero cold-start
for a low-traffic portfolio chatbot.

**Decision:** Cloudflare Workers with Wrangler 4 and TypeScript.

**Rationale:** Free tier covers expected traffic. D1, KV, and Workers AI are all
first-party Cloudflare products with native bindings — no SDK overhead, no external
network hops for AI inference. Workers have no cold-start penalty unlike Lambda.

**Consequences:** No Node.js APIs (no `fs`, no `net`). Must use Web Crypto API instead
of Node's `crypto` module. Local testing of AI requires `--remote` flag.

---

## ADR-002 — Two-repo separation (mihir-ai-worker vs Portfolio_001)

**Context:** Could have put the Worker in the same repo as the portfolio frontend.

**Decision:** Strict two-repo rule. Backend (`mihir-ai-worker`) and frontend
(`Portfolio_001`) are completely separate. No cross-repo commits.

**Rationale:** Different deployment targets, different secrets, different review
cadence. Keeping them separate prevents accidental exposure of backend secrets in
frontend commits and makes the Worker independently deployable.

**Consequences:** Frontend must call the Worker via HTTP. CORS must be explicitly
managed. Cannot share TypeScript types directly between repos without a published
package.

---

## ADR-003 — CSRF via HMAC rather than double-submit cookie

**Context:** Workers have no cookie-based session state. Needed CSRF protection
for stateful endpoints without relying on `SameSite` cookies alone.

**Decision:** On session creation, generate a random `csrf_secret`, store it in D1,
and return `csrf_token = HMAC-SHA256(SESSION_HMAC_KEY, "{sessionId}.{csrfSecret}")`.
The client echoes the token; the server recomputes and compares.

**Rationale:** Stateless verification — no session store lookup needed beyond the
D1 row that already exists. The HMAC binds the token to both the key and the
specific session+secret pair, making it unforgeable without the server key.

**Consequences:** `SESSION_HMAC_KEY` must never be exposed. Losing it invalidates all
active CSRF tokens. Token comparison uses constant-time XOR to prevent timing attacks.

---

## ADR-004 — IP hashed before storage, never stored raw

**Context:** Storing raw IPs raises GDPR/privacy concerns and adds compliance risk.

**Decision:** All IP addresses are passed through `hashIp(ip, IP_HASH_SALT)` using
SHA-256 before being written to D1. Raw IPs are never persisted.

**Rationale:** Hashed IPs are sufficient for rate limiting and abuse pattern detection.
They cannot be reversed without the salt. Keeps the project GDPR-friendly by design.

**Consequences:** `IP_HASH_SALT` rotation invalidates historical IP hashes, breaking
cross-session correlation. Rate limiting must compare hashes, not raw IPs.

---

## ADR-005 — Prompt injection guard as a pre-filter, not post-processing

**Context:** AI models can be manipulated by crafted inputs to ignore instructions,
reveal system prompts, or change persona.

**Decision:** `INJECTION_PATTERNS` (a static regex array in `src/lib/prompts.ts`) runs
on every user message *before* `env.AI.run` is called. Matched messages are stored
in D1 but never sent to the model.

**Rationale:** A pre-filter is deterministic and zero-latency compared to asking the
model to self-police. Storing the flagged message in D1 creates an audit trail.
Not calling the AI at all eliminates the risk of a successful injection.

**Consequences:** The regex list must be maintained as new attack patterns emerge.
False positives are possible (legitimate messages matching a pattern will get refused).
The refusal response intentionally does not reveal that injection was detected.

---

## ADR-006 — D1 (SQLite) for persistence, KV for rate limiting only

**Context:** Needed persistent storage for sessions, messages, leads, and analytics.
Cloudflare offers both D1 (relational) and KV (key-value).

**Decision:** D1 for all relational data. KV reserved exclusively for rate-limit
counters and short-lived ephemeral state.

**Rationale:** D1 supports SQL queries, foreign keys, and indexes — necessary for
joining sessions to messages and leads. KV's strong consistency guarantees make it
the right tool for atomic increment/decrement counters used in rate limiting.
Mixing concerns into one store would make schema evolution harder.

**Consequences:** D1 is in beta and has per-day row-write limits on the free tier.
Rate-limit counters in KV must use TTL-based expiry since KV has no `EXPIRE` command.

---

## ADR-007 — Single-file router (src/router.ts) over a framework

**Context:** Could use itty-router, hono, or another Workers router library.

**Decision:** Plain `if` checks on `pathname` and `method` in `src/router.ts`. No
third-party router dependency.

**Rationale:** The route count is small (< 10 routes total planned). A framework adds
bundle size and an abstraction layer that provides no real benefit at this scale.
Plain conditionals are instantly readable by anyone and have zero runtime overhead.

**Consequences:** Adding routes requires manually editing `router.ts`. No middleware
pipeline — cross-cutting concerns (CORS, error boundaries) are handled in
`src/index.ts` and individual route handlers.

---

## ADR-008 — Workers AI model: @cf/meta/llama-3.1-8b-instruct

**Context:** Cloudflare Workers AI offers several LLM models at different
quality/cost/latency points.

**Decision:** `@cf/meta/llama-3.1-8b-instruct` as the production model. The model
constant lives in `src/lib/ai.ts` as `AI_MODEL` so it can be swapped in one place.

**Rationale:** Llama 3.1 8B offers a strong quality-to-latency ratio for a
conversational assistant. It is available on the Cloudflare free tier. 8B parameters
is sufficient for a constrained, profile-grounded assistant that does not need broad
world knowledge.

**Consequences:** Model responses are non-deterministic. System prompt quality is the
primary lever for consistency. `max_tokens: 512` is set to keep responses focused and
inference fast. The `MODEL_LABEL` stored in D1 includes the prompt version
(`@cf/meta/llama-3.1-8b-instruct@v1.0`) for per-prompt-version quality analysis.

---

## ADR-009 — Conversation context via D1 history, not in-memory state

**Context:** Workers are stateless — no memory between requests. Needed a way to give
the AI recent conversation context without a separate session-memory service.

**Decision:** Before each AI call, fetch the last 6 messages for the session from D1
(`getSessionMessages` with the corrected DESC-then-ASC subquery). Pass them as the
`messages` array to `env.AI.run` ahead of the current user turn.

**Rationale:** D1 is the source of truth for message history. Fetching from D1 on each
request is slightly slower than an in-memory cache but correct across all Worker
instances. 6 messages (3 turns) is enough context for a professional Q&A assistant
without blowing the model's context window or inflating token cost.

**Consequences:** Very long sessions will have truncated context (intentional). If D1
is unavailable, `getSessionMessages` failure is non-fatal — the chat still proceeds
with no history rather than returning a 500.

---

## ADR-010 — PROFILE_TEXT as a static string in the system prompt, not RAG

**Context:** Could implement retrieval-augmented generation (RAG) using a vector
database to retrieve relevant profile sections per question.

**Decision:** Embed the entire `PROFILE_TEXT` (~7 KB) directly in the system prompt
for every request. No vector database, no embedding calls.

**Rationale:** The profile is small enough to fit comfortably in the model's context
window. RAG adds infrastructure complexity (vector DB provisioning, embedding model
calls, chunking strategy) that is not justified at this scale. A single static prompt
also makes behavior fully deterministic and auditable — every response is grounded in
exactly the same profile data.

**Consequences:** System prompt token cost is fixed and relatively high per request.
If the profile grows significantly (beyond ~12 KB), this decision should be revisited.
Profile updates require a code change and redeployment.
