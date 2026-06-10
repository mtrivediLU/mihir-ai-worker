import type { Env } from "./types";

const PRODUCTION_ORIGINS = [
  "https://mihirtrivedi.tech",
  "https://www.mihirtrivedi.tech",
];

const DEV_ORIGINS = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  ...PRODUCTION_ORIGINS,
];

function allowedOrigins(env: Env): string[] {
  return env.ENV === "production" ? PRODUCTION_ORIGINS : DEV_ORIGINS;
}

export function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";

  const headers: HeadersInit = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  if (allowedOrigins(env).includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function handlePreflight(request: Request, env: Env): Response | null {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, env),
    });
  }

  return null;
}