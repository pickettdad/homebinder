/**
 * The "Second look" queue: enqueue at zone close, drain whenever there's connectivity.
 *
 * Doctrine, made structural: the deterministic gate NEVER waits on any of this. Jobs
 * are written atomically with the ZoneClosed/ReviewRequested events; the drain is a
 * single-flight background loop; failures re-arm on connectivity; only abandoning the
 * session drops pending work.
 */
import { db, type ReviewJobRow } from "../storage/db";
import { appendEvents } from "../storage/sessionRepo";
import type { RouteConfig } from "../engine/schema/routeConfig";
import type { SessionEvent } from "../engine/schema/events";
import type { ZoneState } from "../engine/fold";
import { uuidv7 } from "../engine/ids";
import { chunkZonePhotos } from "./chunk";
import { downscaleForReview } from "./downscale";
import {
  REVIEW_API_VERSION,
  type ReviewErrorEnvelope,
  type ZoneSummaryRequest,
  type ZoneSummaryResponse,
} from "./protocol";

const TOKEN_STORAGE_KEY = "hs-second-look-token";
const RAW_BYTE_BUDGET = 3_500_000; // pre-base64 guard under the ~6MB function cap
const BACKOFF_MS = [1_000, 5_000, 30_000, 120_000, 600_000];
const MAX_ATTEMPTS = 8;
const FETCH_TIMEOUT_MS = 24_000;

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

/**
 * Queue a zone's review. Called after ZoneClosed is committed; each chunk becomes one
 * job row + one ReviewRequested event, written in a single transaction.
 */
export async function enqueueZoneReview(sessionId: string, zone: ZoneState, config: RouteConfig): Promise<number> {
  const zoneDef = config.zones.find((z) => z.id === zone.zoneId);
  if (zoneDef?.gate.review !== "ai") return 0;

  const photos = zone.slots.flatMap((slot) =>
    slot.photos.map((p) => ({ slotInstanceId: slot.instanceId, mediaId: p.mediaId })),
  );
  const chunks = chunkZonePhotos(photos);
  if (chunks.length === 0) return 0;

  const now = new Date().toISOString();
  await db.transaction("rw", [db.sessions, db.events, db.media, db.outbox, db.reviewJobs], async () => {
    const jobs: ReviewJobRow[] = chunks.map((chunk, i) => ({
      jobId: uuidv7(),
      sessionId,
      zoneId: zone.zoneId,
      kind: "zone-summary",
      chunkIndex: i,
      chunkOf: chunks.length,
      slotInstanceIds: [...new Set(chunk.map((c) => c.slotInstanceId))],
      mediaIds: chunk.map((c) => c.mediaId),
      status: "pending",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
    }));
    await db.reviewJobs.bulkAdd(jobs);
    await db.outbox.bulkAdd(
      jobs.map((j) => ({
        sessionId, refType: "review" as const, refId: j.jobId,
        status: "pending" as const, attempts: 0, createdAt: now,
      })),
    );
    await appendEvents(
      sessionId,
      jobs.map((j) => ({
        type: "ReviewRequested" as const,
        reviewJobId: j.jobId,
        zoneId: zone.zoneId,
        kind: "zone-summary" as const,
        slotInstanceIds: j.slotInstanceIds,
        mediaIds: j.mediaIds,
      })),
    );
  });
  return chunks.length;
}

export async function pendingJobs(sessionId: string): Promise<ReviewJobRow[]> {
  const rows = await db.reviewJobs.where("sessionId").equals(sessionId).toArray();
  return rows.filter((r) => r.status === "pending" || r.status === "inflight" || r.status === "failed");
}

/** Re-arm failed jobs (connectivity regained). */
export async function rearmFailedJobs(sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.reviewJobs
    .where("sessionId").equals(sessionId)
    .filter((r) => r.status === "failed")
    .modify({ status: "pending", nextAttemptAt: now });
}

export interface DrainCallbacks {
  /** Apply a successful response: append events + mark job done, atomically. */
  applyResponse(job: ReviewJobRow, response: ZoneSummaryResponse): Promise<void>;
  /** Record a terminal failure event. */
  recordFailure(job: ReviewJobRow, code: string): Promise<void>;
  getConfig(sessionId: string): Promise<RouteConfig>;
  getEvents(sessionId: string): Promise<SessionEvent[]>;
}

let draining = false;

/** Single-flight drain: processes due jobs for a session until none remain or offline. */
export async function drainReviews(sessionId: string, callbacks: DrainCallbacks): Promise<void> {
  if (draining) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const token = getAppToken();
  if (!token) return; // Second look not configured — quietly do nothing
  draining = true;
  try {
    for (;;) {
      const now = Date.now();
      const due = (await db.reviewJobs.where("sessionId").equals(sessionId).toArray())
        .filter((r) => r.status === "pending" && Date.parse(r.nextAttemptAt) <= now)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // most recent zone first
      const job = due[0];
      if (!job) break;
      await runJob(job, token, callbacks);
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
    }
  } finally {
    draining = false;
  }
}

async function runJob(job: ReviewJobRow, token: string, callbacks: DrainCallbacks): Promise<void> {
  await db.reviewJobs.update(job.jobId, { status: "inflight" });
  try {
    const request = await buildRequest(job, callbacks);
    if (!request) {
      // Media no longer present (discarded) — nothing reviewable; mark done quietly.
      await db.reviewJobs.update(job.jobId, { status: "done" });
      return;
    }
    const result = await postReview(request, token);
    if ("error" in result) {
      await handleFailure(job, result.error.code, result.error.retryable, result.error.retryAfterMs, callbacks);
      return;
    }
    await callbacks.applyResponse(job, result);
  } catch (err) {
    const code = err instanceof DOMException && err.name === "AbortError" ? "timeout" : "network";
    await handleFailure(job, code, true, undefined, callbacks);
  }
}

async function buildRequest(job: ReviewJobRow, callbacks: DrainCallbacks): Promise<ZoneSummaryRequest | null> {
  const session = await db.sessions.get(job.sessionId);
  if (!session) return null;
  const config = await callbacks.getConfig(job.sessionId);
  const zoneDef = config.zones.find((z) => z.id === job.zoneId);

  const images: ZoneSummaryRequest["images"] = [];
  let rawBytes = 0;
  // Strictly sequential: iPad Safari's device-wide canvas memory cap is the real limit.
  for (const mediaId of job.mediaIds) {
    const row = await db.media.get(mediaId);
    if (!row || row.kind !== "photo") continue;
    const d = await downscaleForReview(row.blob);
    if (rawBytes + d.bytes > RAW_BYTE_BUDGET && images.length > 0) break; // byte guard; remainder re-chunks via 413 path if ever hit
    rawBytes += d.bytes;
    images.push({
      mediaId, slotInstanceId: row.slotInstanceId,
      width: d.width, height: d.height, dataBase64: d.base64,
    });
  }
  if (images.length === 0) return null;

  // Slot metadata for the slots actually present in this chunk.
  const events = await callbacks.getEvents(job.sessionId);
  void events; // (slot labels come from config-derived ids below; events reserved for future context)
  const slotMeta = job.slotInstanceIds.map((instanceId) => {
    const defId = instanceId.split("/").pop() ?? instanceId;
    const def =
      zoneDef?.slots.find((s) => s.id === defId) ??
      config.conditionalBlocks.flatMap((b) => b.inject).flatMap((i) => i.slots).find((s) => s.id === defId);
    return {
      slotInstanceId: instanceId,
      defId,
      label: def?.label ?? defId,
      guidance: def?.guidance,
    };
  });

  return {
    apiVersion: REVIEW_API_VERSION,
    kind: "zone-summary",
    job: { jobId: job.jobId, chunk: { index: job.chunkIndex, of: job.chunkOf } },
    session: { sessionId: job.sessionId, routeId: session.routeId, configHash: session.configHash },
    zone: { zoneId: job.zoneId, label: zoneDef?.label ?? job.zoneId, flags: session.flags },
    slots: slotMeta,
    images,
  };
}

async function postReview(
  request: ZoneSummaryRequest,
  token: string,
): Promise<ZoneSummaryResponse | ReviewErrorEnvelope> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": request.job.jobId,
        "X-HS-Token": token,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as ZoneSummaryResponse | ReviewErrorEnvelope | null;
    if (res.ok && body && "findings" in body) return body;
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
  job: ReviewJobRow,
  code: string,
  retryable: boolean,
  retryAfterMs: number | undefined,
  callbacks: DrainCallbacks,
): Promise<void> {
  const attempts = job.attempts + 1;
  if (!retryable || attempts >= MAX_ATTEMPTS) {
    await db.reviewJobs.update(job.jobId, { status: "failed", attempts, lastErrorCode: code });
    await callbacks.recordFailure(job, code);
    return;
  }
  const backoff = retryAfterMs ?? BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]!;
  const jitter = backoff * (0.8 + Math.random() * 0.4);
  await db.reviewJobs.update(job.jobId, {
    status: "pending",
    attempts,
    lastErrorCode: code,
    nextAttemptAt: new Date(Date.now() + jitter).toISOString(),
  });
}
