import type { Env } from "./types";
import { corsHeaders, handlePreflight } from "./cors";
import { route } from "./router";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const preflight = handlePreflight(request, env);
    if (preflight) return preflight;

    const response = await route(request, env);

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(request, env))) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
