/**
 * POST /api/chat — the in-product AI assistant proxy. Holds the Anthropic key
 * server-side; the PWA (same origin) authenticates with the shared app token.
 *
 * Stateless: the client sends the whole thread each turn. One request → one recorded
 * reply (no streaming). This is the money feature — `claude-sonnet-5` is the deliberate
 * choice (identification quality), env-overridable.
 *
 * Netlify env vars:
 *   ANTHROPIC_API_KEY  — from console.anthropic.com (mark as secret)
 *   HS_APP_TOKEN       — shared token; the same value is set in the app
 *   HS_CHAT_MODEL      — optional model override (default claude-sonnet-5)
 *   HS_CHAT_DAILY_CAP  — optional, max requests/day (default 300) — cost backstop
 */
import Anthropic from "@anthropic-ai/sdk";
import { buildChatSystemPrompt, buildScopeContext, lintReply } from "./lib/chatCore";
import type { ChatRequest, ChatResponse, ChatErrorEnvelope } from "../../src/chat/protocol";

// The chat model is a PINNED release id, chosen deliberately — never an evergreen "-latest"
// alias. Claude model ids in the 5 family are fixed releases (the dateless string IS the
// complete id); a newer model ships under a NEW id, so nothing swaps under us silently. That
// matters because the manifest stamps the model id on every recorded reply — a silent swap
// would corrupt the provenance record. The env var HS_CHAT_MODEL is the single control point;
// the constant below is only the safety default when it's unset. To upgrade, see CLAUDE.md
// → "Chat model upgrades" (config change in Netlify + a deliberate test, never automatic).
const DEFAULT_CHAT_MODEL = "claude-sonnet-5";
const MODEL = process.env.HS_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;
// Sonnet 5 runs adaptive thinking by default, which can push a reply past Netlify's ~10s
// function limit and leave the field app hanging on "Thinking…". This is a short, one-shot
// field Q&A — extended thinking buys little here — so we turn it off explicitly (Sonnet 5
// accepts {type:"disabled"}; it rejects budget_tokens / non-default sampling with a 400).
// With thinking off, a modest cap is plenty for a field reply and keeps us well inside the
// timeout. The tokenizer runs ~30% heavier, so 2048 still leaves generous headroom.
const MAX_TOKENS = 2048;
const MAX_IMAGES = 12;
const MAX_BODY_BYTES = 5_500_000;

let dayKey = "";
let dayCount = 0;

// The native shell's web origin is `capacitor://localhost`, not the Netlify origin, so its
// requests are cross-origin and WKWebView enforces CORS. Allow them: the request carries a
// custom X-HS-Token header (which forces a preflight) and no cookies, so "*" is safe (no
// credentials to leak). The browser/PWA is same-origin and unaffected.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-HS-Token, Idempotency-Key",
  "Access-Control-Max-Age": "86400",
};

function errorResponse(status: number, envelope: ChatErrorEnvelope): Response {
  return new Response(JSON.stringify(envelope), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req: Request): Promise<Response> {
  // CORS preflight for the native shell — answer before any auth/method checks.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse(405, { error: { code: "invalid-request", retryable: false, message: "POST only" } });
  }

  const expectedToken = process.env.HS_APP_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!expectedToken || !apiKey) {
    return errorResponse(401, { error: { code: "auth", retryable: false, message: "server not configured" } });
  }
  if (!constantTimeEqual(req.headers.get("x-hs-token") ?? "", expectedToken)) {
    return errorResponse(401, { error: { code: "auth", retryable: false, message: "bad token" } });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (dayKey !== today) { dayKey = today; dayCount = 0; }
  const dailyCap = Number(process.env.HS_CHAT_DAILY_CAP ?? 300);
  if (++dayCount > dailyCap) {
    return errorResponse(429, {
      error: { code: "rate-limited", retryable: true, retryAfterMs: 3_600_000, message: "daily cap reached" },
    });
  }

  const bodyText = await req.text();
  if (bodyText.length > MAX_BODY_BYTES) {
    return errorResponse(413, { error: { code: "payload-too-large", retryable: false, message: "body too large" } });
  }
  let request: ChatRequest;
  try {
    request = JSON.parse(bodyText) as ChatRequest;
  } catch {
    return errorResponse(422, { error: { code: "invalid-request", retryable: false, message: "bad JSON" } });
  }
  if (request.kind !== "chat" || !Array.isArray(request.thread) || request.thread.length === 0 || !request.scope) {
    return errorResponse(422, { error: { code: "invalid-request", retryable: false, message: "bad request shape" } });
  }
  const imageCount = request.thread.reduce((n, t) => n + (t.images?.length ?? 0), 0);
  if (imageCount > MAX_IMAGES) {
    return errorResponse(413, { error: { code: "payload-too-large", retryable: false, message: "too many images" } });
  }

  const client = new Anthropic({ apiKey });
  try {
    const messages: Anthropic.MessageParam[] = request.thread.map((turn, i) => {
      const content: Anthropic.ContentBlockParam[] = [];
      // Prepend the scope context to the first user turn so the model is oriented.
      const text = i === 0 && turn.role === "user" ? `${buildScopeContext(request.scope)}\n\n${turn.text}` : turn.text;
      if (text) content.push({ type: "text", text });
      for (const im of turn.images ?? [])
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: im.dataBase64 } });
      return { role: turn.role, content };
    });

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "disabled" }, // one-shot field Q&A; keep latency under the function timeout
      system: buildChatSystemPrompt(),
      messages,
    });

    if (message.stop_reason === "refusal") {
      return errorResponse(422, { error: { code: "model-refused", retryable: false, message: "model declined" } });
    }
    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const { text } = lintReply(raw || "I couldn't read enough from that to help — try another angle or photo.");

    const response: ChatResponse = {
      apiVersion: request.apiVersion,
      kind: "chat",
      jobId: request.job.jobId,
      model: message.model,
      text,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    const anyErr = err as { status?: number };
    if (anyErr.status === 429) {
      return errorResponse(429, {
        error: { code: "rate-limited", retryable: true, retryAfterMs: 30_000, message: "upstream rate limit" },
      });
    }
    return errorResponse(502, {
      error: { code: "upstream-unavailable", retryable: true, message: err instanceof Error ? err.message : "unknown" },
    });
  }
}
