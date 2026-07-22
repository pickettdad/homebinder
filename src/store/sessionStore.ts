/**
 * The single app store (Zustand): navigation + session state + dispatch.
 *
 * Dispatch path: append events to IndexedDB (atomic, seq assigned in-transaction),
 * then re-fold the in-memory log. A visit is a few hundred tiny events — refolding
 * is single-digit milliseconds, so no incremental-update machinery is warranted.
 */
import { create } from "zustand";
import type { RouteConfig } from "../engine/schema/routeConfig";
import type { EventPayload, SessionEvent } from "../engine/schema/events";
import { fold, type SessionState } from "../engine/fold";
import { uuidv7 } from "../engine/ids";
import { sha256Hex } from "../engine/canonical";
import { gateOutstanding } from "../engine/gate";
import { zoneCounts } from "../engine/selectors";
import { loadRoute } from "../config/loadRoute";
import {
  appendEvents, createSession, deleteMedia, listSessions, loadEvents,
  loadSessionConfig, requestPersistence, setSessionStatus,
} from "../storage/sessionRepo";
import { db, type MediaRow, type ReviewJobRow, type SessionRow } from "../storage/db";
import { drainReviews, enqueueZoneReview, pendingJobs, rearmFailedJobs } from "../review/queue";
import type { ZoneSummaryResponse } from "../review/protocol";

export type Screen =
  | { name: "home" }
  | { name: "setup" }
  | { name: "route" }
  | { name: "zone"; zoneId: string }
  | { name: "capture"; slotInstanceId: string; findingId?: string }
  | { name: "gate"; zoneId: string }
  | { name: "export" };

interface AppStore {
  ready: boolean;
  screen: Screen;
  /** Validated bundled route (for new sessions). */
  route: RouteConfig | null;
  routeErrors: string[];
  /** Active session: pinned config snapshot + folded state + in-memory log. */
  sessionId: string | null;
  config: RouteConfig | null;
  session: SessionState | null;
  events: SessionEvent[];
  sessionRows: SessionRow[];
  storage: { persisted: boolean; usage?: number; quota?: number } | null;
  toast: string | null;

  init(): Promise<void>;
  navigate(screen: Screen): void;
  refreshSessions(): Promise<void>;
  startSession(args: {
    flags: string[];
    rooms: { zoneId: string; kind: string; label: string }[];
    propertyLabel?: string;
  }): Promise<void>;
  resumeSession(sessionId: string): Promise<void>;
  leaveSession(): void;
  abandonSession(sessionId: string): Promise<void>;

  dispatch(payloads: EventPayload[], media?: MediaRow[]): Promise<void>;
  capturePhoto(slotInstanceId: string, file: File | Blob, mime?: string): Promise<string>;
  discardPhoto(slotInstanceId: string, mediaId: string): Promise<void>;
  attachVoice(slotInstanceId: string, blob: Blob, mime: string, durationMs?: number): Promise<void>;
  discardVoice(slotInstanceId: string, mediaId: string): Promise<void>;
  addRoom(zoneId: string, kind: string, label: string): Promise<void>;
  recordException(slotInstanceId: string, reasonId: string, note?: string): Promise<void>;
  clearException(slotInstanceId: string): Promise<void>;
  closeZone(zoneId: string): Promise<void>;
  reopenZone(zoneId: string): Promise<void>;
  completeSession(): Promise<void>;
  showToast(message: string): void;

  /** "Second look" — pending review-job count for the active session (UI pill). */
  reviewPending: number;
  refreshReviewStatus(): Promise<void>;
  drainNow(): Promise<void>;
  resolveFinding(findingId: string, zoneId: string, resolution: "cleared" | "deferred" | "reshot", note?: string): Promise<void>;
}

/** Best-effort multi-tab guard: hold a Web Lock per session for the tab's lifetime. */
function acquireSessionLock(sessionId: string): void {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return;
  void navigator.locks.request(`session-${sessionId}`, { ifAvailable: true }, (lock) => {
    if (!lock) {
      console.warn("session is open in another tab — writes may conflict");
      return Promise.resolve();
    }
    return new Promise<void>(() => {}); // hold until tab closes
  });
}

export const useApp = create<AppStore>((set, get) => ({
  ready: false,
  screen: { name: "home" },
  route: null,
  routeErrors: [],
  sessionId: null,
  config: null,
  session: null,
  events: [],
  sessionRows: [],
  storage: null,
  toast: null,

  async init() {
    const loaded = loadRoute();
    const storage = await requestPersistence().catch(() => null);
    const sessionRows = await listSessions();
    set({
      ready: true,
      route: loaded.ok ? loaded.config : null,
      routeErrors: loaded.ok ? [] : loaded.errors,
      sessionRows,
      storage,
    });
    // Resume-first: an active session reopens where the inspector left off. A resume
    // failure (corrupted row, storage fault) must degrade to the home screen — never
    // block startup.
    const active = sessionRows.find((s) => s.status === "active");
    if (active) {
      try {
        await get().resumeSession(active.id);
      } catch (err) {
        console.error("failed to resume active session", err);
        get().showToast("Couldn't resume the active session — its data is still on this device");
      }
    }
  },

  navigate(screen) {
    set({ screen });
  },

  async refreshSessions() {
    set({ sessionRows: await listSessions() });
  },

  async startSession({ flags, rooms, propertyLabel }) {
    const route = get().route;
    if (!route) throw new Error("no valid route config");
    const sessionId = await createSession({ config: route, flags, rooms, propertyLabel });
    await get().resumeSession(sessionId);
  },

  async resumeSession(sessionId) {
    const config = await loadSessionConfig(sessionId);
    const events = await loadEvents(sessionId);
    const session = fold(config, events);
    acquireSessionLock(sessionId);
    set({ sessionId, config, session, events });
    const zoneId = session.lastActiveZoneId ?? session.zones[0]?.zoneId;
    set({ screen: zoneId && !session.completedAt ? { name: "zone", zoneId } : { name: "route" } });
    await get().refreshSessions();
  },

  leaveSession() {
    set({ sessionId: null, config: null, session: null, events: [], screen: { name: "home" } });
    void get().refreshSessions();
  },

  async abandonSession(sessionId) {
    await setSessionStatus(sessionId, "abandoned");
    if (get().sessionId === sessionId) get().leaveSession();
    await get().refreshSessions();
  },

  async dispatch(payloads, media = []) {
    const { sessionId, config } = get();
    if (!sessionId || !config) throw new Error("no active session");
    const appended = await appendEvents(sessionId, payloads, media);
    const events = [...get().events, ...appended];
    set({ events, session: fold(config, events) });
  },

  async capturePhoto(slotInstanceId, file, mimeOverride) {
    const { sessionId } = get();
    if (!sessionId) throw new Error("no active session");
    const mediaId = uuidv7();
    const mime = mimeOverride ?? (file instanceof File ? file.type : "") ?? "image/jpeg";
    const sha256 = await sha256Hex(file);
    const now = new Date().toISOString();
    const row: MediaRow = {
      id: mediaId, sessionId, slotInstanceId, kind: "photo",
      mime: mime || "image/jpeg", bytes: file.size, sha256, capturedAt: now, blob: file,
    };
    await get().dispatch(
      [{ type: "PhotoCaptured", slotInstanceId, media: { mediaId, sha256, mime: row.mime, bytes: file.size } }],
      [row],
    );
    return mediaId;
  },

  async discardPhoto(slotInstanceId, mediaId) {
    await get().dispatch([{ type: "PhotoDiscarded", slotInstanceId, mediaId }]);
    await deleteMedia([mediaId]); // the event records the fact; the bytes are reclaimed
  },

  async attachVoice(slotInstanceId, blob, mime, durationMs) {
    const { sessionId } = get();
    if (!sessionId) throw new Error("no active session");
    const mediaId = uuidv7();
    const sha256 = await sha256Hex(blob);
    const now = new Date().toISOString();
    const row: MediaRow = {
      id: mediaId, sessionId, slotInstanceId, kind: "voice",
      mime, bytes: blob.size, sha256, capturedAt: now, durationMs, blob,
    };
    await get().dispatch(
      [{ type: "VoiceNoteAttached", slotInstanceId, media: { mediaId, sha256, mime, bytes: blob.size }, durationMs }],
      [row],
    );
  },

  async discardVoice(slotInstanceId, mediaId) {
    await get().dispatch([{ type: "VoiceNoteDiscarded", slotInstanceId, mediaId }]);
    await deleteMedia([mediaId]);
  },

  async addRoom(zoneId, kind, label) {
    await get().dispatch([{ type: "RoomAdded", room: { roomInstanceId: uuidv7(), zoneId, kind, label } }]);
  },

  async recordException(slotInstanceId, reasonId, note) {
    const config = get().config;
    const reason = config?.exceptionReasons.find((r) => r.id === reasonId);
    if (!reason) throw new Error(`unknown exception reason ${reasonId}`);
    if (reason.requiresNote && !note?.trim()) throw new Error(`'${reason.label}' requires a note`);
    await get().dispatch([{ type: "ExceptionRecorded", slotInstanceId, reasonId, note: note?.trim() || undefined }]);
  },

  async clearException(slotInstanceId) {
    await get().dispatch([{ type: "ExceptionCleared", slotInstanceId }]);
  },

  async closeZone(zoneId) {
    const { session, config, sessionId } = get();
    if (!session || !config || !sessionId) throw new Error("no active session");
    const zone = session.zones.find((z) => z.zoneId === zoneId);
    if (!zone) throw new Error(`unknown zone ${zoneId}`);
    const outstanding = gateOutstanding(zone);
    if (outstanding.length > 0) throw new Error(`zone has ${outstanding.length} unresolved required slots`);
    const c = zoneCounts(zone, config);
    await get().dispatch([
      { type: "ZoneClosed", zoneId, summary: { captured: c.captured, excepted: c.excepted, deferred: c.deferred } },
    ]);
    // Second look: enqueue is local-only (IndexedDB) and the drain is fire-and-forget —
    // the gate is already closed; nothing here can block or reopen it.
    try {
      const queued = await enqueueZoneReview(sessionId, zone, config);
      if (queued > 0) {
        const events = await loadEvents(sessionId);
        set({ events, session: fold(config, events) });
        await get().refreshReviewStatus();
        void get().drainNow();
      }
    } catch (err) {
      console.error("second look enqueue failed", err);
    }
  },

  async reopenZone(zoneId) {
    await get().dispatch([{ type: "ZoneReopened", zoneId }]);
  },

  async completeSession() {
    const { sessionId } = get();
    if (!sessionId) return;
    await get().dispatch([{ type: "SessionCompleted" }]);
    await setSessionStatus(sessionId, "completed");
    await get().refreshSessions();
  },

  showToast(message) {
    set({ toast: message });
    setTimeout(() => set((s) => (s.toast === message ? { toast: null } : s)), 4000);
  },

  reviewPending: 0,

  async refreshReviewStatus() {
    const { sessionId } = get();
    if (!sessionId) { set({ reviewPending: 0 }); return; }
    const jobs = await pendingJobs(sessionId);
    set({ reviewPending: jobs.length });
  },

  async drainNow() {
    const { sessionId } = get();
    if (!sessionId) return;
    await rearmFailedJobs(sessionId);
    await drainReviews(sessionId, {
      getConfig: () => loadSessionConfig(sessionId),
      getEvents: () => loadEvents(sessionId),
      applyResponse: async (job: ReviewJobRow, response: ZoneSummaryResponse) => {
        // Idempotent apply: the job-status guard runs inside the same transaction as
        // the event append, so a duplicate delivery can never double-write findings.
        await db.transaction("rw", [db.sessions, db.events, db.media, db.outbox, db.reviewJobs], async () => {
          const current = await db.reviewJobs.get(job.jobId);
          if (!current || current.status === "done") return;
          await appendEvents(job.sessionId, [{
            type: "ReviewRecorded",
            reviewJobId: job.jobId,
            zoneId: job.zoneId,
            model: response.model,
            findings: response.findings,
            usage: response.usage,
          }], [], { actor: "ai", actorId: response.model, device: "server", appVersion: "0.5.0" });
          await db.reviewJobs.update(job.jobId, { status: "done" });
          await db.outbox.where("sessionId").equals(job.sessionId)
            .filter((r) => r.refType === "review" && r.refId === job.jobId)
            .modify({ status: "synced" });
        });
      },
      recordFailure: async (job: ReviewJobRow, code: string) => {
        await appendEvents(job.sessionId, [
          { type: "ReviewFailed", reviewJobId: job.jobId, zoneId: job.zoneId, code },
        ], [], { actor: "system", actorId: "app", device: "client", appVersion: "0.5.0" });
      },
    });
    // Refold from storage: review events were appended outside the dispatch path.
    const { config } = get();
    if (config && get().sessionId === sessionId) {
      const events = await loadEvents(sessionId);
      set({ events, session: fold(config, events) });
    }
    await get().refreshReviewStatus();
  },

  async resolveFinding(findingId, zoneId, resolution, note) {
    await get().dispatch([{ type: "ReviewFindingResolved", findingId, zoneId, resolution, note }]);
  },
}));
