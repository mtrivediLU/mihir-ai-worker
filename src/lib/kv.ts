import type { Env } from "../types";

// ─── Result type ───────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  remaining: number;
  retryAfterSeconds: number;
}

// ─── Rate limit configurations ─────────────────────────────────────────────────

export const RATE_LIMITS = {
  SESSION_PER_IP: { limit: 10,   windowMs: 60 * 60 * 1000 },        // 10   per hour
  CHAT_PER_IP:    { limit: 30,   windowMs: 10 * 60 * 1000 },        // 30   per 10 min
  CHAT_GLOBAL:    { limit: 5000, windowMs: 24 * 60 * 60 * 1000 },   // 5000 per day
  LEAD_PER_IP:    { limit: 3,    windowMs: 60 * 60 * 1000 },        // 3    per hour
  SESSION_MSG_CAP: 50, // hard cap: total messages stored per session (D1-based)
} as const;

// ─── KV key prefix builders ────────────────────────────────────────────────────

export const RL_KEYS = {
  sessionIp: (id: string) => `rl:session:ip:${id}`,
  chatIp:    (id: string) => `rl:chat:ip:${id}`,
  chatGlobal: ()          => `rl:chat:global`,
  leadIp:    (id: string) => `rl:lead:ip:${id}`,
} as const;

// ─── Core helper ──────────────────────────────────────────────────────────────
//
// Uses a time-bucketed key (prefix:bucketNumber) so each fixed window gets its
// own KV entry that expires at the end of the window. This avoids the TTL-reset
// problem that occurs when you always write to the same key.
//
// Non-atomic: KV does not support atomic increment. Two concurrent requests may
// both read the same count and both be allowed. For a low-traffic portfolio
// chatbot this is an acceptable trade-off. Do not use this for financial limits.
//
// Fails open on any KV error. A KV outage will not block visitor traffic.

export async function incrementRateLimit(
  env: Env,
  keyPrefix: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const bucketStartMs = bucket * windowMs;
  const remainingMs = windowMs - (now - bucketStartMs);
  const ttlSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const key = `${keyPrefix}:${bucket}`;

  // Read current count
  let current = 0;
  try {
    const raw = await env.RL.get(key);
    current = raw !== null ? (parseInt(raw, 10) || 0) : 0;
  } catch (err) {
    console.warn(`[RL] KV get failed for "${key}", failing open:`, err);
    return { allowed: true, current: 0, remaining: limit, retryAfterSeconds: 0 };
  }

  // Reject if already at or over limit
  if (current >= limit) {
    return { allowed: false, current, remaining: 0, retryAfterSeconds: ttlSeconds };
  }

  // Increment
  try {
    await env.RL.put(key, String(current + 1), { expirationTtl: ttlSeconds });
  } catch (err) {
    console.warn(`[RL] KV put failed for "${key}", failing open:`, err);
    // Allow the request even if the write fails
  }

  const next = current + 1;
  return {
    allowed: true,
    current: next,
    remaining: limit - next,
    retryAfterSeconds: 0,
  };
}

// ─── Standard 429 response ────────────────────────────────────────────────────

export function tooManyRequests(retryAfterSeconds: number, message?: string): Response {
  return Response.json(
    { error: message ?? "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}