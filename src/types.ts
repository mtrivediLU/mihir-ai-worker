export interface Env {
  // Wrangler vars
  ENVIRONMENT: string;
  VERSION: string;

  // Bindings (uncomment as they are added)
  // KV: KVNamespace;
  // DB: D1Database;

  // Secrets (set via `wrangler secret put`)
  // RESEND_API_KEY: string;
  // TURNSTILE_SECRET_KEY: string;
}
