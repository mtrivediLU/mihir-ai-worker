import type { Env } from "./types";
import { handleHealth } from "./routes/health";

export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (pathname === "/health" && method === "GET") {
    return handleHealth(request, env);
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
