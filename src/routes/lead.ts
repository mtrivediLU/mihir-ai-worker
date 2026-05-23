import type { Env } from "../types";
import { verifyHmac } from "../lib/crypto";
import { getSession, insertLead, markLeadEmailSent } from "../lib/d1";
import { incrementRateLimit, RATE_LIMITS, RL_KEYS, tooManyRequests } from "../lib/kv";
import { sendLeadNotification } from "../lib/email";

// Minimal email format check — no external library, no over-engineering.
// Validates: local@domain.tld without spaces or double-@.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleCreateLead(
  request: Request,
  env: Env,
): Promise<Response> {
  // 1. Require HMAC key
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

  const {
    session_id,
    csrf_token,
    name,
    email,
    organization,
    reason,
    intent,
    phone,
    opt_in_email,
  } = body as Record<string, unknown>;

  // Required fields
  if (typeof session_id !== "string" || !session_id.trim()) {
    return Response.json({ error: "session_id is required" }, { status: 400 });
  }
  if (typeof csrf_token !== "string" || !csrf_token.trim()) {
    return Response.json({ error: "csrf_token is required" }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof email !== "string" || !email.trim()) {
    return Response.json({ error: "email is required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email.trim())) {
    return Response.json({ error: "email is invalid" }, { status: 400 });
  }
  if (typeof reason !== "string" || !reason.trim()) {
    return Response.json({ error: "reason is required" }, { status: 400 });
  }

  // Optional fields — coerce to correct types or null
  const trimmedOrg = typeof organization === "string" && organization.trim()
    ? organization.trim()
    : null;
  const trimmedIntent = typeof intent === "string" && intent.trim()
    ? intent.trim()
    : null;
  const trimmedPhone = typeof phone === "string" && phone.trim()
    ? phone.trim()
    : null;
  const optIn = opt_in_email === true || opt_in_email === 1 ? 1 : 0;

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

  // 5. Per-IP lead rate limit (KV) — 3 per hour
  const rlId = session.ip_hash ?? session.id;
  const ipRl = await incrementRateLimit(
    env,
    RL_KEYS.leadIp(rlId),
    RATE_LIMITS.LEAD_PER_IP.limit,
    RATE_LIMITS.LEAD_PER_IP.windowMs,
  );
  if (!ipRl.allowed) {
    return tooManyRequests(ipRl.retryAfterSeconds);
  }

  // 6. Insert lead into D1
  let leadId: number;
  try {
    leadId = await insertLead(env, {
      session_id: session.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: trimmedPhone,
      organization: trimmedOrg,
      reason: reason.trim(),
      intent: trimmedIntent,
      opt_in_email: optIn,
      follow_up_status: "new",
      notes: null,
      email_sent: 0,
    });
  } catch (err) {
    console.error("insertLead failed:", err);
    return Response.json({ error: "Failed to save lead" }, { status: 500 });
  }

  // 7. Send email notification — non-fatal; never fail the visitor response.
  const emailResult = await sendLeadNotification(env, {
    lead_id: leadId,
    session_id: session.id,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: trimmedPhone,
    organization: trimmedOrg,
    reason: reason.trim(),
    intent: trimmedIntent,
    opt_in_email: optIn,
  });

  if (emailResult.success) {
    try {
      await markLeadEmailSent(env, leadId);
    } catch (err) {
      console.error("markLeadEmailSent failed:", err);
    }
  } else if (emailResult.errorMessage !== "Resend env vars not configured") {
    // Only log unexpected failures, not the expected "not configured" case in dev.
    console.error("sendLeadNotification failed:", emailResult.errorMessage);
  }

  return Response.json({ success: true, lead_id: leadId }, { status: 201 });
}
