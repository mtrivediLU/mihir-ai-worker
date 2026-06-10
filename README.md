# mihir-ai-worker

Backend Cloudflare Worker powering the AI chatbot embedded in [mihirtrivedi.tech](https://mihirtrivedi.tech).

Visitors — primarily recruiters, hiring managers, and professional contacts — can ask questions about Mihir's background, skills, and availability. This Worker handles session management, CSRF protection, rate limiting, LLM inference, lead capture, and email notification. It is deployed to Cloudflare's global edge network with no cold-start latency and zero server management overhead.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Cloudflare Workers (TypeScript) | Stateless edge functions, global PoPs, no cold start |
| Database | Cloudflare D1 (SQLite) | Persistent storage: sessions, messages, leads, analytics |
| Cache / Rate limiting | Cloudflare KV | Fixed-window abuse counters with TTL-based expiry |
| AI inference | Cloudflare Workers AI | LLM chat completions (`@cf/meta/llama-3.1-8b-instruct`) |
| Bot protection | Cloudflare Turnstile | Server-side token verification after message threshold |
| Email | Resend | Lead notification email to site owner on form submission |
| DNS | AWS Route 53 | Domain routing for `mihirtrivedi.tech` |
| Toolchain | Wrangler 4, TypeScript strict mode | Local dev, type safety, deployment |

**Zero external npm runtime dependencies.** All integrations use native `fetch` and Cloudflare's first-party bindings.

---

## Architecture Overview

```
Browser (Portfolio_001)
        │
        │  HTTPS  (CORS-restricted to mihirtrivedi.tech)
        ▼
┌──────────────────────────────────────────────────────┐
│              Cloudflare Workers Edge                  │
│                                                       │
│  index.ts ──► cors.ts (env-aware origin check)       │
│           ──► router.ts (pathname + method switch)   │
│                    │                                  │
│         ┌──────────┴──────────────────┐              │
│         ▼                             ▼              │
│   /api/session                /api/chat              │
│   /api/lead                   /health                │
│         │                             │              │
│    lib/crypto.ts               lib/ai.ts             │
│    lib/kv.ts                   lib/turnstile.ts      │
│    lib/d1.ts                   lib/prompts.ts        │
│    lib/email.ts                lib/kv.ts             │
└──────────────────────────────────────────────────────┘
        │                    │                │
        ▼                    ▼                ▼
   Cloudflare D1        Workers AI       Cloudflare KV
   (sessions,           (Llama 3.1)      (rate limit
    messages,                             counters)
    leads)
                                          │
                                          ▼
                                       Resend API
                                    (lead notification)
```

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Returns `{ ok, version, time }` |
| `GET` | `/debug/profile?token=dev` | Dev-only | Returns parsed profile data; blocked in production |
| `POST` | `/api/session` | None | Creates a session; returns `session_id` + `csrf_token` |
| `POST` | `/api/chat` | CSRF + Turnstile (conditional) | Sends a chat message; returns AI reply |
| `POST` | `/api/lead` | CSRF | Submits contact form; saves lead; sends notification email |

### `POST /api/session`

Creates a new visitor session. Hashes the client IP with a server-side salt before storage — raw IPs are never persisted. Returns a signed CSRF token that the client must echo on every subsequent mutation request.

**Response:**
```json
{ "session_id": "uuid", "csrf_token": "hmac-hex" }
```

### `POST /api/chat`

Validates the CSRF token, applies rate limits, runs prompt-injection detection, then calls Workers AI with the last 6 messages from D1 as conversation context. After 5 messages in a session, a Cloudflare Turnstile token is required on every subsequent request.

**Request:**
```json
{
  "session_id": "uuid",
  "csrf_token": "hmac-hex",
  "message": "What is Mihir's experience with distributed systems?",
  "turnstile_token": "optional-after-threshold"
}
```

**Response:**
```json
{
  "reply": "Mihir has...",
  "session_id": "uuid",
  "turnstile_required": true
}
```

### `POST /api/lead`

Validates CSRF, applies per-IP rate limiting, saves the lead to D1, and fires a notification email to the site owner via Resend. The visitor always receives a success response — email failure is non-fatal and logged server-side only.

**Request:**
```json
{
  "session_id": "uuid",
  "csrf_token": "hmac-hex",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "organization": "Acme Corp",
  "reason": "Interested in hiring Mihir",
  "phone": "+1 555-0100",
  "intent": "hiring",
  "opt_in_email": true
}
```

**Response:**
```json
{ "success": true, "lead_id": 42 }
```

---

## Security Design

### CSRF Protection

Every session creation generates a random `csrf_secret` stored in D1. The server signs `HMAC-SHA256(SESSION_HMAC_KEY, "{sessionId}.{csrfSecret}")` and returns it as `csrf_token`. On each mutation (`/api/chat`, `/api/lead`), the server recomputes the HMAC and compares using a constant-time XOR to prevent timing attacks. The token is unforgeable without the server key.

### Prompt Injection Guard

Every user message is tested against a static `INJECTION_PATTERNS` regex array before the AI model is called. Matched messages are stored in D1 for audit purposes but the model is never invoked — the response is a safe refusal. This is deterministic and zero-latency compared to relying on the model to self-police.

### IP Privacy

Client IPs are hashed with `SHA-256(ip + IP_HASH_SALT)` before any D1 write. Raw IPs are never stored. The salt means hashes cannot be reversed without it, and rotating the salt breaks historical correlation — a deliberate privacy property.

### Bot Protection

Cloudflare Turnstile server-side verification (`/turnstile/v0/siteverify`) is enforced on `/api/chat` once a session has accumulated 5 or more messages. The check happens after CSRF validation and rate-limit checks, and strictly before any AI inference call.

### CORS

Origins are environment-aware. In production (`ENV=production`), only `https://mihirtrivedi.tech` and `https://www.mihirtrivedi.tech` are reflected in `Access-Control-Allow-Origin`. Localhost origins are available in non-production environments only.

### No Model-Driven Side Effects

The AI model is called for text generation only. It cannot trigger email sends, D1 writes, or any external HTTP call. All side effects are coded explicitly in route handlers after AI output is returned.

---

## Rate Limiting

Implemented in `src/lib/kv.ts` using time-bucketed KV keys. Each fixed window gets a dedicated key (`{prefix}:{bucketNumber}`) with a TTL matching the remaining window — this avoids the TTL-reset problem that occurs when always writing to the same key.

| Limit | Scope | Window |
|---|---|---|
| 10 session creations | Per IP hash | 1 hour |
| 30 chat messages | Per IP hash | 10 minutes |
| 5,000 chat messages | Global | 24 hours |
| 50 messages | Per session (D1-based hard cap) | — |
| 3 lead submissions | Per IP hash | 1 hour |

All limits fail open on KV error — a KV outage will not block visitor traffic.

---

## Database Schema

Six tables in a single D1 SQLite database (`mihir_ai`), applied via `migrations/0001_init.sql`.

| Table | Purpose |
|---|---|
| `sessions` | One row per visitor session; stores IP hash, geo metadata, CSRF secret, message count |
| `messages` | Chat turn history linked to sessions; stores role, content, model label, latency |
| `leads` | Contact form submissions; stores name, email, intent, follow-up status, `email_sent` flag |
| `summaries` | Per-session AI-generated summaries (schema ready; not yet populated) |
| `analytics_events` | Structured event log (schema ready; not yet populated) |
| `daily_metrics` | Aggregated daily stats (schema ready; not yet populated) |

Nine indexes cover the common access patterns: session lookups by IP hash and timestamp, message lookups by session, and lead lookups by session and email.

**Key schema decisions:**

- `ip_hash` is stored — never the raw IP
- `message_count` is a denormalized counter on the session row, enabling O(1) cap enforcement without a `COUNT` query on every request
- `email_sent` on leads is set to `1` only after a confirmed Resend HTTP 2xx; stays `0` on any failure so missed notifications are auditable
- `model` column on messages stores a versioned label (e.g. `@cf/meta/llama-3.1-8b-instruct@v1.0`) to support per-prompt-version quality analysis after system prompt updates

---

## Workers AI Integration

**Model:** `@cf/meta/llama-3.1-8b-instruct`

The model constant is defined once in `src/lib/ai.ts` (`AI_MODEL`) and can be swapped in a single line. A versioned label (`MODEL_LABEL`) is stored with every assistant message in D1.

**Conversation context:** The last 6 messages (3 full turns) from D1 are prepended before the current user message. This provides conversational continuity without unbounded context growth. If D1 is unavailable, the chat proceeds with no history rather than returning a 500.

**System prompt:** The entire profile (~7 KB) is embedded statically in every system prompt — no RAG, no vector database. At this profile size, a static embed is simpler, fully auditable, and eliminates retrieval latency and chunking complexity.

---

## Project Structure

```
src/
├── index.ts              Worker entry point — applies CORS to all responses
├── router.ts             Pathname/method router (plain if-checks, no framework)
├── cors.ts               Environment-aware CORS (production vs dev origins)
├── types.ts              Env interface — all bindings and secrets typed here
│
├── lib/
│   ├── ai.ts             Workers AI wrapper — getAiReply, model constant
│   ├── crypto.ts         HMAC sign/verify, IP hashing (Web Crypto API)
│   ├── d1.ts             D1 row types and all query helpers
│   ├── email.ts          Resend integration — notification email builder
│   ├── kv.ts             Rate limit helper — time-bucketed fixed windows
│   ├── profile.ts        Static profile data embedded in system prompt
│   ├── prompts.ts        System prompt, refusal response, injection patterns
│   └── turnstile.ts      Cloudflare Turnstile siteverify helper
│
└── routes/
    ├── health.ts          GET /health
    ├── debug.ts           GET /debug/profile (dev-only)
    ├── session.ts         POST /api/session
    ├── chat.ts            POST /api/chat
    └── lead.ts            POST /api/lead

migrations/
└── 0001_init.sql          Full D1 schema: 6 tables, 9 indexes
```

---

## Environment Variables and Secrets

| Variable | Type | Set via | Notes |
|---|---|---|---|
| `ENVIRONMENT` | Public var | `wrangler.toml` | `"production"` in prod |
| `ENV` | Public var | `wrangler.toml` | Controls Turnstile bypass and CORS origin list |
| `VERSION` | Public var | `wrangler.toml` | Surfaced in `/health` response |
| `SESSION_HMAC_KEY` | Secret | `wrangler secret put` | Signs CSRF tokens; generate with `openssl rand -hex 32` |
| `IP_HASH_SALT` | Secret | `wrangler secret put` | Salts IP hashes; generate with `openssl rand -hex 32` |
| `TURNSTILE_SECRET_KEY` | Secret | `wrangler secret put` | Cloudflare Dashboard → Turnstile widget → Secret Key |
| `RESEND_API_KEY` | Secret | `wrangler secret put` | resend.com → API Keys |
| `LEAD_NOTIFY_TO` | Secret | `wrangler secret put` | Email address to receive lead notifications |
| `LEAD_NOTIFY_FROM` | Secret | `wrangler secret put` | Verified Resend sender address |

Secrets are never in source code or `wrangler.toml`. In local development they live in `.dev.vars` (gitignored). See `.dev.vars.example` for the full template.

**Dev bypasses** — active only when `ENV !== "production"`:

- `TURNSTILE_SECRET_KEY` unset → Turnstile token `"dev-turnstile-token"` is accepted without a network call
- `RESEND_API_KEY` / `LEAD_NOTIFY_TO` / `LEAD_NOTIFY_FROM` unset → email step is silently skipped; the lead is still saved to D1

---

## Local Development

### Prerequisites

- Node.js 18+
- A Cloudflare account with D1 and KV provisioned

### Setup

```bash
# Install dev dependencies (Wrangler, TypeScript, workers-types)
npm install

# Copy the secrets template and fill in SESSION_HMAC_KEY and IP_HASH_SALT
cp .dev.vars.example .dev.vars

# Apply the D1 schema locally
npx wrangler d1 execute mihir_ai --local --file ./migrations/0001_init.sql

# Start the local dev server
npm run dev
```

To test Workers AI, use `--remote` — this proxies AI calls to Cloudflare's preview environment:

```bash
npx wrangler dev --remote
```

### Useful local D1 queries

```bash
# Recent sessions
npx wrangler d1 execute mihir_ai --local \
  --command "SELECT id, country, message_count, created_at FROM sessions ORDER BY created_at DESC LIMIT 10;"

# Recent messages
npx wrangler d1 execute mihir_ai --local \
  --command "SELECT role, substr(content,1,80) FROM messages ORDER BY created_at DESC LIMIT 20;"

# Leads
npx wrangler d1 execute mihir_ai --local \
  --command "SELECT id, name, email, follow_up_status, email_sent FROM leads;"
```

### Type checking

```bash
npm run typecheck
```

---

## Production Deployment

### 1. Apply the remote D1 migration

```bash
npx wrangler d1 execute mihir_ai --remote --file ./migrations/0001_init.sql
```

### 2. Set all production secrets

```bash
npx wrangler secret put SESSION_HMAC_KEY
npx wrangler secret put IP_HASH_SALT
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put LEAD_NOTIFY_TO
npx wrangler secret put LEAD_NOTIFY_FROM
```

### 3. Deploy

```bash
npx wrangler deploy
```

### 4. Smoke test

```bash
# Health check
curl https://<your-worker>.workers.dev/health

# Session creation
curl -X POST https://<your-worker>.workers.dev/api/session \
  -H "Content-Type: application/json" -d '{}'
```

---

## Engineering Decisions and Tradeoffs

**No router framework.** Routes are plain `if` checks in `src/router.ts`. With fewer than 10 routes, a framework adds bundle size and abstraction for no practical benefit.

**Static profile in system prompt, not RAG.** The entire profile (~7 KB) is embedded in every system prompt. Retrieval-augmented generation would require a vector database, an embedding model, and a chunking strategy — none of which is justified at this profile size. The static embed is auditable and always consistent.

**KV rate limiting is non-atomic.** Cloudflare KV does not support atomic increment. Under concurrent requests, two workers may both read the same count and both be permitted. This is an accepted tradeoff for a low-traffic portfolio chatbot. It would not be appropriate for financial or safety-critical limits.

**Time-bucketed KV keys.** Each rate-limit window gets its own KV key (`{prefix}:{bucketNumber}`) with a TTL matching the remaining window. Writing to the same key and resetting its TTL on each request (the naive approach) would restart the window on every hit. Bucketing avoids this.

**Email failure is non-fatal.** If Resend is unavailable or misconfigured, the lead is still saved to D1 and the visitor receives a success response. The `email_sent = 0` flag makes missed notifications auditable. A KV outage similarly fails open so visitor traffic is never blocked by an infrastructure dependency.

**Web Crypto API throughout.** Cloudflare Workers do not expose Node's `crypto` module. All cryptographic operations (`signHmac`, `verifyHmac`, `hashIp`) use the standard Web Crypto API, making them portable across any Web-standard runtime.

---

## Related

- **Frontend:** [Portfolio_001](https://github.com/mtrivediLU/Portfolio_001) — The portfolio site that embeds this chatbot. Maintained in a separate repo; no cross-repo code sharing by design.
