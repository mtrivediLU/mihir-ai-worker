export interface Env {
  // Wrangler vars
  ENVIRONMENT: string;
  VERSION: string;
  ENV: string;
  RAG_ENABLED?: string;

  // D1 database binding
  DB: D1Database;

  // Workers AI binding
  AI: Ai;

  // KV namespace for rate limiting
  RL: KVNamespace;

  // Secrets (set via `wrangler secret put`)
  RESEND_API_KEY?: string;
  LEAD_NOTIFY_TO?: string;
  LEAD_NOTIFY_FROM?: string;
  TURNSTILE_SECRET_KEY?: string;
  SESSION_HMAC_KEY?: string;
  IP_HASH_SALT?: string;
}
