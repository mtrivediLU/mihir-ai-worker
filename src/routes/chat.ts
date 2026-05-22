import type { Env } from "../types";
import { verifyHmac } from "../lib/crypto";
import { getSession, insertMessage, touchSession } from "../lib/d1";
import { INJECTION_PATTERNS, REFUSAL_RESPONSE } from "../lib/prompts";
import { PROFILE } from "../lib/profile";

// ─── Mock response ─────────────────────────────────────────────────────────────
// Replaced by real AI in Phase 3B2. Uses profile data so responses are useful
// even in mock mode.

function buildMockReply(message: string): string {
  const q = message.toLowerCase();

  if (/availab|open to|looking|hire|opportun|interview/.test(q)) {
    return (
      `${PROFILE.availability} ` +
      `You can reach Mihir directly at ${PROFILE.contact.email}.`
    );
  }

  if (/skill|tech|stack|language|tool|know/.test(q)) {
    const top = PROFILE.skills.slice(0, 8).join(", ");
    return (
      `Mihir's core technical skills include ${top}, and more. ` +
      `He has deep experience in both data engineering and full-stack development.`
    );
  }

  if (/experienc|work|career|background|role|job/.test(q)) {
    const latest = PROFILE.experience[0];
    return (
      `Mihir's most recent role is ${latest.role} at ${latest.company} ` +
      `(${latest.period}). ${PROFILE.summary}`
    );
  }

  if (/certif|credential|microsoft|salesforce|azure/.test(q)) {
    const names = PROFILE.certifications.map((c) => c.name).join("; ");
    return `Mihir holds ${PROFILE.certifications.length} active certifications: ${names}.`;
  }

  if (/educat|degree|school|universit|master|bachelor/.test(q)) {
    const edu = PROFILE.education
      .map((e) => `${e.degree} from ${e.institution} (${e.years})`)
      .join(", and ");
    return `Mihir's academic background: ${edu}.`;
  }

  if (/contact|email|reach|connect/.test(q)) {
    return (
      `You can reach Mihir at ${PROFILE.contact.email} ` +
      `or connect on LinkedIn: ${PROFILE.contact.linkedin}.`
    );
  }

  // Default
  return (
    `Hi! I'm Mihir's AI assistant. ${PROFILE.summary} ` +
    `He's ${PROFILE.availability.toLowerCase()} ` +
    `Feel free to ask about his experience, skills, or certifications!`
  );
}

// ─── Helper: store a message pair and touch the session ────────────────────────

async function persistTurn(
  env: Env,
  sessionId: string,
  userContent: string,
  assistantContent: string,
  assistantModel: string,
): Promise<void> {
  await insertMessage(env, {
    session_id: sessionId,
    role: "user",
    content: userContent,
    tokens_in: null,
    tokens_out: null,
    model: null,
    latency_ms: null,
    feedback: null,
  });

  await insertMessage(env, {
    session_id: sessionId,
    role: "assistant",
    content: assistantContent,
    tokens_in: null,
    tokens_out: null,
    model: assistantModel,
    latency_ms: null,
    feedback: null,
  });

  await touchSession(env, sessionId, 2);
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function handleChat(
  request: Request,
  env: Env,
): Promise<Response> {
  // 1. Require HMAC key — fail fast with a clear dev message
  if (!env.SESSION_HMAC_KEY) {
    return Response.json(
      { error: "Server misconfiguration: SESSION_HMAC_KEY is not set." },
      { status: 500 },
    );
  }

  // 2. Parse and validate JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const { session_id, csrf_token, message } = body as Record<string, unknown>;

  if (typeof session_id !== "string" || !session_id.trim()) {
    return Response.json({ error: "session_id is required" }, { status: 400 });
  }
  if (typeof csrf_token !== "string" || !csrf_token.trim()) {
    return Response.json({ error: "csrf_token is required" }, { status: 400 });
  }
  if (typeof message !== "string") {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return Response.json({ error: "message cannot be empty" }, { status: 400 });
  }
  if (trimmedMessage.length > 2000) {
    return Response.json(
      { error: "message too long (max 2000 characters)" },
      { status: 400 },
    );
  }

  // 3. Look up session
  let session;
  try {
    session = await getSession(env, session_id.trim());
  } catch (err) {
    console.error("getSession failed:", err);
    return Response.json({ error: "Failed to look up session" }, { status: 500 });
  }

  if (!session) {
    return Response.json({ error: "Invalid session" }, { status: 401 });
  }

  if (session.ended_at !== null) {
    return Response.json({ error: "Session has ended" }, { status: 401 });
  }

  // 4. Verify CSRF token
  if (!session.csrf_secret) {
    return Response.json({ error: "Invalid session" }, { status: 401 });
  }

  const csrfValid = await verifyHmac(
    env.SESSION_HMAC_KEY,
    `${session.id}.${session.csrf_secret}`,
    csrf_token.trim(),
  );

  if (!csrfValid) {
    return Response.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  // 5. Detect prompt injection — store both messages but return the refusal
  const isInjection = INJECTION_PATTERNS.some((pattern) =>
    pattern.test(trimmedMessage),
  );

  if (isInjection) {
    try {
      await persistTurn(env, session.id, trimmedMessage, REFUSAL_RESPONSE, "refusal");
    } catch (err) {
      console.error("persistTurn (injection) failed:", err);
    }
    return Response.json({ reply: REFUSAL_RESPONSE, session_id: session.id });
  }

  // 6. Build mock reply, persist turn, respond
  const reply = buildMockReply(trimmedMessage);

  try {
    await persistTurn(env, session.id, trimmedMessage, reply, "mock");
  } catch (err) {
    console.error("persistTurn failed:", err);
    return Response.json({ error: "Failed to save message" }, { status: 500 });
  }

  return Response.json({ reply, session_id: session.id });
}
