import type { Env } from "../types";

export function handleHealth(_request: Request, env: Env): Response {
  return Response.json({
    ok: true,
    version: env.VERSION ?? "0.1.0",
    time: new Date().toISOString(),
  });
}
