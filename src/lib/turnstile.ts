import type { Env } from "../types";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEV_BYPASS_TOKEN = "dev-turnstile-token";

export interface TurnstileResult {
  success: boolean;
  errorCode?: string;
}

export async function verifyTurnstile(
  env: Env,
  token: string,
): Promise<TurnstileResult> {
  // Dev bypass — only active when ENV === "dev" and no real secret is configured.
  if (env.ENV === "dev" && token === DEV_BYPASS_TOKEN) {
    return { success: true };
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    // If no secret is configured in production, fail closed to prevent open bypass.
    return { success: false, errorCode: "missing-secret" };
  }

  let data: { success: boolean; "error-codes"?: string[] };
  try {
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
    });
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
    });
    data = (await res.json()) as typeof data;
  } catch {
    // Network failure — fail closed; do not silently allow.
    return { success: false, errorCode: "network-error" };
  }

  return {
    success: data.success,
    errorCode: data["error-codes"]?.[0],
  };
}
