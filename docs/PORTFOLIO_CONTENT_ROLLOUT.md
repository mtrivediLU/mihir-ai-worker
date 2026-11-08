# Public portfolio content update — 2026-11-08

This branch prepares public knowledge for the redesigned portfolio. It is not deployed.

Source baseline: `94f2868777943543226ac54dc76bab8a2c347958`.
Source backup tag: `backup/source-before-portfolio-branding-2026-11-08`.

The profile, corpus and prompt wording now use the Toronto-based Data & Analytics Consultant identity and industry experience since 2017. They omit the public phone number, detailed employment dates, identifiable client projects, unsupported numerical outcomes and immediate-availability claims. Credentials distinguish historical certification evidence, an AZ-305 exam pass and OCAP course completion. No API routes, CORS rules, CSRF/session code, rate limits, Turnstile verification, storage schema or retrieval algorithms were changed.

Validation: `npm run typecheck` and all 22 `npm test` tests pass. The chunk-statistics fixture was updated for the revised corpus (25 chunks), and two tests cover the public profile and privacy wording in both prompt paths.

## Release gates

- Cloudflare authentication must be restored. `wrangler whoami` reported an expired authentication refresh and `Not logged in` during this task.
- Record the actual active Worker version before deployment. The source backup above is not a verified production Worker version.
- Regenerate embeddings using the existing indexing workflow, verify content hashes and evaluate retrieval against the revised corpus. Existing `data/index.json`, `data/seed.sql` and local embedding caches still describe the old corpus and were deliberately not regenerated with fake embeddings.
- Back up the current public retrieval tables before replacement. Only replace the retrieval tables; preserve sessions, messages, leads, KV state, secrets and infrastructure.
- Complete the frontend's required media and browser checks before coordinating the production release.
- After deployment, verify both availability/privacy questions and normal technical answers through the real widget. Prompt wording is guidance, not a deterministic guarantee; model behavior must be checked.

No production content, data or Worker configuration was modified in this task. The live API check confirmed session creation and a real answer, production-origin CORS and invalid-CSRF rejection. The sampled answer lacked citation metadata, so the active response mode must be verified rather than inferred from this checkout's RAG flag.
