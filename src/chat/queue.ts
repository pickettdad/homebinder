/**
 * The chat drain: mirror of the review queue's mechanics (plan §6). A turn is enqueued
 * with its ChatMessageSent event (so "ask anyway" offline is free — the ask is recorded
 * whether or not there's a network), and the drain posts it when connectivity allows.
 * The reply lands as a ChatReplyRecorded event whenever it lands — desk-side or on site.
 */
import { db, type ChatJobRow } from "../storage/db";
import { downscaleForReview } from "../review/downscale";
import {
  CHAT_API_VERSION,
  type ChatErrorEnvelope,
  type ChatImage,
  type ChatRequest,
  type ChatResponse,
  type ChatScope,
  type ChatTurn,
} from "./protocol";

const TOKEN_STORAGE_KEY = "hs-second-look-token"; // one shared app token gates the proxy
const RAW_BYTE_BUDGET = 3_500_000;
const BACKOFF_MS = [1_000, 5_000, 30_000, 120_000, 600_000];
const MAX_ATTEMPTS = 8;
const FETCH_TIMEOUT_MS = 40_000; // sonnet-5 with adaptive thinking can be slower than review

export function getAppToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAppToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
}

/** What the store supplies so the drain can rebuild a stateless request from the log. */
export interface ChatThreadView {
  scope: ChatScope;
  turns: { role: "user" | "assistant"; text: string; mediaIds: string[] }[];
}

export interface ChatDrainCallbacks {
  /** Fresh thread view for a job's thread; null if the thread vanished. */
  getThread(threadId: string): ChatThreadView | null;
  configHash(sessionId: string): string;
  /** Append ChatReplyRecorded + mark the job done, atomically. */
  applyReply(job: ChatJobRow, response: ChatResponse): Promise<void>;
  /** Append ChatFailed + mark the job failed. */
  recordFailure(job: ChatJobRow, code: string): Promise<void>;
}

let draining = false;

/** Single-flight drain: process due chat jobs for a session until none remain or offline. */
export async function drainChat(sessionId: string, callbacks: ChatDrainCallbacks): Promise<void> {
  if (draining) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const token = getAppToken();
  if (!token) return; // assistant not configured — quietly hold the queue
  draining = true;
  try {
    for (;;) {
      const now = Date.now();
      const due = (await db.chatJobs.where("sessionId").equals(sessionId).toArray())
        .filter((r) => r.status === "pending" && Date.parse(r.nextAttemptAt) <= now)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // oldest ask first
      const job = due[0];
      if (!job) break;
      await runJob(job, token, callbacks);
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
    }
  } finally {
    draining = false;
  }
}

export async function rearmFailedChat(sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.chatJobs
    .where("sessionId").equals(sessionId)
    .filter((r) => r.status === "failed")
    .modify({ status: "pending", nextAttemptAt: now });
}

async function runJob(job: ChatJobRow, token: string, callbacks: ChatDrainCallbacks): Promise<void> {
  await db.chatJobs.update(job.jobId, { status: "inflight" });
  try {
    const view = callbacks.getThread(job.threadId);
    if (!view || view.turns.length === 0 || view.turns[view.turns.length - 1]!.role !== "user") {
      // Nothing to answer (thread gone, or already replied) — retire the job quietly.
      await db.chatJobs.update(job.jobId, { status: "done" });
      return;
    }
    const request = await buildChatRequest(job, view, callbacks.configHash(job.sessionId));
    const result = await postChat(request, token);
    if ("error" in result) {
      await handleFailure(job, result.error.code, result.error.retryable, result.error.retryAfterMs, callbacks);
      return;
    }
    await callbacks.applyReply(job, result);
  } catch (err) {
    const code = err instanceof DOMException && err.name === "AbortError" ? "timeout" : "network";
    await handleFailure(job, code, true, undefined, callbacks);
  }
}

async function buildChatRequest(job: ChatJobRow, view: ChatThreadView, configHash: string): Promise<ChatRequest> {
  let rawBytes = 0;
  const thread: ChatTurn[] = [];
  for (const turn of view.turns) {
    const images: ChatImage[] = [];
    if (turn.role === "user") {
      for (const mediaId of turn.mediaIds) {
        const row = await db.media.get(mediaId);
        if (!row || row.kind !== "photo") continue;
        const d = await downscaleForReview(row.blob);
        if (rawBytes + d.bytes > RAW_BYTE_BUDGET) break; // byte guard shared across the thread
        rawBytes += d.bytes;
        images.push({ mediaId, width: d.width, height: d.height, dataBase64: d.base64 });
      }
    }
    thread.push({ role: turn.role, text: turn.text, images: images.length ? images : undefined });
  }
  return {
    apiVersion: CHAT_API_VERSION,
    kind: "chat",
    job: { jobId: job.jobId },
    session: { sessionId: job.sessionId, configHash },
    scope: view.scope,
    thread,
  };
}

async function postChat(request: ChatRequest, token: string): Promise<ChatResponse | ChatErrorEnvelope> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": request.job.jobId, "X-HS-Token": token },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as ChatResponse | ChatErrorEnvelope | null;
    if (res.ok && body && "text" in body) return body;
    if (body && "error" in body) return body;
    return {
      error: {
        code: res.status === 413 ? "payload-too-large" : res.status === 401 ? "auth" : "upstream-unavailable",
        retryable: res.status !== 401,
        message: `HTTP ${res.status}`,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function handleFailure(
  job: ChatJobRow,
  code: string,
  retryable: boolean,
  retryAfterMs: number | undefined,
  callbacks: ChatDrainCallbacks,
): Promise<void> {
  const attempts = job.attempts + 1;
  if (!retryable || attempts >= MAX_ATTEMPTS) {
    await db.chatJobs.update(job.jobId, { status: "failed", attempts, lastErrorCode: code });
    await callbacks.recordFailure(job, code);
    return;
  }
  const backoff = retryAfterMs ?? BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]!;
  const jitter = backoff * (0.8 + Math.random() * 0.4);
  await db.chatJobs.update(job.jobId, {
    status: "pending",
    attempts,
    lastErrorCode: code,
    nextAttemptAt: new Date(Date.now() + jitter).toISOString(),
  });
}
