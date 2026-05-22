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
  _env: Env,
  _id: string,
): Promise<void> {
  throw new Error("TODO: implement touchSession");
}

export async function insertMessage(
  _env: Env,
  _message: MessageInsert,
): Promise<void> {
  throw new Error("TODO: implement insertMessage");
}

export async function getSessionMessages(
  _env: Env,
  _sessionId: string,
  _limit?: number,
): Promise<Message[]> {
  throw new Error("TODO: implement getSessionMessages");
}

export async function insertLead(
  _env: Env,
  _lead: LeadInsert,
): Promise<void> {
  throw new Error("TODO: implement insertLead");
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
