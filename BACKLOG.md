# BACKLOG.md — Deferred V2 / V3 Ideas

Items here are intentionally out of scope for MVP (Phases 0–3D).
Nothing below should be built until the core chatbot is live and stable.

---

## Phase 3C — Abuse protection (next)

- **KV sliding-window rate limit on `/api/session`** — cap session creation per IP per minute
- **Per-session message cap** — hard limit on `message_count` before the session is ended
- **`429 Too Many Requests` with `Retry-After` header** — standard response for rate-limited requests

---

## Phase 3D — Lead capture & bot protection

- **Turnstile verification on session creation** — validate the Turnstile token server-side before creating a session
- **`POST /api/lead`** — accept name, email, optional phone/org, reason; write to D1 leads table
- **Resend confirmation email** — send a short email to the visitor confirming their message was received
- **`opt_in_email` flag** — only send email if visitor explicitly opts in

---

## Phase 4 — Intelligence & analytics

- **Conversation summarization** — after N messages, call AI to summarize the session and store in `summaries` table
- **Intent classification** — detect visitor intent (job inquiry, collaboration, general) and store in `sessions.intent`
- **Daily metrics rollup** — scheduled Worker to aggregate `analytics_events` into `daily_metrics`
- **Admin analytics endpoint** — authenticated `GET /admin/metrics` returning daily rollup data
- **Top-questions tracking** — aggregate most common visitor questions for profile/FAQ improvement

---

## V2 — UX improvements

- **Streaming AI responses** — use `stream: true` on `env.AI.run` and return a `ReadableStream` to the frontend for progressive rendering
- **Typing indicator support** — add a short-poll or SSE endpoint for the frontend to show a typing state
- **Message feedback** — `POST /api/feedback` to set `messages.feedback` (thumbs up/down) for quality tracking
- **Session resume** — allow the frontend to reconnect to an existing session within the same browser visit

---

## V2 — Security hardening

- **Session expiry** — automatically set `ended_at` after a configurable idle timeout
- **CSRF token rotation** — issue a new CSRF token after N turns to limit token reuse window
- **Honeypot field on lead form** — server-side check for bot-filled hidden fields
- **Request signing** — HMAC-sign API responses so the frontend can verify they haven't been tampered with

---

## V3 — Multi-model / quality

- **Model upgrade path** — parameterise `AI_MODEL` in `wrangler.toml [vars]` so it can be swapped without code changes
- **Prompt A/B testing** — store `PROMPT_VERSION` in session metadata to evaluate different prompt strategies
- **Fallback model chain** — if primary model is unavailable, try a secondary model before falling back to the static error message
- **Temperature / tone control** — expose a `tone` query param (`formal` / `casual`) that adjusts the system prompt

---

## V3 — Integrations

- **Slack lead notification** — send a Slack message to Mihir when a new lead is captured
- **Google Calendar link** — include a booking link in the lead confirmation email
- **LinkedIn profile enrichment** — optionally pre-fill lead fields from a LinkedIn URL
- **CRM webhook** — push new leads to an external CRM (HubSpot or Salesforce) via webhook

---

## Post-MVP — Infrastructure

- **Staging environment** — separate `wrangler.toml` environment block for staging vs production
- **GitHub Actions CI** — run `npm run typecheck` and `wrangler deploy` on merge to main
- **Automated D1 migrations** — use `wrangler d1 migrations apply` in CI instead of manual `--file` commands
- **Log drain** — forward Worker logs to a log aggregator (Logtail, Axiom) for production observability
- **Custom error pages** — return branded HTML error pages for 404/500 when `Accept: text/html`
