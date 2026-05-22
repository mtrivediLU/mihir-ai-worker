# CLAUDE.md — mihir-ai-worker

Cloudflare Worker backend for Mihir Trivedi's AI portfolio chatbot.
TypeScript, strict mode, Wrangler 4, zero external npm dependencies at runtime.

---

## Project purpose

Serve a conversational AI assistant embedded in Mihir's portfolio site
(`mihirtrivedi.tech`). Visitors — primarily recruiters, founders, and professional
contacts — can ask questions about Mihir's background, skills, and availability.
The backend handles sessions, CSRF protection, AI inference, and (future) lead
capture and email follow-up.

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
| Cloudflare KV | `KV` | Rate limiting and abuse counters (Phase 3C) |
| Cloudflare Workers AI | `AI` | LLM inference (`@cf/meta/llama-3.1-8b-instruct`) |
| Cloudflare Turnstile | secret | Bot protection on session creation (Phase 3D) |
| Resend | secret | Lead-capture confirmation email (Phase 3D) |
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
| POST | `/api/chat` | ✅ Live | CSRF-validated chat turn backed by Workers AI |
| POST | `/api/lead` | 🔜 Phase 3D | Lead capture with Turnstile + Resend |

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
    profile.ts      PROFILE constant (from portfolio HTML) + PROFILE_TEXT
    prompts.ts      SYSTEM_PROMPT_CHAT, REFUSAL_RESPONSE, INJECTION_PATTERNS

  routes/
    health.ts       GET /health
    debug.ts        GET /debug/profile (dev-only)
    session.ts      POST /api/session
    chat.ts         POST /api/chat

migrations/
  0001_init.sql     Full D1 schema (6 tables, 9 indexes)
```

---

## Security non-negotiables

These checks must not be removed or reordered:

1. **CSRF before any state change** — every `/api/chat` (and future mutation routes)
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

## What is done (Phases 0 – 3B2)

| Phase | Description |
|---|---|
| 0 | Cloudflare D1, KV, Turnstile, Resend, AWS Route 53 provisioned |
| 1 | Worker scaffold: TypeScript, CORS, `/health`, router |
| 2 | D1 schema, `profile.ts`, `prompts.ts`, `d1.ts` stubs, `crypto.ts` |
| 3A | `POST /api/session` — session creation, CSRF generation, IP hashing, geo metadata |
| 3B1 | `POST /api/chat` — CSRF validation, injection detection, D1 message persistence (mock AI) |
| 3B2 | Workers AI integration — real LLM inference, conversation history context, `latency_ms` tracking |

---

## Next phase: 3C — KV rate limiting

Implement abuse protection before any public exposure:
- Per-IP sliding-window rate limit on `POST /api/session`
- Per-session message-count hard cap on `POST /api/chat`
- Use the `KV` binding (already provisioned in Phase 0)
- Return `429 Too Many Requests` with `Retry-After` header

---

## What not to build yet

- **KV rate limiting** — Phase 3C
- **Turnstile bot protection** — Phase 3D
- **Resend lead-capture email** — Phase 3D
- **`POST /api/lead`** — Phase 3D
- **Conversation summarization** — Phase 4
- **Analytics dashboard** — Phase 4
- **Auth for admin routes** — Phase 4
- **Streaming AI responses** — post-MVP
- **Multi-language support** — post-MVP
- **Frontend code in this repo** — never

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
