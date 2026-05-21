import type { Env } from "../types";
import { PROFILE_TEXT } from "../lib/profile";

export function handleDebugProfile(request: Request, env: Env): Response {
  const token = new URL(request.url).searchParams.get("token");
  if (env.ENV !== "dev" || token !== "dev") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ preview: PROFILE_TEXT.slice(0, 300) });
}
