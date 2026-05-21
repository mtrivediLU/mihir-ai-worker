---
name: project-phase1
description: Mihir AI Worker — Phase 1 foundation complete; Cloudflare Worker with /health endpoint
metadata:
  type: project
---

Phase 1 complete as of 2026-05-21. Clean TypeScript Cloudflare Worker project scaffolded from scratch.

**Why:** Building a backend worker for Mihir's AI portfolio chatbot. Separate repo from portfolio site (mihir-ai-worker). Phase 0 (Cloudflare D1, KV, Turnstile, Resend, AWS Route 53) already done.

**How to apply:** Next phases will add D1 schema, Turnstile/Resend integrations, and AI chat. Keep bindings commented in wrangler.toml until each service is wired up.

Key structure:
- `src/index.ts` — Worker entry point, applies CORS headers to all responses
- `src/router.ts` — Simple pathname/method router
- `src/cors.ts` — CORS allowed-origins: localhost:5500, 127.0.0.1:5500, mihirtrivedi.tech (user-adjusted)
- `src/types.ts` — `Env` interface (DB, ENV, SESSION_HMAC_KEY, IP_HASH_SALT, etc.)
- `src/routes/health.ts` — GET /health
- `src/routes/debug.ts` — GET /debug/profile?token=dev (dev-only, requires both env.ENV==="dev" AND ?token=dev)
- `src/lib/profile.ts` — Profile interface + PROFILE constant (from portfolio HTML) + PROFILE_TEXT (~7252 chars)
- `src/lib/prompts.ts` — SYSTEM_PROMPT_CHAT, REFUSAL_RESPONSE, INJECTION_PATTERNS
- `src/lib/d1.ts` — Typed row interfaces + stub helpers for all D1 operations
- `src/lib/crypto.ts` — signHmac, verifyHmac, hashIp (Web Crypto SHA-256)
- `migrations/0001_init.sql` — Full D1 schema: sessions, messages, leads, summaries, analytics_events, daily_metrics + 9 indexes

D1 database: mihir_ai (id: 06c57d13-f79e-4d3a-b7df-54b7ef9e7aa1)
Stack: Wrangler 3, TypeScript strict, `@cloudflare/workers-types`.
