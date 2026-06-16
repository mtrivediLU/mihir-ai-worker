import type { Env } from "../types";
import type { Message } from "./d1";
import { SYSTEM_PROMPT_CHAT, PROMPT_VERSION } from "./prompts";
import { PROFILE_TEXT, PROFILE } from "./profile";

// Model used for all chat inference. Swap here to upgrade across the whole app.
// NOTE: "@cf/meta/llama-3.1-8b-instruct" was deprecated by Cloudflare on
// 2026-05-30 (AiError 5028). Replaced with the FP8 variant of the same
// Llama 3.1 8B model — a drop-in, currently-supported equivalent.
export const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8" as const;

// Model label stored in D1 — includes prompt version for traceability.
export const MODEL_LABEL = `${AI_MODEL}@${PROMPT_VERSION}`;

const MAX_TOKENS = 512;
const CONTEXT_MESSAGES = 6; // last 3 turns (user + assistant pairs)

const FALLBACK_REPLY =
  "I'm having trouble responding right now. Please try again in a moment.";

export interface AiResult {
  reply: string;
  model: string;
  latency_ms: number;
}

export async function getAiReply(
  env: Env,
  userMessage: string,
  history: Message[],
): Promise<AiResult> {
  const systemContent = SYSTEM_PROMPT_CHAT(PROFILE_TEXT, PROFILE.availability);

  // Build the messages array: system prompt + recent history + current user turn.
  // Filter out any stored system-role rows to avoid injecting a duplicate system
  // prompt from history.
  const contextMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-CONTEXT_MESSAGES)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const messages = [
    { role: "system" as const, content: systemContent },
    ...contextMessages,
    { role: "user" as const, content: userMessage },
  ];

  const start = Date.now();

  const raw = await env.AI.run(AI_MODEL, { messages, max_tokens: MAX_TOKENS });

  const latency_ms = Date.now() - start;

  // Workers AI returns AiTextGenerationOutput | ReadableStream depending on
  // whether streaming was requested. Since we never pass stream:true, narrow
  // to the non-streaming shape.
  const output = raw as { response?: string };
  const reply = output.response?.trim() || FALLBACK_REPLY;

  return { reply, model: MODEL_LABEL, latency_ms };
}
