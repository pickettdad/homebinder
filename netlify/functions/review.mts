/**
 * POST /api/review — the "Second look" proxy. Holds the Anthropic key server-side;
 * the PWA (same origin) authenticates with a shared app token.
 *
 * Netlify env vars required:
 *   ANTHROPIC_API_KEY  — from console.anthropic.com (mark as secret)
 *   HS_APP_TOKEN       — any long random string; the same value is pasted into the app
 *   HS_DAILY_CAP       — optional, max requests/day (default 500) — cost backstop
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  buildSystemPrompt,
  buildUserContext,
  parseModelJson,
  validateFindings,
} from "./lib/reviewCore";
import type { ZoneSummaryRequest, ZoneSummaryResponse, ReviewErrorEnvelope } from "../../src/review/protocol";

const MODEL = "claude-haiku-4-5";
const MAX_IMAGES = 20;
const MAX_BODY_BYTES = 5_500_000;

// Best-effort per-instance daily counter (resets on cold start — a backstop, not a ledger).
let dayKey = "";
let dayCount = 0;

// The native shell's web origin is `capacitor://localhost`; its requests are cross-origin,
// so the function must send CORS headers (mirrors chat.mts). No cookies, custom token header
// only, so "*" is safe. Browser/PWA is same-origin and unaffected.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-HS-Token, Idempotency-Key",
  "Access-Control-Max-Age": "86400",
};

function errorResponse(status: number, envelope: ReviewErrorEnvelope): Response {
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
  const token = req.headers.get("x-hs-token") ?? "";
  if (!constantTimeEqual(token, expectedToken)) {
    return errorResponse(401, { error: { code: "auth", retryable: false, message: "bad token" } });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (dayKey !== today) { dayKey = today; dayCount = 0; }
  const dailyCap = Number(process.env.HS_DAILY_CAP ?? 500);
  if (++dayCount > dailyCap) {
    return errorResponse(429, {
      error: { code: "rate-limited", retryable: true, retryAfterMs: 3_600_000, message: "daily cap reached" },
    });
  }

  const bodyText = await req.text();
  if (bodyText.length > MAX_BODY_BYTES) {
    return errorResponse(413, { error: { code: "payload-too-large", retryable: false, message: "body too large" } });
  }
  let request: ZoneSummaryRequest;
  try {
    request = JSON.parse(bodyText) as ZoneSummaryRequest;
  } catch {
    return errorResponse(422, { error: { code: "invalid-request", retryable: false, message: "bad JSON" } });
  }
  if (request.kind !== "zone-summary" || !Array.isArray(request.images) || request.images.length === 0) {
    return errorResponse(422, { error: { code: "invalid-request", retryable: false, message: "bad request shape" } });
  }
  if (request.images.length > MAX_IMAGES) {
    return errorResponse(413, { error: { code: "payload-too-large", retryable: false, message: "too many images" } });
  }

  const client = new Anthropic({ apiKey });
  try {
    const content: Anthropic.ContentBlockParam[] = [
      { type: "text", text: buildUserContext(request) },
    ];
    for (const [i, im] of request.images.entries()) {
      content.push({ type: "text", text: `Image ${i + 1} — slot ${im.slotInstanceId}, mediaId ${im.mediaId}:` });
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: im.dataBase64 },
      });
    }
    content.push({ type: "text", text: "Respond with ONLY the findings JSON object." });

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content }],
    });

    if (message.stop_reason === "refusal") {
      return errorResponse(422, { error: { code: "model-refused", retryable: false, message: "model declined" } });
    }
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const parsed = parseModelJson(text);
    const findings = validateFindings(parsed, request);

    const response: ZoneSummaryResponse = {
      apiVersion: request.apiVersion,
      kind: "zone-summary",
      jobId: request.job.jobId,
      model: message.model,
      findings,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
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
    if (anyErr.status && anyErr.status >= 500) {
      return errorResponse(502, {
        error: { code: "upstream-unavailable", retryable: true, message: "upstream error" },
      });
    }
    return errorResponse(502, {
      error: { code: "upstream-unavailable", retryable: true, message: err instanceof Error ? err.message : "unknown" },
    });
  }
}
