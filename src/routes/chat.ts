import type { Env } from "../types";
import { verifyHmac } from "../lib/crypto";
import type { Message } from "../lib/d1";
import { getSession, getSessionMessages, insertMessage, touchSession } from "../lib/d1";
import { INJECTION_PATTERNS, REFUSAL_RESPONSE } from "../lib/prompts";
import { getAiReply } from "../lib/ai";
import {
  incrementRateLimit,
  RATE_LIMITS,
  RL_KEYS,
  tooManyRequests,
} from "../lib/kv";
import { verifyTurnstile } from "../lib/turnstile";
import { retrieve, type RetrievedChunk } from "../retrieval";

const RAG_UNAVAILABLE_RESPONSE =
  "I don't have enough information in Mihir's portfolio to answer that. You can reach Mihir directly at mtrivedi@laurentian.ca.";

function isRagEnabled(env: Env): boolean {
  return env.RAG_ENABLED?.toLowerCase() === "true" || env.RAG_ENABLED === "1";
}

function buildRagContext(chunks: RetrievedChunk[]): string {
  return chunks.map((chunk) => `[${chunk.id}]\n${chunk.content}`).join("\n\n");
}

function citedIds(answer: string): string[] {
  return [...new Set([...answer.matchAll(/\[([A-Za-z0-9_-]+#\d+)\]/g)].map((match) => match[1]))];
}

function safeRetrieved(chunks: RetrievedChunk[]) {
  return chunks.map(({ id, doc_id, source, heading, chunk_index }) => ({ id, doc_id, source, heading, chunk_index }));
}

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

  const { session_id, csrf_token, message, turnstile_token } = body as Record<string, unknown>;

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

  // 4. Verify CSRF token — must happen before any state change
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

  // 5. Session message cap (D1-based; no KV needed).
  //    Hard limit: 50 stored messages per session (~25 turns).
  if (session.message_count >= RATE_LIMITS.SESSION_MSG_CAP) {
    return tooManyRequests(0, "Session message limit reached. Please start a new session.");
  }

  // 6. Global daily message cap (KV).
  const globalRl = await incrementRateLimit(
    env,
    RL_KEYS.chatGlobal(),
    RATE_LIMITS.CHAT_GLOBAL.limit,
    RATE_LIMITS.CHAT_GLOBAL.windowMs,
  );
  if (!globalRl.allowed) {
    return tooManyRequests(globalRl.retryAfterSeconds, "Service is busy. Please try again later.");
  }

  // 7. Per-IP chat rate limit (KV).
  //    Use the session's stored ip_hash as client identity; fall back to session_id.
  const rlId = session.ip_hash ?? session.id;
  const ipRl = await incrementRateLimit(
    env,
    RL_KEYS.chatIp(rlId),
    RATE_LIMITS.CHAT_PER_IP.limit,
    RATE_LIMITS.CHAT_PER_IP.windowMs,
  );
  if (!ipRl.allowed) {
    return tooManyRequests(ipRl.retryAfterSeconds);
  }

  // 8. Turnstile verification — required once the session reaches the threshold
  //    where the post-turn message_count would be >= 5 (i.e., the 3rd turn onward).
  //    Before the threshold, turnstile_token is optional and ignored.
  const turnstileRequired = (session.message_count + 2) >= 5;
  if (turnstileRequired) {
    if (typeof turnstile_token !== "string" || !turnstile_token.trim()) {
      return Response.json({ error: "Turnstile verification required" }, { status: 403 });
    }
    const tsResult = await verifyTurnstile(env, turnstile_token.trim());
    if (!tsResult.success) {
      return Response.json({ error: "Turnstile verification failed" }, { status: 403 });
    }
  }

  // 9. Detect prompt injection — log the attempt in D1 but do NOT call AI.
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
    return Response.json({
      // reply is retained for the existing portfolio frontend during its migration.
      reply: REFUSAL_RESPONSE,
      answer: REFUSAL_RESPONSE,
      citations: [],
      retrieved: [],
      session_id: session.id,
      turnstile_required: turnstileRequired,
    });
  }

  // 10. Fetch recent conversation history for AI context
  let history: Message[];
  try {
    history = await getSessionMessages(env, session.id, 6);
  } catch (err) {
    console.error("getSessionMessages failed:", err);
    history = []; // non-fatal — proceed without history
  }

  // 11. Retrieve portfolio context only when the opt-in RAG flag is enabled.
  let retrieved: RetrievedChunk[] = [];
  let ragContext: string | undefined;
  if (isRagEnabled(env)) {
    try {
      retrieved = await retrieve(env, trimmedMessage);
      ragContext = buildRagContext(retrieved);
    } catch (err) {
      console.error("RAG retrieval failed:", err);
      const aiResult = { reply: RAG_UNAVAILABLE_RESPONSE, model: "rag-unavailable", latency_ms: 0 };
      try {
        await persistTurn(env, session.id, trimmedMessage, aiResult.reply, aiResult.model, aiResult.latency_ms);
      } catch (persistError) {
        console.error("persistTurn (RAG unavailable) failed:", persistError);
      }
      return Response.json({
        reply: aiResult.reply,
        answer: aiResult.reply,
        citations: [],
        retrieved: [],
        session_id: session.id,
        turnstile_required: turnstileRequired,
      });
    }
  }

  // 12. Call Workers AI
  let aiResult;
  try {
    aiResult = await getAiReply(env, trimmedMessage, history, ragContext);
  } catch (err) {
    console.error("Workers AI failed:", err);
    aiResult = {
      reply: "I'm having trouble responding right now. Please try again in a moment.",
      model: "fallback",
      latency_ms: 0,
    };
  }

  // 13. Validate citations produced by the RAG response before persisting it.
  const cited = citedIds(aiResult.reply);
  let citations = cited;
  if (isRagEnabled(env)) {
    const retrievedIds = new Set(retrieved.map((chunk) => chunk.id));
    const hallucinated = cited.filter((id) => !retrievedIds.has(id));
    if (hallucinated.length) {
      console.log("rag_hallucinated_citation", {
        cited_ids: hallucinated,
        retrieved_ids: [...retrievedIds],
        session_id: session.id,
      });
    }
    // Do not expose invented source IDs to the frontend; the event above keeps
    // observability without making the invalid citation part of the API contract.
    citations = cited.filter((id) => retrievedIds.has(id));
  }

  // 14. Persist the turn to D1
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

  // 15. Respond — reply is retained for the existing frontend; answer is the RAG API field.
  //    true once the session has accumulated 5+ messages (post-turn count).
  return Response.json({
    reply: aiResult.reply,
    answer: aiResult.reply,
    citations,
    retrieved: safeRetrieved(retrieved),
    session_id: session.id,
    turnstile_required: turnstileRequired,
  });
}
