import type { Env } from "../types";

// ─── Row types (match D1 schema exactly) ──────────────────────────────────────

export interface Session {
  id: string;
  created_at: number;
  last_active_at: number;
  ip_hash: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  asn: number | null;
  asn_name: string | null;
  user_agent_family: string | null;
  referrer: string | null;
  landing_path: string | null;
  csrf_secret: string | null;
  message_count: number;
  intent: string | null;
  intent_confidence: number | null;
  ended_at: number | null;
}

export interface Message {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: number;
  tokens_in: number | null;
  tokens_out: number | null;
  model: string | null;
  latency_ms: number | null;
  feedback: string | null;
}

export interface Lead {
  id: number;
  session_id: string | null;
  created_at: number;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  reason: string | null;
  intent: string | null;
  opt_in_email: number;      // 0 | 1
  follow_up_status: string;
  notes: string | null;
  email_sent: number;        // 0 | 1
}

export interface Summary {
  session_id: string;
  summary: string;
  key_topics: string | null; // JSON array
  created_at: number;
  model: string | null;
}

export interface AnalyticsEvent {
  id: number;
  session_id: string | null;
  event_type: string;
  payload: string | null; // JSON blob
  created_at: number;
}

export interface DailyMetric {
  date: string;            // YYYY-MM-DD
  total_visitors: number;
  unique_visitors: number;
  chat_sessions: number;
  chat_messages: number;
  leads: number;
  leads_by_intent: string | null;  // JSON object
  top_questions: string | null;    // JSON array
  countries: string | null;        // JSON object
  conversion_rate: number;
}

// ─── Input types (fields caller must supply; defaults handled by D1) ───────────

export type SessionInsert = Omit<
  Session,
  "created_at" | "last_active_at" | "message_count" | "intent" | "intent_confidence" | "ended_at"
>;

export type MessageInsert = Omit<Message, "id" | "created_at">;

export type LeadInsert = Omit<Lead, "id" | "created_at">;

// ─── Helper stubs ─────────────────────────────────────────────────────────────

export async function createSession(
  env: Env,
  session: SessionInsert,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO sessions
       (id, ip_hash, country, region, city, asn, asn_name,
        user_agent_family, referrer, landing_path, csrf_secret)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      session.id,
      session.ip_hash,
      session.country,
      session.region,
      session.city,
      session.asn,
      session.asn_name,
      session.user_agent_family,
      session.referrer,
      session.landing_path,
      session.csrf_secret,
    )
    .run();
}

export async function getSession(
  env: Env,
  id: string,
): Promise<Session | null> {
  const row = await env.DB.prepare(
    `SELECT id, created_at, last_active_at, ip_hash, country, region, city,
            asn, asn_name, user_agent_family, referrer, landing_path,
            csrf_secret, message_count, intent, intent_confidence, ended_at
     FROM sessions WHERE id = ?`,
  )
    .bind(id)
    .first<Session>();
  return row ?? null;
}

export async function touchSession(
  env: Env,
  id: string,
  messageIncrement = 0,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE sessions
     SET last_active_at = unixepoch(), message_count = message_count + ?
     WHERE id = ?`,
  )
    .bind(messageIncrement, id)
    .run();
}

export async function insertMessage(
  env: Env,
  message: MessageInsert,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO messages
       (session_id, role, content, tokens_in, tokens_out, model, latency_ms, feedback)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      message.session_id,
      message.role,
      message.content,
      message.tokens_in,
      message.tokens_out,
      message.model,
      message.latency_ms,
      message.feedback,
    )
    .run();
}

export async function getSessionMessages(
  env: Env,
  sessionId: string,
  limit = 50,
): Promise<Message[]> {
  // Inner query fetches the last `limit` rows descending; outer re-sorts ascending
  // so callers always receive messages in chronological order.
  const result = await env.DB.prepare(
    `SELECT * FROM (
       SELECT id, session_id, role, content, created_at,
              tokens_in, tokens_out, model, latency_ms, feedback
       FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?
     ) ORDER BY created_at ASC`,
  )
    .bind(sessionId, limit)
    .all<Message>();
  return result.results;
}

export async function insertLead(
  env: Env,
  lead: LeadInsert,
): Promise<number> {
  const result = await env.DB.prepare(
    `INSERT INTO leads
       (session_id, name, email, phone, organization, reason, intent,
        opt_in_email, follow_up_status, notes, email_sent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      lead.session_id,
      lead.name,
      lead.email,
      lead.phone,
      lead.organization,
      lead.reason,
      lead.intent,
      lead.opt_in_email,
      lead.follow_up_status,
      lead.notes,
      lead.email_sent,
    )
    .run();
  return result.meta.last_row_id as number;
}

export async function markLeadEmailSent(
  env: Env,
  leadId: number,
): Promise<void> {
  await env.DB.prepare(`UPDATE leads SET email_sent = 1 WHERE id = ?`)
    .bind(leadId)
    .run();
}

export async function upsertSummary(
  _env: Env,
  _summary: Omit<Summary, "created_at">,
): Promise<void> {
  throw new Error("TODO: implement upsertSummary");
}

export async function insertAnalyticsEvent(
  _env: Env,
  _sessionId: string | null,
  _eventType: string,
  _payload?: Record<string, unknown>,
): Promise<void> {
  throw new Error("TODO: implement insertAnalyticsEvent");
}

export async function upsertDailyMetric(
  _env: Env,
  _metric: Partial<DailyMetric> & { date: string },
): Promise<void> {
  throw new Error("TODO: implement upsertDailyMetric");
}
