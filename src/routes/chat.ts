import type { Env } from "../types";
import { verifyHmac } from "../lib/crypto";
import type { Message } from "../lib/d1";
import { getSession, getSessionMessages, insertMessage, touchSession } from "../lib/d1";
import { INJECTION_PATTERNS, REFUSAL_RESPONSE } from "../lib/prompts";
import { getAiReply } from "../lib/ai";

// ─── Helper: persist a user+assistant turn and update the session ──────────────

async function persistTurn(
  env: Env,
  sessionId: string,
  userContent: string,
  assistantContent: string,
  assistantModel: string,
  latencyMs: number | null,
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
    latency_ms: latencyMs,
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

  // 5. Detect prompt injection — log the attempt then return the refusal.
  //    Do NOT call AI for injected input.
  const isInjection = INJECTION_PATTERNS.some((pattern) =>
    pattern.test(trimmedMessage),
  );

  if (isInjection) {
    try {
      await persistTurn(
        env,
        session.id,
        trimmedMessage,
        REFUSAL_RESPONSE,
        "refusal",
        null,
      );
    } catch (err) {
      console.error("persistTurn (injection) failed:", err);
    }
    return Response.json({ reply: REFUSAL_RESPONSE, session_id: session.id });
  }

  // 6. Fetch recent conversation history for context, then call Workers AI
  let history: Message[];
  try {
    history = await getSessionMessages(env, session.id, 6);
  } catch (err) {
    console.error("getSessionMessages failed:", err);
    history = []; // non-fatal — proceed without history
  }

  let aiResult;
  try {
    aiResult = await getAiReply(env, trimmedMessage, history);
  } catch (err) {
    console.error("Workers AI failed:", err);
    // Graceful fallback: store and return a safe message rather than a 500.
    aiResult = {
      reply:
        "I'm having trouble responding right now. Please try again in a moment.",
      model: "fallback",
      latency_ms: 0,
    };
  }

  // 7. Persist turn and respond
  try {
    await persistTurn(
      env,
      session.id,
      trimmedMessage,
      aiResult.reply,
      aiResult.model,
      aiResult.latency_ms,
    );
  } catch (err) {
    console.error("persistTurn failed:", err);
    return Response.json({ error: "Failed to save message" }, { status: 500 });
  }

  return Response.json({ reply: aiResult.reply, session_id: session.id });
}
