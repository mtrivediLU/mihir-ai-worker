import type { Env } from "./types";
import { handleHealth } from "./routes/health";
import { handleDebugProfile } from "./routes/debug";
import { handleCreateSession } from "./routes/session";
import { handleChat } from "./routes/chat";
import { handleCreateLead } from "./routes/lead";

export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (pathname === "/health" && method === "GET") {
    return handleHealth(request, env);
  }

  if (pathname === "/debug/profile" && method === "GET") {
    return handleDebugProfile(request, env);
  }

  if (pathname === "/api/session" && method === "POST") {
    return handleCreateSession(request, env);
  }

  if (pathname === "/api/chat" && method === "POST") {
    return handleChat(request, env);
  }

  if (pathname === "/api/lead" && method === "POST") {
    return handleCreateLead(request, env);
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
