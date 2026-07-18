# Mihir AI — Interview Cheatsheet

A fast pre-interview refresher. Full depth and verification: [`MIHIR_AI_COMPLETE_GUIDE.md`](./MIHIR_AI_COMPLETE_GUIDE.md).

---

## 30-second project explanation

"I built an AI chatbot for my portfolio that answers recruiter questions about my background. The frontend's a static site with a vanilla JS widget; the backend's a Cloudflare Worker handling security — sessions, CSRF, rate limiting, bot protection — then retrieval-augmented generation: hybrid vector-plus-keyword search over my profile content, a Llama model answering from the top passages, and citation validation before anything reaches the user. It also detects hiring intent and captures leads with email notifications."

## 60-second project explanation

"It's two repos. `Portfolio_001` is a static, no-build-step site on GitHub Pages with a self-contained chat widget — vanilla JS, talks to my backend over `fetch`, keeps its session in `sessionStorage`, no cookies. `mihir-ai-worker` is a Cloudflare Worker in TypeScript with zero runtime npm dependencies, using D1 for relational data and KV for rate limits.

Every mutating request needs a CSRF token signed with HMAC at session creation. Rate limits run in KV with time-bucketed keys. Cloudflare Turnstile kicks in after five messages. Every message hits a regex injection filter before the model is ever called.

The AI itself is RAG: my profile is five Markdown files chunked into 21 passages, embedded and stored as vectors in D1. A question triggers hybrid vector-plus-keyword search, fused with Reciprocal Rank Fusion, reranked by the LLM, and the top five passages go into the prompt with a rule that every claim must cite its source — citations are then validated server-side, and anything invented gets stripped and logged. There's a golden evaluation set with measured recall/MRR, all behind a feature flag for safe rollout."

## 90-second architecture explanation

"Request enters `src/index.ts`, which wraps every response — even errors — with CORS headers, then `router.ts` does plain path/method matching to one of five handlers, no framework. `/api/chat` is the core one: it looks up the session in D1, verifies the CSRF token in constant time, checks a D1-based hard message cap, runs two KV rate limits (global and per-IP), requires Turnstile once the session's crossed five messages, and runs the message past a static regex injection filter — all *before* touching the AI model. Then, if the `RAG_ENABLED` flag is on, it calls `retrieve()`: embed the question, run exact vector search and FTS5 keyword search in parallel, fuse with Reciprocal Rank Fusion, optionally rerank with the LLM, and hand the top five chunks to the generation call. The model's citations are checked against what was actually retrieved before the response goes out, and both messages get persisted to D1. Nothing in the pipeline lets the model trigger a side effect directly — email, D1 writes, and external calls are all coded explicitly in route handlers, never invoked by model output."

## 90-second RAG explanation

"A plain LLM is a closed-book exam — it knows nothing about me specifically. RAG makes it open-book: search a small knowledge base first, then answer only from what was found, with citations. My profile is five Markdown files split by heading into 21 chunks, each embedded with a Cloudflare BGE model into a 768-dimension vector, normalized and stored as a BLOB in D1.

At query time, I run two searches in parallel: exact vector search — a dot product against all 21 chunks, since 21 is small enough that a linear scan is sub-millisecond — and SQLite FTS5 keyword search with BM25 ranking, which catches exact terms vector search can miss, like a certification code. I fuse the two ranked lists with Reciprocal Rank Fusion rather than averaging scores, because vector and BM25 scores live on incomparable scales — RRF only needs each list's rank order. The fused top candidates go through one more pass: the LLM itself reranks them, which measurably improved my ranking quality (MRR from 0.958 to 0.982 in my evaluation). The final five chunks go into the prompt with a rule that every claim needs a bracketed citation ID, and after generation I regex-extract every citation and drop anything that wasn't actually in the retrieved set — logged as a hallucination, never shown to the user."

## 60-second Cloudflare explanation

"I chose Cloudflare because Workers, D1, KV, and Workers AI are all first-party products behind one CLI and one credential set — no separate signups or cross-cloud latency to stitch together for a small project. Workers run in a V8 isolate rather than a container, so there's no cold start, and it's serverless — I never provision anything. D1 is hosted SQLite, and it happens to ship FTS5, so my keyword search lives in the same database as my application data with zero extra infrastructure. Workers AI gives me both the chat model and the embedding model without a separate API key or external network hop. The honest tradeoff is vendor coupling — I had to use the Web Crypto API instead of Node's `crypto` module because Workers don't expose Node's standard library — and D1 is younger than a managed Postgres, fine at my scale but not a given choice for high write volume or complex relations."

## 60-second security explanation

"Security is layered and each layer defends against a different attacker. CORS restricts which origins can even call the API. CSRF is an HMAC token signed at session creation and checked in constant time before any write — it proves the request came from a client that legitimately has the session's secret. Rate limiting uses time-bucketed KV keys so each window gets its own expiring counter. Turnstile blocks scripted bots once a session looks automated, after five messages. A static regex filter catches direct prompt-injection attempts *before* the model is ever called — the model never has to police itself. For RAG specifically, retrieved content is explicitly framed in the system prompt as reference material, never instructions, and every citation in the model's answer is checked against what was actually retrieved — anything invented is stripped and logged, not shown. I'm upfront that one piece — a lexical-overlap groundedness check — is currently observability-only, not a hard gate; that's a documented limitation, not something I'm hiding."

## 60-second evaluation explanation

"I built a 35-question golden dataset with expected source chunks for each question, plus refusal and prompt-injection cases. `eval/run.js` runs the real retrieval code against a real (Miniflare) D1 instance and live Workers AI — not a mock — across four modes: vector-only, keyword-only, hybrid, and hybrid-with-rerank. All four hit perfect Recall@5; reranking gave the best MRR at 0.982. Refusal and injection pass rates were both 1.0. I'm careful to say this doesn't prove real-world performance at scale — it's 21 chunks about one person's résumé, with test questions written by the same person who wrote the content, so it's a controlled proof of the pattern, not a generalization claim."

---

## Architecture keywords
Cloudflare Workers · edge computing · serverless · V8 isolate · D1 (SQLite) · KV · Workers AI · Turnstile · Wrangler · CORS · two-repo separation · no framework/no build step · feature flag (`RAG_ENABLED`)

## RAG keywords
chunking · frontmatter · embedding (768-dim, BGE) · L2 normalization · Float32 BLOB · exact/linear-scan vector search · dot product = cosine similarity at unit length · FTS5 · BM25 · Reciprocal Rank Fusion (k=60) · reranking · citation validation · hallucinated citation · log-only groundedness · golden dataset · Recall@5 · MRR

## Security keywords
CSRF (HMAC-SHA256, constant-time compare) · rate limiting (time-bucketed KV) · Turnstile · prompt-injection filter (regex, pre-model) · indirect/retrieved-context injection · IP hashing (SHA-256 + salt) · CORS (environment-aware) · secrets via `wrangler secret put` · fail-open (rate limits) vs. fail-closed (Turnstile)

## Metrics table

| Metric | Result |
|---|---|
| Recall@5 (all 4 retrieval modes) | 1.0000 |
| MRR — vector-only | 0.9643 |
| MRR — keyword-only | 0.8988 |
| MRR — hybrid, no rerank | 0.9583 |
| MRR — hybrid + rerank | 0.9821 |
| Refusal pass rate | 1.0000 |
| Prompt-injection pass rate | 1.0000 |
| Retrieved-context-injection pass rate | 1.0000 (2/2 fixtures) |
| Corpus size | 5 documents / 21 chunks / 768-dim embeddings |

*(Source: PR #2, "fix: complete RAG evaluation and production rollout" — a live run against production Workers AI.)*

## Ten likely follow-up questions

1. "Why not just use a vector database like Pinecone?" → Overkill at 21 chunks; exact linear scan is sub-millisecond and simpler to operate. Would reconsider past a few thousand chunks.
2. "What happens if two people hit the rate limiter at the exact same millisecond?" → KV isn't atomic, so both could pass — an accepted tradeoff for a low-traffic portfolio bot, documented directly in the code.
3. "Could the model still leak the system prompt?" → The prompt explicitly forbids revealing itself, but that's model behavior, not a hard guarantee — the actual hard control is that injection attempts never reach the model at all.
4. "What if the LLM reranker call fails?" → Falls back to the RRF-fused order; the request never fails because of it.
5. "How do you know citations are real and not just well-formatted?" → They're checked against the exact set of chunk IDs retrieved for that request, server-side, after generation.
6. "Does the frontend show sources to the user?" → Not yet — the API already returns `citations`/`retrieved`, but the current widget only renders `reply`. Deliberately deferred, backend-first.
7. "What stops someone from resending the same request to spam leads?" → CSRF token requirement plus a 3/hour per-IP rate limit on `/api/lead`.
8. "Why keep both `reply` and `answer` in the response?" → Backward compatibility — the existing frontend was written before RAG and only reads `reply`.
9. "What's the biggest unproven assumption in your evaluation?" → That performance holds beyond a 21-chunk, single-author, single-topic corpus — explicitly flagged as unproven in the guide and the merge PR itself.
10. "How would you add a second person's profile to this?" → Would need new `doc_id`s in `content/`, and a real look at multi-tenant isolation, which the guide is honest about not being solved today.

## Mistakes to avoid when discussing the project

- Don't call the groundedness check a hard safety gate — it's observability-only; the actual gate is citation-ID validation. Overstating this is the single easiest thing to get caught on.
- Don't claim the frontend shows citations — it doesn't, even though the backend sends them.
- Don't present the 1.0 Recall@5 as proof the system "works perfectly" — it's a small, hand-curated, single-author corpus; say so before being asked.
- Don't say there's a login/authentication system — there isn't; sessions are anonymous, and CSRF protection is not the same thing as authentication.
- Don't say deployment is automated — there's no CI/CD in either repo; deploys are a manual `wrangler deploy`.
- Don't confuse the injection filter (blocks user messages) with the retrieved-context framing (protects against a poisoned chunk) — they're two different defenses for two different attack vectors.
