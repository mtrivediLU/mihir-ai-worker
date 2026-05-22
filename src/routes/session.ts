import type { Env } from "../types";
import { generateRandomHex, signHmac, hashIp } from "../lib/crypto";
import { createSession } from "../lib/d1";
import { incrementRateLimit, RATE_LIMITS, RL_KEYS, tooManyRequests } from "../lib/kv";

// Subset of Cloudflare's IncomingRequestCfProperties we actually read.
interface CfGeo {
  country?: string;
  region?: string;
  city?: string;
  asn?: number;
  asOrganization?: string;
}

function extractUaFamily(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\//i.test(ua)) return "Opera";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  if (/curl/i.test(ua)) return "curl";
  if (/postman/i.test(ua)) return "Postman";
  return "Other";
}

export async function handleCreateSession(
  request: Request,
  env: Env,
): Promise<Response> {
  // 1. Require secrets
  if (!env.SESSION_HMAC_KEY || !env.IP_HASH_SALT) {
    return Response.json(
      {
        error:
          "Server misconfiguration: SESSION_HMAC_KEY and IP_HASH_SALT must be set. " +
          "Copy .dev.vars.example to .dev.vars and fill in values for local development.",
      },
      { status: 500 },
    );
  }

  const cf = (request as Request & { cf?: CfGeo }).cf;
  const ip = request.headers.get("CF-Connecting-IP") ?? null;
  const rawUa = request.headers.get("User-Agent") ?? null;
  const referrer = request.headers.get("Referer") ?? null;
  const landingPath = new URL(request.url).pathname;

  // 2. Hash IP early — needed for both rate limiting and D1 storage.
  const ipHash = ip ? await hashIp(ip, env.IP_HASH_SALT) : null;
  const rlId = ipHash ?? "unknown";

  // 3. Per-IP session creation rate limit (10 per hour).
  const rl = await incrementRateLimit(
    env,
    RL_KEYS.sessionIp(rlId),
    RATE_LIMITS.SESSION_PER_IP.limit,
    RATE_LIMITS.SESSION_PER_IP.windowMs,
  );
  if (!rl.allowed) {
    return tooManyRequests(rl.retryAfterSeconds);
  }

  // 4. Generate session components
  const sessionId = crypto.randomUUID();
  const csrfSecret = generateRandomHex(32);
  const csrfToken = await signHmac(
    env.SESSION_HMAC_KEY,
    `${sessionId}.${csrfSecret}`,
  );

  // 5. Write session to D1
  try {
    await createSession(env, {
      id: sessionId,
      ip_hash: ipHash,
      country: cf?.country ?? null,
      region: cf?.region ?? null,
      city: cf?.city ?? null,
      asn: cf?.asn ?? null,
      asn_name: cf?.asOrganization ?? null,
      user_agent_family: rawUa ? extractUaFamily(rawUa) : null,
      referrer,
      landing_path: landingPath,
      csrf_secret: csrfSecret,
    });
  } catch (err) {
    console.error("createSession failed:", err);
    return Response.json({ error: "Failed to create session" }, { status: 500 });
  }

  return Response.json({ session_id: sessionId, csrf_token: csrfToken }, { status: 201 });
}
