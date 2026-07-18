# Mihir AI — Glossary

Every important term used across the project, one row each. Full context: [`MIHIR_AI_COMPLETE_GUIDE.md`](./MIHIR_AI_COMPLETE_GUIDE.md).

| Term | Plain-English meaning | Meaning in this project | Example |
|---|---|---|---|
| API | A contract letting programs talk to each other over HTTP | Five routes exposed by the Worker | `POST /api/chat` |
| Backend | Server-side code, holds secrets and data | `mihir-ai-worker`, a Cloudflare Worker | `src/index.ts` |
| BLOB | Raw, uninterpreted binary data stored in a database column | An embedding vector stored as bytes | `chunks.embedding` column |
| BM25 | A keyword-ranking formula rewarding rare, exact term matches | Used by D1's FTS5 to rank keyword search results | `bm25(chunks_fts)` in `keywordSearch()` |
| Bot protection | Distinguishing a human from an automated script | Cloudflare Turnstile, required after 5 chat messages | `src/lib/turnstile.ts` |
| Chunk | A retrievable passage of text | One `##` section (or piece of one) from a content file | `experience#0` |
| Chunking | Splitting a document into smaller retrievable pieces | Heading-based split with paragraph-boundary overlap for oversized sections | `scripts/chunk.js` |
| Citation grounding | Verifying a claim actually traces back to a real source | Bracketed chunk IDs checked against the retrieved set post-generation | `[experience#0]` in an answer |
| Content hash | A fingerprint of text used to detect changes | SHA-256 of the complete `embed_text` (title+heading+content) | `content_hash` field |
| Context window | The amount of text an LLM can consider in one call | Kept small: 6 history messages + 5 chunks + question | `MAX_TOKENS = 512` in `ai.ts` |
| Cookie | Browser-attached data sent automatically to a site | **Not used** — replaced by explicit `session_id`/`csrf_token` | — |
| CORS | Browser rule restricting which sites can call an API | Origin allowlist, environment-aware | `src/cors.ts` |
| CSRF | Attack forging a request using a victim's active session | HMAC-signed token, verified in constant time before any write | `src/lib/crypto.ts: verifyHmac` |
| D1 | Cloudflare's hosted SQLite database | Stores sessions, messages, leads, and the RAG corpus | `DB` binding |
| Database | Storage that persists between requests | Cloudflare D1 | six app tables + two RAG tables |
| Dot product | Sum of element-wise products of two vectors | Similarity score between two normalized embeddings | `dot()` in `retrieval.ts` |
| Edge computing | Running code physically close to the requester, not in one central data center | Cloudflare Workers run at Cloudflare's global points of presence | — |
| Embedding | A numeric vector representing a piece of text's meaning | 768-value vector from `bge-base-en-v1.5` | `embedQuery()` |
| Endpoint | A specific URL a server responds to | `/api/chat`, `/api/lead`, etc. | `src/router.ts` |
| FTS5 | SQLite's built-in full-text-search extension | Powers keyword search over chunk content | `chunks_fts` virtual table |
| Golden dataset | A hand-verified test set with known-correct answers | 35 question/expected-chunk pairs, plus refusal/injection cases | `eval/golden.jsonl` |
| Grounding (log-only) | Checking whether a claim is textually supported by its citation | Deterministic lexical-overlap check; observability only, doesn't block responses | `src/lib/grounding.ts` |
| HMAC | A cryptographic signature proving data wasn't tampered with, using a shared secret | Signs and verifies CSRF tokens | `signHmac`/`verifyHmac` |
| HTTP request/response | The message sent to a server and the reply received | Every `fetch()` call between frontend and Worker | `sendChat()` in `chat.js` |
| Hybrid search | Combining semantic (vector) and lexical (keyword) search | Vector + FTS5 results fused with RRF | `retrieve()` in `retrieval.ts` |
| Injection filter | A pre-check blocking manipulative input before it reaches a model | Static regex array tested before any AI call | `INJECTION_PATTERNS` |
| JSON | A text format for structured data | Every API request/response body | `{"session_id": "...", "citations": [...]}` |
| KV | Cloudflare's key-value store with TTL support | Rate-limit counters only | `RL` binding |
| L2 normalization | Scaling a vector so its length equals 1 | Applied to every embedding so dot product = cosine similarity | `normalize()` in `retrieval.ts` |
| Large language model (LLM) | A neural network trained to predict/generate text | Llama 3.1 8B (FP8), run via Workers AI | `AI_MODEL` constant |
| Lead | A visitor's submitted contact info | Stored in D1, triggers an email notification | `leads` table |
| MRR (Mean Reciprocal Rank) | How close to rank 1 the correct result lands, averaged | Retrieval quality metric in the golden eval | 0.9821 (hybrid + rerank) |
| Prompt | Text given to an LLM to elicit a response | System prompt + history + user question | `messages` array in `ai.ts` |
| RAG | Search first, then generate an answer using what was found | The entire retrieval pipeline behind `/api/chat` | `src/retrieval.ts` |
| Rate limiting | Capping how many requests are allowed in a time window | Time-bucketed KV counters, per-IP and global | `incrementRateLimit()` |
| Recall@5 | Fraction of correct results found within the top 5 | Retrieval quality metric | 1.0000 across all modes |
| Reranking | Re-ordering a candidate set with a more precise (often slower) pass | LLM ranks the fused top ~20 candidates down to 5 | `rerank()` in `retrieval.ts` |
| RRF (Reciprocal Rank Fusion) | Combining ranked lists using rank position, not raw scores | Fuses vector and keyword search results | `rrfFuse()`, `k=60` |
| Route | A URL + HTTP method pair a server handles | Matched with plain `if` statements | `src/router.ts` |
| Semantic similarity | Closeness in meaning rather than exact wording | Measured via embedding dot product | vector search results |
| Serverless | Running code without provisioning or managing a server | Cloudflare Workers execution model | — |
| Session | A way to recognize the same visitor across requests without login | A D1 row keyed by a UUID, referenced by the frontend | `sessions` table |
| System prompt | Instructions given to an LLM before the conversation begins | Sets role, citation rules, and refusal behavior | `SYSTEM_PROMPT_RAG` |
| Turnstile | Cloudflare's CAPTCHA alternative | Verifies a human is present after 5 chat messages | `src/lib/turnstile.ts` |
| Vector | A list of numbers representing a point in embedding space | 768-dimensional array per chunk/query | `Float32Array` |
| Vector search | Finding text with similar meaning via embedding comparison | Exact (linear-scan) dot-product search over 21 chunks | `vectorSearch()` |
| Worker | A serverless function running on Cloudflare's edge | The entire backend | `mihir-ai-worker` |
