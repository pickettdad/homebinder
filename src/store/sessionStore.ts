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
import { loadChecklists } from "../config/loadChecklists";
import type { ChecklistConfig } from "../engine/schema/checklistConfig";
import type {
  CaptureIntent, CaptureTarget, ItemResolution, ItemScope, PinFlag, PinTypeRef, V2EventPayload, V2SessionEvent,
  VisitKind,
} from "../engine/v2/events";
import { foldV2, type SessionStateV2 } from "../engine/v2/fold";
import { auditSnapshot, deriveZoneAudit } from "../engine/v2/checklist";
import {
  appendEvents as appendAnyEvents, appendEventsV1 as appendEvents, createSession,
  createSessionV2, deleteMedia, listSessions, loadEvents as loadStoredEvents,
  loadEventsV1 as loadEvents, loadSessionChecklistConfig, loadSessionConfig,
  requestPersistence, setSessionStatus,
} from "../storage/sessionRepo";
import { db, type MediaRow, type ReviewJobRow, type SessionRow } from "../storage/db";
import { drainReviews, enqueueZoneReview, pendingJobs, rearmFailedJobs } from "../review/queue";
import type { ZoneSummaryResponse } from "../review/protocol";
import { drainChat, rearmFailedChat } from "../chat/queue";
import type { ChatResponse, ChatScope } from "../chat/protocol";

type ChatTarget = { kind: "pin"; id: string } | { kind: "zone"; id: string };

/** Snapshot the pin/zone the thread is about, for the stateless chat request. */
function buildChatScope(s: SessionStateV2, target: ChatTarget): ChatScope {
  if (target.kind === "pin") {
    const p = s.pins.find((x) => x.pinId === target.id);
    const zone = p?.zoneId ? s.zones.find((z) => z.zoneId === p.zoneId) : undefined;
    const notes = (p?.noteIds ?? []).map((id) => s.notes.get(id)?.text).filter((t): t is string => !!t);
    const type = p?.pinType?.kind === "component" ? p.pinType.componentType : p?.pinType?.kind === "freeform" ? p.pinType.label : undefined;
    return { kind: "pin", pinNumber: p?.number ?? 0, pinType: type, label: p?.label, flag: p?.flag ?? null, zoneLabel: zone?.label, zoneType: zone?.zoneType, notes };
  }
  const zone = s.zones.find((z) => z.zoneId === target.id);
  const pinIndex = s.pins
    .filter((p) => p.zoneId === target.id && !p.retired)
    .map((p) => ({ number: p.number, type: p.pinType?.kind === "component" ? p.pinType.componentType : undefined, flag: p.flag ?? null }));
  return { kind: "zone", zoneLabel: zone?.label ?? "", zoneType: zone?.zoneType ?? "", pinIndex };
}

/**
 * Structural edits (new pins, canvases, anchors, filing captures) are refused when the
 * inspection is completed or the target zone is closed — the real lock behind the UI
 * gating, so no back door (e.g. filing an inbox capture as a new pin) can slip work into
 * a closed zone. Reopen (logged) is the only way back in.
 */
function assertEditable(session: SessionStateV2 | null, zoneId?: string): void {
  if (!session) return;
  if (session.completedAt) throw new Error("This inspection is completed — reopen it to make changes.");
  if (zoneId && session.zones.find((z) => z.zoneId === zoneId)?.closedAt)
    throw new Error("This zone is closed — reopen it to make changes.");
}

/** Resolve the zone a media-file target lands in (undefined = inbox / misc, always editable). */
function targetZoneId(session: SessionStateV2 | null, target: CaptureTarget): string | undefined {
  if (target.kind === "zone") return target.id;
  if (target.kind === "pin") return session?.pins.find((p) => p.pinId === target.id)?.zoneId;
  return undefined;
}

export type Screen =
  | { name: "home" }
  | { name: "setup" }
  | { name: "route" }
  | { name: "zone"; zoneId: string }
  | { name: "capture"; slotInstanceId: string; findingId?: string }
  | { name: "gate"; zoneId: string }
  | { name: "export" }
  // ---- v2 pin-model screens
  | { name: "setup2" }
  | { name: "walk" }
  | { name: "zone2"; zoneId: string }
  | { name: "pin"; pinId: string }
  | { name: "canvas"; canvasId: string; zoneId: string; placePinId?: string }
  | { name: "inbox" }
  | { name: "export2" };

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

  /** v2 pin model: validated bundled checklist config + active-session state. */
  checklists: ChecklistConfig | null;
  checklistErrors: string[];
  v2Config: ChecklistConfig | null;
  v2Session: SessionStateV2 | null;
  v2Events: V2SessionEvent[];

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

  // ---- v2 actions (the pin model). All dispatch through the same atomic append path.
  startSessionV2(args: { propertyFlags: string[]; propertyLabel?: string; visitKind: VisitKind }): Promise<void>;
  dispatchV2(payloads: V2EventPayload[], media?: MediaRow[]): Promise<V2SessionEvent[]>;
  createZone(zoneType: string, label: string, attributes: Record<string, boolean>, level?: string): Promise<string>;
  /** Set a zone's attributes AFTER creation. Capture mode does not ask them (they are
   *  classification), so without this a capture-created zone could never have them set. */
  setZoneAttributes(zoneId: string, attributes: Record<string, boolean>): Promise<void>;
  renameZone(zoneId: string, label: string): Promise<void>;
  createPin(zoneId?: string): Promise<string>;
  /** Create + type + anchor a pin in ONE transaction — the canvas tap and stamp-mode path. */
  createPinAt(zoneId: string, canvasId: string, x: number, y: number, pinType?: PinTypeRef): Promise<string>;
  setPinType(pinId: string, pinType: PinTypeRef): Promise<void>;
  /** Set/clear a human nickname on a pin (additive to its component type). */
  setPinLabel(pinId: string, label: string): Promise<void>;
  setPinFlag(pinId: string, flag: PinFlag | null): Promise<void>;
  assignPin(pinId: string, zoneId?: string): Promise<void>;
  retirePin(pinId: string, note?: string): Promise<void>;
  addCanvas(zoneId: string, file: File | Blob, mime?: string): Promise<string>;
  placeAnchor(pinId: string, canvasId: string, x: number, y: number): Promise<void>;
  removeAnchor(anchorId: string): Promise<void>;
  /** durationMs applies to video only — stills leave it undefined. `intent` marks one of the
   *  three declared capture kinds; ordinary captures leave it undefined. */
  capturePhotoV2(
    target: CaptureTarget,
    file: File | Blob,
    mime?: string,
    durationMs?: number,
    intent?: CaptureIntent,
  ): Promise<string>;
  attachVoiceV2(target: CaptureTarget, blob: Blob, mime: string, durationMs?: number): Promise<void>;
  discardMediaV2(mediaId: string): Promise<void>;
  reassignMedia(mediaId: string, target: CaptureTarget): Promise<void>;
  captionMedia(mediaId: string, text: string): Promise<void>;
  addNote(target: CaptureTarget, text: string): Promise<string>;
  editNote(noteId: string, text: string): Promise<void>;
  resolveItem(scope: ItemScope, itemId: string, resolution: ItemResolution): Promise<void>;
  reopenItem(scope: ItemScope, itemId: string): Promise<void>;
  /** Advisory close — records the audit snapshot and a note; NEVER blocks. */
  closeZoneV2(zoneId: string, note?: string, reasonId?: string): Promise<void>;
  reopenZoneV2(zoneId: string, note?: string): Promise<void>;
  completeSessionV2(): Promise<void>;
  /** Record a produced export (manifest + files) in the log; marks a completed visit exported. */
  recordExportV2(manifestSha256: string, files: { name: string; bytes: number }[]): Promise<void>;
  /** Un-complete a finished visit so it can be edited again; the reason is logged. */
  reopenSessionV2(reason: string): Promise<void>;
  /** Ask the in-product assistant about a pin/zone; records the ask, queues the reply. */
  sendChatMessage(target: ChatTarget, text: string, mediaIds: string[]): Promise<void>;
  /** Drain queued chat asks (single-flight; no-ops offline or without a token). */
  drainChatNow(): Promise<void>;

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
  checklists: null,
  checklistErrors: [],
  v2Config: null,
  v2Session: null,
  v2Events: [],

  async init() {
    const loaded = loadRoute();
    let checklists: ChecklistConfig | null = null;
    let checklistErrors: string[] = [];
    try {
      checklists = loadChecklists();
    } catch (err) {
      checklistErrors = [err instanceof Error ? err.message : String(err)];
    }
    const storage = await requestPersistence().catch(() => null);
    const sessionRows = await listSessions();
    set({
      ready: true,
      route: loaded.ok ? loaded.config : null,
      routeErrors: loaded.ok ? [] : loaded.errors,
      checklists,
      checklistErrors,
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
    const row = await db.sessions.get(sessionId);
    if (row?.kind === "v2") {
      const v2Config = await loadSessionChecklistConfig(sessionId);
      const v2Events = (await loadStoredEvents(sessionId)) as V2SessionEvent[];
      const v2Session = foldV2(v2Events);
      acquireSessionLock(sessionId);
      const zoneId = v2Session.lastActiveZoneId;
      set({
        sessionId, v2Config, v2Session, v2Events,
        config: null, session: null, events: [],
        screen: zoneId && !v2Session.completedAt ? { name: "zone2", zoneId } : { name: "walk" },
      });
      await get().refreshSessions();
      return;
    }
    const config = await loadSessionConfig(sessionId);
    const events = await loadEvents(sessionId);
    const session = fold(config, events);
    acquireSessionLock(sessionId);
    set({ sessionId, config, session, events, v2Config: null, v2Session: null, v2Events: [] });
    const zoneId = session.lastActiveZoneId ?? session.zones[0]?.zoneId;
    set({ screen: zoneId && !session.completedAt ? { name: "zone", zoneId } : { name: "route" } });
    await get().refreshSessions();
  },

  leaveSession() {
    set({
      sessionId: null, config: null, session: null, events: [],
      v2Config: null, v2Session: null, v2Events: [],
      screen: { name: "home" },
    });
    void get().refreshSessions();
  },

  async abandonSession(sessionId) {
    await setSessionStatus(sessionId, "abandoned");
    if (get().sessionId === sessionId) get().leaveSession();
    await get().refreshSessions();
  },

  // ---- v2 pin model ------------------------------------------------------------

  async startSessionV2({ propertyFlags, propertyLabel, visitKind }) {
    const checklists = get().checklists;
    if (!checklists) throw new Error("no valid checklist config");
    const sessionId = await createSessionV2({ config: checklists, propertyFlags, propertyLabel, visitKind });
    await get().resumeSession(sessionId);
  },

  async dispatchV2(payloads, media = []) {
    const { sessionId, v2Session } = get();
    if (!sessionId || !v2Session) throw new Error("no active v2 session");
    const appended = (await appendAnyEvents(sessionId, payloads, media)) as V2SessionEvent[];
    const v2Events = [...get().v2Events, ...appended];
    set({ v2Events, v2Session: foldV2(v2Events) });
    return appended;
  },

  async setZoneAttributes(zoneId, attributes) {
    await get().dispatchV2([{ type: "ZoneAttributesSet", zoneId, attributes }]);
  },

  async createZone(zoneType, label, attributes, level) {
    const zoneId = uuidv7();
    await get().dispatchV2([{ type: "ZoneCreated", zoneId, zoneType, label, attributes, level }]);
    return zoneId;
  },

  async renameZone(zoneId, label) {
    await get().dispatchV2([{ type: "ZoneRenamed", zoneId, label }]);
  },

  async createPin(zoneId) {
    assertEditable(get().v2Session, zoneId);
    const pinId = uuidv7();
    // pinNumber 0 is a placeholder — appendEvents stamps the real session-scoped number
    // inside the transaction; the refold picks it up from the stored event.
    await get().dispatchV2([{ type: "PinCreated", pinId, pinNumber: 0, zoneId }]);
    return pinId;
  },

  async createPinAt(zoneId, canvasId, x, y, pinType) {
    assertEditable(get().v2Session, zoneId);
    const pinId = uuidv7();
    await get().dispatchV2([
      { type: "PinCreated", pinId, pinNumber: 0, zoneId },
      ...(pinType ? [{ type: "PinTyped", pinId, pinType } as const] : []),
      { type: "AnchorPlaced", anchorId: uuidv7(), pinId, canvasId, x, y },
    ]);
    return pinId;
  },

  async setPinType(pinId, pinType) {
    await get().dispatchV2([{ type: "PinTyped", pinId, pinType }]);
  },

  async setPinLabel(pinId, label) {
    await get().dispatchV2([{ type: "PinLabeled", pinId, label: label.trim() }]);
  },

  async setPinFlag(pinId, flag) {
    await get().dispatchV2([{ type: "PinFlagged", pinId, flag }]);
  },

  async assignPin(pinId, zoneId) {
    assertEditable(get().v2Session, zoneId);
    await get().dispatchV2([{ type: "PinAssigned", pinId, zoneId }]);
  },

  async retirePin(pinId, note) {
    await get().dispatchV2([{ type: "PinRetired", pinId, note }]);
  },

  async addCanvas(zoneId, file, mimeOverride) {
    const { sessionId } = get();
    if (!sessionId) throw new Error("no active session");
    assertEditable(get().v2Session, zoneId);
    const canvasId = uuidv7();
    const mediaId = uuidv7();
    const mime = mimeOverride ?? ((file instanceof File ? file.type : "") || "image/jpeg");
    const sha256 = await sha256Hex(file);
    const row: MediaRow = {
      id: mediaId, sessionId, targetKind: "zone", targetId: zoneId, kind: "photo",
      mime, bytes: file.size, sha256, capturedAt: new Date().toISOString(), blob: file,
    };
    await get().dispatchV2(
      [{ type: "CanvasAdded", canvasId, zoneId, kind: "photo", media: { mediaId, sha256, mime, bytes: file.size } }],
      [row],
    );
    return canvasId;
  },

  async placeAnchor(pinId, canvasId, x, y) {
    assertEditable(get().v2Session, get().v2Session?.pins.find((p) => p.pinId === pinId)?.zoneId);
    await get().dispatchV2([{ type: "AnchorPlaced", anchorId: uuidv7(), pinId, canvasId, x, y }]);
  },

  async removeAnchor(anchorId) {
    await get().dispatchV2([{ type: "AnchorRemoved", anchorId }]);
  },

  async capturePhotoV2(target, file, mimeOverride, durationMs, intent) {
    const { sessionId } = get();
    if (!sessionId) throw new Error("no active session");
    assertEditable(get().v2Session, targetZoneId(get().v2Session, target));
    const mediaId = uuidv7();
    const mime = mimeOverride ?? ((file instanceof File ? file.type : "") || "image/jpeg");
    const sha256 = await sha256Hex(file);
    const row: MediaRow = {
      id: mediaId, sessionId, kind: "photo",
      targetKind: target.kind, targetId: target.kind === "inbox" ? undefined : target.id,
      mime, bytes: file.size, sha256, capturedAt: new Date().toISOString(), durationMs, blob: file,
    };
    await get().dispatchV2(
      // `intent` rides the EVENT only, never MediaRow — the same shape as `caption`. MediaRow
      // is blob storage; the log is the record, and one home for a fact is the whole point.
      [{ type: "PhotoAdded", media: { mediaId, sha256, mime, bytes: file.size }, target, durationMs, intent }],
      [row],
    );
    return mediaId;
  },

  async attachVoiceV2(target, blob, mime, durationMs) {
    const { sessionId } = get();
    if (!sessionId) throw new Error("no active session");
    const mediaId = uuidv7();
    const sha256 = await sha256Hex(blob);
    const row: MediaRow = {
      id: mediaId, sessionId, kind: "voice",
      targetKind: target.kind, targetId: target.kind === "inbox" ? undefined : target.id,
      mime, bytes: blob.size, sha256, capturedAt: new Date().toISOString(), durationMs, blob,
    };
    await get().dispatchV2(
      [{ type: "VoiceNoteAdded", media: { mediaId, sha256, mime, bytes: blob.size }, target, durationMs }],
      [row],
    );
  },

  async discardMediaV2(mediaId) {
    await get().dispatchV2([{ type: "MediaDiscarded", mediaId }]);
    await deleteMedia([mediaId]);
  },

  async reassignMedia(mediaId, target) {
    // Filing INTO a closed zone / completed inspection is the back door — refuse it.
    // Un-filing back to the inbox (target inbox) is always allowed.
    assertEditable(get().v2Session, targetZoneId(get().v2Session, target));
    await get().dispatchV2([{ type: "MediaReassigned", mediaId, target }]);
    await db.media.update(mediaId, {
      targetKind: target.kind,
      targetId: target.kind === "inbox" ? undefined : target.id,
    });
  },

  async captionMedia(mediaId, text) {
    await get().dispatchV2([{ type: "MediaCaptioned", mediaId, text }]);
  },

  async addNote(target, text) {
    const noteId = uuidv7();
    await get().dispatchV2([{ type: "NoteAdded", noteId, target, text }]);
    return noteId;
  },

  async editNote(noteId, text) {
    await get().dispatchV2([{ type: "NoteEdited", noteId, text }]);
  },

  async resolveItem(scope, itemId, resolution) {
    await get().dispatchV2([{ type: "ItemResolved", scope, itemId, resolution }]);
  },

  async reopenItem(scope, itemId) {
    await get().dispatchV2([{ type: "ItemReopened", scope, itemId }]);
  },

  async closeZoneV2(zoneId, note, reasonId) {
    const { v2Config, v2Session } = get();
    if (!v2Config || !v2Session) throw new Error("no active v2 session");
    // Advisory close: the audit is recorded, never enforced (REDESIGN decision 1).
    const audit = auditSnapshot(deriveZoneAudit(v2Config, v2Session, zoneId));
    // Fail closed on the vocabulary rather than storing an unresolvable id: a reason that
    // does not exist in Table C is worse than none, because it looks routable downstream.
    if (reasonId && !v2Config.naReasons.some((r) => r.id === reasonId))
      throw new Error(`unknown close reason: ${reasonId}`);
    await get().dispatchV2([
      { type: "ZoneClosed", zoneId, note: note?.trim() || undefined, reasonId, audit },
    ]);
  },

  async reopenZoneV2(zoneId, note) {
    await get().dispatchV2([{ type: "ZoneReopened", zoneId, note: note?.trim() || undefined }]);
  },

  async completeSessionV2() {
    const { sessionId } = get();
    if (!sessionId) return;
    await get().dispatchV2([{ type: "SessionCompleted" }]);
    await setSessionStatus(sessionId, "completed");
    await get().refreshSessions();
  },

  async recordExportV2(manifestSha256, files) {
    const { sessionId, v2Session } = get();
    if (!sessionId) return;
    await get().dispatchV2([{ type: "ExportProduced", manifestSha256, files }]);
    // Only a COMPLETED visit becomes "exported"; a mid-inspection emergency backup leaves the
    // session active (it's a safety copy, not the end of the visit).
    if (v2Session?.completedAt) await setSessionStatus(sessionId, "exported");
    await get().refreshSessions();
  },

  async reopenSessionV2(reason) {
    const { sessionId } = get();
    if (!sessionId) return;
    await get().dispatchV2([{ type: "SessionReopened", reason: reason.trim() }]);
    await setSessionStatus(sessionId, "active");
    await get().refreshSessions();
  },

  async sendChatMessage(target, text, mediaIds) {
    const { sessionId, v2Session } = get();
    if (!sessionId || !v2Session) throw new Error("no active v2 session");
    // Continue the target's existing thread, or open one.
    const existing = [...v2Session.chats.values()].find((t) => t.target.kind === target.kind && t.target.id === target.id);
    const threadId = existing?.threadId ?? uuidv7();
    await get().dispatchV2([{ type: "ChatMessageSent", threadId, target, text: text.trim(), mediaIds }]);
    const jobId = uuidv7();
    const now = new Date().toISOString();
    // The ask is recorded (above) whether or not there's a network; the job drives the
    // reply fetch. "Ask anyway" offline is therefore free — it drains when back online.
    await db.transaction("rw", [db.chatJobs, db.outbox], async () => {
      await db.chatJobs.add({ jobId, sessionId, threadId, status: "pending", attempts: 0, nextAttemptAt: now, createdAt: now });
      await db.outbox.add({ sessionId, refType: "chat", refId: jobId, status: "pending", attempts: 0, createdAt: now });
    });
    void get().drainChatNow();
  },

  async drainChatNow() {
    const { sessionId } = get();
    if (!sessionId) return;
    await rearmFailedChat(sessionId);
    await drainChat(sessionId, {
      configHash: () => get().v2Session?.configHash ?? "",
      getThread: (threadId) => {
        const s = get().v2Session;
        const thread = s?.chats.get(threadId);
        if (!s || !thread) return null;
        return {
          scope: buildChatScope(s, thread.target),
          turns: thread.messages.map((m) => ({ role: m.role, text: m.text, mediaIds: m.mediaIds ?? [] })),
        };
      },
      applyReply: async (job, response: ChatResponse) => {
        // Idempotent: the job-status guard shares the transaction with the append.
        await db.transaction("rw", [db.sessions, db.events, db.media, db.outbox, db.chatJobs], async () => {
          const current = await db.chatJobs.get(job.jobId);
          if (!current || current.status === "done") return;
          await appendAnyEvents(
            job.sessionId,
            [{ type: "ChatReplyRecorded", threadId: job.threadId, model: response.model, text: response.text, usage: response.usage }],
            [],
            { actor: "ai", actorId: response.model, device: "server", appVersion: "0.5.0" },
          );
          await db.chatJobs.update(job.jobId, { status: "done" });
          await db.outbox.where("sessionId").equals(job.sessionId).filter((r) => r.refType === "chat" && r.refId === job.jobId).modify({ status: "synced" });
        });
      },
      recordFailure: async (job, code) => {
        await appendAnyEvents(
          job.sessionId,
          [{ type: "ChatFailed", threadId: job.threadId, jobId: job.jobId, code }],
          [],
          { actor: "system", actorId: "app", device: "client", appVersion: "0.5.0" },
        );
      },
    });
    // Chat events were appended outside dispatchV2 — refold from storage if still active.
    // Guard on the init event: a session torn down mid-drain reloads to empty, and
    // foldV2 rightly throws without it — skip rather than crash the drain.
    if (get().sessionId === sessionId && get().v2Session) {
      const v2Events = (await loadStoredEvents(sessionId)) as V2SessionEvent[];
      if (v2Events.some((e) => e.type === "SessionInitialized")) {
        set({ v2Events, v2Session: foldV2(v2Events) });
      }
    }
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
      // The store only ever drives v1 sessions today; v2 logs never reach this path.
      const events = (await loadEvents(sessionId)) as SessionEvent[];
      set({ events, session: fold(config, events) });
    }
    await get().refreshReviewStatus();
  },

  async resolveFinding(findingId, zoneId, resolution, note) {
    await get().dispatch([{ type: "ReviewFindingResolved", findingId, zoneId, resolution, note }]);
  },
}));
