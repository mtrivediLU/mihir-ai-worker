# CLAUDE.md — mihir-ai-worker

Cloudflare Worker backend for Mihir Trivedi's AI portfolio chatbot.
TypeScript, strict mode, Wrangler 4, zero external npm dependencies at runtime.

---

## Project purpose

Serve a conversational AI assistant embedded in Mihir's portfolio site
(`mihirtrivedi.tech`). Visitors — primarily recruiters, founders, and professional
contacts — can ask questions about Mihir's background, skills, and availability.
The backend handles sessions, CSRF protection, AI inference, lead capture, and
email notification to Mihir.

---

## Audience priority

1. **Recruiters and hiring managers** — most likely visitors; need concise, accurate
   answers about experience, skills, and availability
2. **Founders / collaborators** — may ask about project types and technical depth
3. **Professional network** — general background questions

Responses should always be professional, factual, third-person, and recruiter-friendly.

---

## Two-repo rule

| Repo | Purpose |
|---|---|
| `mihir-ai-worker` | This repo. Backend Worker only. |
| `Portfolio_001` | Frontend portfolio site. **Never touch from this repo.** |

Never modify `Portfolio_001` from `mihir-ai-worker`. Never commit frontend code here.

---

## Tech stack

| Service | Binding | Purpose |
|---|---|---|
| Cloudflare Workers | — | Runtime (TypeScript, edge) |
| Cloudflare D1 | `DB` | Persistent SQLite: sessions, messages, leads, analytics |
| Cloudflare KV | `RL` | Rate limiting and abuse counters |
| Cloudflare Workers AI | `AI` | LLM inference (`@cf/meta/llama-3.1-8b-instruct`) |
| Cloudflare Turnstile | secret | Bot protection on `/api/chat` after message threshold |
| Resend | secret | Lead notification email to Mihir on new lead |
| AWS Route 53 | — | DNS (Phase 0, done) |

Secrets are never in code. They live in `.dev.vars` locally and are set via
`wrangler secret put` for production.

---

## Backend routes

| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/health` | ✅ Live | Returns `{ ok, version, time }` |
| GET | `/debug/profile?token=dev` | ✅ Live | Dev-only profile preview |
| POST | `/api/session` | ✅ Live | Creates session, returns `session_id` + `csrf_token` |
| POST | `/api/chat` | ✅ Live | CSRF-validated chat turn backed by Workers AI; Turnstile required after 5 messages |
| POST | `/api/lead` | ✅ Live | Lead capture; validates CSRF; saves to D1; notifies Mihir via Resend |

---

## Source layout

```
src/
  index.ts          Worker entry point — applies CORS to all responses
  router.ts         Pathname/method router
  cors.ts           CORS allowed-origins (localhost:5500, mihirtrivedi.tech)
  types.ts          Env interface — all bindings and secrets typed here

  lib/
    ai.ts           Workers AI helper — getAiReply, model constant, prompt assembly
    crypto.ts       signHmac, verifyHmac, hashIp, generateRandomHex (Web Crypto)
    d1.ts           D1 row types + all query helpers
    email.ts        Resend helper — sendLeadNotification, HTML builder
    kv.ts           Rate limit helper — incrementRateLimit, RATE_LIMITS, RL_KEYS
    profile.ts      PROFILE constant (from portfolio HTML) + PROFILE_TEXT
    prompts.ts      SYSTEM_PROMPT_CHAT, REFUSAL_RESPONSE, INJECTION_PATTERNS
    turnstile.ts    Cloudflare Turnstile siteverify helper

  routes/
    health.ts       GET /health
    debug.ts        GET /debug/profile (dev-only)
    session.ts      POST /api/session
    chat.ts         POST /api/chat
    lead.ts         POST /api/lead

migrations/
  0001_init.sql     Full D1 schema (6 tables, 9 indexes)
```

---

## Security non-negotiables

These checks must not be removed or reordered:

1. **CSRF before any state change** — every mutation route (`/api/chat`, `/api/lead`)
   must verify the CSRF token by recomputing
   `HMAC(SESSION_HMAC_KEY, "{sessionId}.{csrfSecret}")` before touching D1.

2. **Injection regex before AI** — `INJECTION_PATTERNS` from `src/lib/prompts.ts`
   must run on every user message before `env.AI.run` is called. If matched,
   return `REFUSAL_RESPONSE` and log to D1 — never call the model.

3. **No model-driven actions** — the AI model must never trigger side effects
   (email, lead write, external HTTP). AI output is text only; all actions are
   coded explicitly in route handlers.

4. **No secrets in the frontend** — `SESSION_HMAC_KEY`, `IP_HASH_SALT`, and all
   other secrets live only in Cloudflare Worker env. The frontend only ever sees
   `session_id` and `csrf_token`.

5. **IP hashed, never stored raw** — `hashIp(ip, IP_HASH_SALT)` before D1 insert.

---

## What is done (Phases 0 – 5C)

| Phase | Description |
|---|---|
| 0 | Cloudflare D1, KV, Turnstile, Resend, AWS Route 53 provisioned |
| 1 | Worker scaffold: TypeScript, CORS, `/health`, router |
| 2 | D1 schema, `profile.ts`, `prompts.ts`, `d1.ts` stubs, `crypto.ts` |
| 3A | `POST /api/session` — session creation, CSRF generation, IP hashing, geo metadata |
| 3B1 | `POST /api/chat` — CSRF validation, injection detection, D1 message persistence (mock AI) |
| 3B2 | Workers AI integration — real LLM inference, conversation history context, `latency_ms` tracking |
| 3C0 | Documentation: `CLAUDE.md`, `BACKLOG.md`, `memory/DECISIONS.md` |
| 3C | KV rate limiting — per-IP session cap, per-IP chat cap, global daily cap, session message hard cap |
| 3D | Cloudflare Turnstile verification on `/api/chat` after message threshold; dev bypass token |
| 4A | Frontend (Portfolio_001): chat UI connected to backend `/api/session` and `/api/chat` |
| 4B | Frontend (Portfolio_001): Turnstile widget wired to `turnstile_required` flag |
| 5A | `POST /api/lead` — CSRF-validated lead capture, D1 insert, per-IP KV rate limit |
| 5B | Frontend (Portfolio_001): lead capture form submits to `/api/lead` |
| 5C | Resend email notification to Mihir on new lead; `email_sent` flag in D1; non-fatal on failure |

---

## Next phase: 6B — Production deployment

Pre-deployment checklist complete (Phase 6A). Ready for production deployment:
- Run remote D1 migration
- Set all production secrets via `wrangler secret put`
- Deploy Worker with `wrangler deploy`
- Run production smoke tests
- Verify production CORS origins
- Update frontend production API URL if needed

---

## What not to build yet

- **Visitor confirmation email** — post-MVP (Phase 6+)
- **Conversation summarization** — Phase 6+
- **Analytics dashboard** — Phase 6+
- **Auth for admin routes** — Phase 6+
- **Streaming AI responses** — post-MVP
- **Multi-language support** — post-MVP
- **Frontend code in this repo** — never

---

## Production checklist (Phase 6B)

Run these steps in order before going live:

1. **Remote D1 migration**
   ```bash
   npx wrangler d1 execute mihir_ai --remote --file ./migrations/0001_init.sql
   ```

2. **Set production secrets** (each requires confirmation)
   ```bash
   npx wrangler secret put SESSION_HMAC_KEY
   npx wrangler secret put IP_HASH_SALT
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put LEAD_NOTIFY_TO
   npx wrangler secret put LEAD_NOTIFY_FROM
   ```

3. **Replace KV namespace ID in `wrangler.toml`**
   ```bash
   npx wrangler kv namespace list
   # Replace YOUR_KV_NAMESPACE_ID_HERE with the real ID
   ```

4. **Deploy Worker**
   ```bash
   npx wrangler deploy
   ```

5. **Production smoke tests**
   ```bash
   # Health check
   curl https://mihir-ai-worker.<your-subdomain>.workers.dev/health
   # Session creation
   curl -X POST https://mihir-ai-worker.<your-subdomain>.workers.dev/api/session \
     -H "Content-Type: application/json" -d '{}'
   ```

6. **Verify production CORS** — confirm `cors.ts` allows `mihirtrivedi.tech` and
   `www.mihirtrivedi.tech` only (no localhost in production).

7. **Frontend production config** — confirm `Portfolio_001` points to the production
   Worker URL, not localhost.

---

## Local development

```bash
# Copy example secrets file and fill in values
cp .dev.vars.example .dev.vars

# Reset and apply D1 migration locally
rm -rf .wrangler/state/v3/d1
npx wrangler d1 execute mihir_ai --local --file ./migrations/0001_init.sql

# Start local dev server (no AI)
npm run dev

# Start with Workers AI enabled (connects to Cloudflare preview, not production)
npx wrangler dev --remote
```

Required `.dev.vars` keys: `SESSION_HMAC_KEY`, `IP_HASH_SALT`

Optional `.dev.vars` keys (leave unset to use dev bypasses):
- `TURNSTILE_SECRET_KEY` — omit to use `"dev-turnstile-token"` bypass
- `RESEND_API_KEY`, `LEAD_NOTIFY_TO`, `LEAD_NOTIFY_FROM` — omit to skip email (lead still saved)
