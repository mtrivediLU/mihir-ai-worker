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
- `src/cors.ts` — CORS allowed-origins list and preflight handler
- `src/types.ts` — `Env` interface (bindings + secrets all typed here)
- `src/routes/health.ts` — GET /health handler

Stack: Wrangler 3, TypeScript strict, `@cloudflare/workers-types`.
