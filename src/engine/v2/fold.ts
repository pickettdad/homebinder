/**
 * v2 fold — pure function (events) → SessionStateV2.
 *
 * Differences from the v1 fold worth naming:
 * - Zones come from EVENTS (created as walked), not from config. The fold therefore
 *   needs no config at all; checklist item existence is derived on demand by
 *   checklist.ts from (config, state) — the fold only records resolutions.
 * - Unknown event types are ignored (forward compat). Events referencing unknown
 *   zones/pins/canvases/notes/media are diverted to orphanEvents, never dropped.
 * - Nothing is deleted: retired pins stay (their numbers are never reused within the
 *   visit), discarded media
 *   leaves the ref lists but the event trail remains in the log.
 */
import type { Source } from "../schema/events";
import type {
  CaptureTarget,
  ItemResolution,
  ItemScope,
  PinFlag,
  PinTypeRef,
  V2SessionEvent,
  ZoneAuditSnapshot,
  VisitKind,
} from "./events";
import { itemScopeKey } from "./events";

export interface MediaRef {
  mediaId: string;
  sha256: string;
  mime: string;
  bytes: number;
  at: string;
  durationMs?: number;
  /** Context caption ("panel, before dead-front photo") — set via MediaCaptioned. */
  caption?: string;
  source: Source;
}

export interface AnchorState {
  anchorId: string;
  canvasId: string;
  x: number;
  y: number;
}

export interface CanvasState {
  canvasId: string;
  kind: "photo";
  media: MediaRef;
  retired: boolean;
}

export interface ZoneStateV2 {
  zoneId: string;
  zoneType: string;
  label: string;
  /** Storey grouping for the walk list; absent on pre-level zones. */
  level?: string;
  attributes: Record<string, boolean>;
  closedAt?: string;
  closeNote?: string;
  audit?: ZoneAuditSnapshot;
  canvases: CanvasState[];
  photos: MediaRef[];
  voiceNotes: MediaRef[];
  noteIds: string[];
}

export interface PinStateV2 {
  pinId: string;
  number: number;
  /** Absent = session misc bucket. */
  zoneId?: string;
  pinType?: PinTypeRef;
  /** Human nickname ("water softener") layered on top of the component type — never replaces it. */
  label?: string;
  flag: PinFlag | null;
  retired?: { at: string; note?: string };
  anchors: AnchorState[];
  photos: MediaRef[];
  voiceNotes: MediaRef[];
  noteIds: string[];
  chatThreadIds: string[];
}

export interface NoteState {
  noteId: string;
  target: CaptureTarget;
  text: string;
  at: string;
  editedAt?: string;
  source: Source;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  mediaIds?: string[];
  model?: string;
  at: string;
  source: Source;
}

export interface ChatThreadState {
  threadId: string;
  target: { kind: "pin"; id: string } | { kind: "zone"; id: string };
  messages: ChatMessage[];
  lastFailure?: { jobId: string; code: string; at: string };
}

export interface ResolutionState {
  scope: ItemScope;
  itemId: string;
  resolution: ItemResolution;
  at: string;
  source: Source;
}

/** One entry in the visit's completion history — completed, then reopened (with why), then re-completed. */
export interface LifecycleEntry {
  type: "completed" | "reopened";
  at: string;
  reason?: string;
}

/** A recorded export — the visit's data written out of the app (manifest + media files). */
export interface ExportRecord {
  at: string;
  manifestSha256: string;
  files: { name: string; bytes: number; sha256?: string }[];
  /** Log position, so "has anything changed since the last export?" is answerable. */
  seq: number;
}

export interface SessionStateV2 {
  sessionId: string;
  configId: string;
  configVersion: string;
  configHash: string;
  propertyLabel?: string;
  propertyFlags: string[];
  /** Absent on sessions created before visit kinds existed — see `visitKindOf`. */
  visitKind?: VisitKind;
  zones: ZoneStateV2[];
  pins: PinStateV2[];
  /** Unassigned captures (target inbox), in capture order. */
  inbox: MediaRef[];
  /** Inbox-targeted notes, by id (rendered alongside inbox captures). */
  inboxNoteIds: string[];
  notes: Map<string, NoteState>;
  chats: Map<string, ChatThreadState>;
  /** Recorded checklist resolutions, keyed `${itemScopeKey(scope)}/${itemId}`. */
  resolutions: Map<string, ResolutionState>;
  startedAt?: string;
  /** Set while the visit is complete; CLEARED on reopen. The camera + editing gate on this. */
  completedAt?: string;
  /** Full complete/reopen history in order — the audit trail the owner asked to see. */
  lifecycle: LifecycleEntry[];
  /** Every export recorded for this visit, oldest first. */
  exports: ExportRecord[];
  lastEventSeq: number;
  lastPinNumber: number;
  lastActiveZoneId?: string;
  orphanEvents: V2SessionEvent[];
}

export const resolutionKey = (scope: ItemScope, itemId: string): string =>
  `${itemScopeKey(scope)}/${itemId}`;

/**
 * Has this visit been exported out of the app, with nothing recorded since?
 *
 * The owner's durability rule (2026-07-25): an inspection isn't finished until its data has been
 * written cleanly OUT of the app (iPad Files / share sheet — it need not leave the device yet;
 * cloud or USB is the next stage). Any event after the last export means the export is stale, so
 * this is deliberately strict: the last recorded export must be the newest thing in the log.
 */
export function exportIsCurrent(state: SessionStateV2): boolean {
  const last = state.exports[state.exports.length - 1];
  return !!last && last.seq === state.lastEventSeq;
}

const mediaRef = (
  media: { mediaId: string; sha256: string; mime: string; bytes: number },
  at: string,
  source: Source,
  durationMs?: number,
): MediaRef => ({ ...media, at, source, durationMs });

export function foldV2(events: V2SessionEvent[]): SessionStateV2 {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const init = sorted.find((e) => e.type === "SessionInitialized");
  if (!init || init.type !== "SessionInitialized") throw new Error("no SessionInitialized event");

  const state: SessionStateV2 = {
    sessionId: init.sessionId,
    configId: init.configId,
    configVersion: init.configVersion,
    configHash: init.configHash,
    propertyLabel: init.propertyLabel,
    propertyFlags: init.propertyFlags,
    visitKind: init.visitKind,
    zones: [],
    pins: [],
    inbox: [],
    inboxNoteIds: [],
    notes: new Map(),
    chats: new Map(),
    resolutions: new Map(),
    startedAt: init.at,
    lifecycle: [],
    exports: [],
    lastEventSeq: 0,
    lastPinNumber: 0,
    orphanEvents: [],
  };

  const zone = (id: string) => state.zones.find((z) => z.zoneId === id);
  const pin = (id: string) => state.pins.find((p) => p.pinId === id);
  const orphan = (e: V2SessionEvent) => state.orphanEvents.push(e);

  const allMediaLists = () => [
    state.inbox,
    ...state.pins.flatMap((p) => [p.photos, p.voiceNotes]),
    ...state.zones.flatMap((z) => [z.photos, z.voiceNotes]),
  ];

  const findMedia = (mediaId: string): MediaRef | undefined => {
    for (const list of allMediaLists()) {
      const ref = list.find((m) => m.mediaId === mediaId);
      if (ref) return ref;
    }
    return undefined;
  };

  /** Remove a media ref from every holder (pin/zone/inbox); undefined if unknown. */
  const detachMedia = (mediaId: string): MediaRef | undefined => {
    for (const list of allMediaLists()) {
      const idx = list.findIndex((m) => m.mediaId === mediaId);
      if (idx !== -1) return list.splice(idx, 1)[0];
    }
    return undefined;
  };

  const attachMedia = (ref: MediaRef, target: CaptureTarget, voice: boolean): boolean => {
    if (target.kind === "inbox") {
      state.inbox.push(ref);
      return true;
    }
    if (target.kind === "pin") {
      const p = pin(target.id);
      if (!p) return false;
      (voice ? p.voiceNotes : p.photos).push(ref);
      return true;
    }
    const z = zone(target.id);
    if (!z) return false;
    (voice ? z.voiceNotes : z.photos).push(ref);
    return true;
  };

  const detachNoteId = (noteId: string) => {
    for (const list of [
      state.inboxNoteIds,
      ...state.pins.map((p) => p.noteIds),
      ...state.zones.map((z) => z.noteIds),
    ]) {
      const idx = list.indexOf(noteId);
      if (idx !== -1) list.splice(idx, 1);
    }
  };

  const attachNoteId = (noteId: string, target: CaptureTarget): boolean => {
    if (target.kind === "inbox") {
      state.inboxNoteIds.push(noteId);
      return true;
    }
    if (target.kind === "pin") {
      const p = pin(target.id);
      if (!p) return false;
      p.noteIds.push(noteId);
      return true;
    }
    const z = zone(target.id);
    if (!z) return false;
    z.noteIds.push(noteId);
    return true;
  };

  for (const e of sorted) {
    state.lastEventSeq = Math.max(state.lastEventSeq, e.seq);
    switch (e.type) {
      case "SessionInitialized":
        break; // handled above; duplicates are ignored (first wins)
      case "PropertyFlagsCorrected":
        state.propertyFlags = e.propertyFlags;
        break;

      case "ZoneCreated":
        if (zone(e.zoneId)) break; // duplicate create — first wins
        state.zones.push({
          zoneId: e.zoneId,
          zoneType: e.zoneType,
          label: e.label,
          level: e.level,
          attributes: { ...e.attributes },
          canvases: [],
          photos: [],
          voiceNotes: [],
          noteIds: [],
        });
        state.lastActiveZoneId = e.zoneId;
        break;
      case "ZoneLevelSet": {
        const z = zone(e.zoneId);
        if (!z) orphan(e);
        else z.level = e.level;
        break;
      }
      case "ZoneRenamed": {
        const z = zone(e.zoneId);
        if (!z) orphan(e);
        else z.label = e.label;
        break;
      }
      case "ZoneRetyped": {
        const z = zone(e.zoneId);
        if (!z) orphan(e);
        else z.zoneType = e.zoneType;
        break;
      }
      case "ZoneAttributesSet": {
        const z = zone(e.zoneId);
        if (!z) orphan(e);
        else z.attributes = { ...z.attributes, ...e.attributes };
        break;
      }
      case "ZoneClosed": {
        const z = zone(e.zoneId);
        if (!z) orphan(e);
        else {
          z.closedAt = e.at;
          z.closeNote = e.note;
          z.audit = e.audit;
        }
        break;
      }
      case "ZoneReopened": {
        const z = zone(e.zoneId);
        if (!z) orphan(e);
        else {
          z.closedAt = undefined;
          z.closeNote = undefined;
          z.audit = undefined;
          state.lastActiveZoneId = e.zoneId;
        }
        break;
      }

      case "PinCreated":
        if (pin(e.pinId)) break; // duplicate create — first wins
        if (e.zoneId && !zone(e.zoneId)) {
          orphan(e);
          break;
        }
        state.pins.push({
          pinId: e.pinId,
          number: e.pinNumber,
          zoneId: e.zoneId,
          flag: null,
          anchors: [],
          photos: [],
          voiceNotes: [],
          noteIds: [],
          chatThreadIds: [],
        });
        state.lastPinNumber = Math.max(state.lastPinNumber, e.pinNumber);
        if (e.zoneId) state.lastActiveZoneId = e.zoneId;
        break;
      case "PinTyped": {
        const p = pin(e.pinId);
        if (!p) orphan(e);
        else p.pinType = e.pinType;
        break;
      }
      case "PinLabeled": {
        const p = pin(e.pinId);
        if (!p) orphan(e);
        else p.label = e.label || undefined;
        break;
      }
      case "PinFlagged": {
        const p = pin(e.pinId);
        if (!p) orphan(e);
        else p.flag = e.flag;
        break;
      }
      case "PinAssigned": {
        const p = pin(e.pinId);
        if (!p || (e.zoneId && !zone(e.zoneId))) {
          orphan(e);
          break;
        }
        // A pin moving to a DIFFERENT zone drops its anchors: anchors point at canvases that
        // belong to the old zone, so keeping them would place the pin on a floor plan of a room
        // it is no longer in (owner ruling 2026-07-25 — "if a pin is legitimately moving, they
        // need to be removed"; rare case). Re-assignment within the same zone keeps them.
        if (p.zoneId !== e.zoneId) p.anchors = [];
        p.zoneId = e.zoneId;
        if (e.zoneId) state.lastActiveZoneId = e.zoneId;
        break;
      }
      case "PinRetired": {
        const p = pin(e.pinId);
        if (!p) orphan(e);
        else p.retired = { at: e.at, note: e.note };
        break;
      }

      case "CanvasAdded": {
        const z = zone(e.zoneId);
        if (!z) {
          orphan(e);
          break;
        }
        if (z.canvases.some((c) => c.canvasId === e.canvasId)) break;
        z.canvases.push({ canvasId: e.canvasId, kind: e.kind, media: mediaRef(e.media, e.at, e.source), retired: false });
        break;
      }
      case "CanvasRetired": {
        const c = state.zones.flatMap((z) => z.canvases).find((c) => c.canvasId === e.canvasId);
        if (!c) orphan(e);
        else c.retired = true;
        break;
      }
      case "AnchorPlaced": {
        const p = pin(e.pinId);
        const canvasExists = state.zones.some((z) => z.canvases.some((c) => c.canvasId === e.canvasId));
        if (!p || !canvasExists) {
          orphan(e);
          break;
        }
        if (p.anchors.some((a) => a.anchorId === e.anchorId)) break;
        p.anchors.push({ anchorId: e.anchorId, canvasId: e.canvasId, x: e.x, y: e.y });
        break;
      }
      case "AnchorMoved": {
        const a = state.pins.flatMap((p) => p.anchors).find((a) => a.anchorId === e.anchorId);
        if (!a) orphan(e);
        else {
          a.x = e.x;
          a.y = e.y;
        }
        break;
      }
      case "AnchorRemoved": {
        let removed = false;
        for (const p of state.pins) {
          const idx = p.anchors.findIndex((a) => a.anchorId === e.anchorId);
          if (idx !== -1) {
            p.anchors.splice(idx, 1);
            removed = true;
            break;
          }
        }
        if (!removed) orphan(e);
        break;
      }

      case "PhotoAdded":
        if (!attachMedia(mediaRef(e.media, e.at, e.source, e.durationMs), e.target, false)) orphan(e);
        break;
      case "VoiceNoteAdded":
        if (!attachMedia(mediaRef(e.media, e.at, e.source, e.durationMs), e.target, true)) orphan(e);
        break;
      case "MediaDiscarded":
        if (!detachMedia(e.mediaId)) orphan(e);
        break;
      case "MediaCaptioned": {
        const ref = findMedia(e.mediaId);
        if (!ref) orphan(e);
        else ref.caption = e.text;
        break;
      }
      case "MediaReassigned": {
        const ref = detachMedia(e.mediaId);
        if (!ref) {
          orphan(e);
          break;
        }
        // Video has a duration but is *visual* evidence — it belongs in `photos`, not
        // `voiceNotes`. Without the video guard, re-filing a clip would silently reclassify
        // it as a voice note (added 2026-07-25 with video capture).
        const voice = ref.mime.startsWith("audio") || (ref.durationMs !== undefined && !ref.mime.startsWith("video"));
        if (!attachMedia(ref, e.target, voice)) {
          // Target vanished mid-retag: park it back in the inbox rather than lose it.
          state.inbox.push(ref);
          orphan(e);
        }
        break;
      }

      case "NoteAdded":
        if (state.notes.has(e.noteId)) break;
        if (!attachNoteId(e.noteId, e.target)) {
          orphan(e);
          break;
        }
        state.notes.set(e.noteId, { noteId: e.noteId, target: e.target, text: e.text, at: e.at, source: e.source });
        break;
      case "NoteEdited": {
        const n = state.notes.get(e.noteId);
        if (!n) orphan(e);
        else {
          n.text = e.text;
          n.editedAt = e.at;
        }
        break;
      }
      case "NoteReassigned": {
        const n = state.notes.get(e.noteId);
        if (!n) {
          orphan(e);
          break;
        }
        detachNoteId(e.noteId);
        if (!attachNoteId(e.noteId, e.target)) {
          state.inboxNoteIds.push(e.noteId);
          n.target = { kind: "inbox" };
          orphan(e);
          break;
        }
        n.target = e.target;
        break;
      }

      case "ItemResolved":
        if (scopeExists(e.scope)) {
          state.resolutions.set(resolutionKey(e.scope, e.itemId), {
            scope: e.scope,
            itemId: e.itemId,
            resolution: e.resolution,
            at: e.at,
            source: e.source,
          });
        } else orphan(e);
        break;
      case "ItemReopened":
        if (!state.resolutions.delete(resolutionKey(e.scope, e.itemId))) orphan(e);
        break;

      case "ChatMessageSent": {
        const targetExists = e.target.kind === "pin" ? !!pin(e.target.id) : !!zone(e.target.id);
        if (!targetExists) {
          orphan(e);
          break;
        }
        let thread = state.chats.get(e.threadId);
        if (!thread) {
          thread = { threadId: e.threadId, target: e.target, messages: [] };
          state.chats.set(e.threadId, thread);
          if (e.target.kind === "pin") pin(e.target.id)!.chatThreadIds.push(e.threadId);
        }
        thread.messages.push({ role: "user", text: e.text, mediaIds: e.mediaIds, at: e.at, source: e.source });
        break;
      }
      case "ChatReplyRecorded": {
        const thread = state.chats.get(e.threadId);
        if (!thread) orphan(e);
        else {
          thread.messages.push({ role: "assistant", text: e.text, model: e.model, at: e.at, source: e.source });
          thread.lastFailure = undefined;
        }
        break;
      }
      case "ChatFailed": {
        const thread = state.chats.get(e.threadId);
        if (!thread) orphan(e);
        else thread.lastFailure = { jobId: e.jobId, code: e.code, at: e.at };
        break;
      }

      case "SessionCompleted":
        state.completedAt = e.at;
        state.lifecycle.push({ type: "completed", at: e.at });
        break;
      case "SessionReopened":
        // Un-complete: the visit is live again (camera + editing return), and the
        // reopen — with its reason — joins the history so nothing is silent.
        state.completedAt = undefined;
        state.lifecycle.push({ type: "reopened", at: e.at, reason: e.reason });
        break;
      case "ExportProduced":
        // Tracked so the app can tell the inspector whether the visit's data has been written
        // out of the app yet (owner rule: an inspection isn't finished until it's exported
        // cleanly — see exportIsCurrent below).
        state.exports.push({ at: e.at, manifestSha256: e.manifestSha256, files: e.files, seq: e.seq });
        break;
      default:
        // Unknown event type (newer app version wrote it) — ignore, never throw.
        break;
    }
  }

  return state;

  function scopeExists(scope: ItemScope): boolean {
    if (scope.kind === "session") return true;
    if (scope.kind === "zone") return !!zone(scope.zoneId);
    return !!pin(scope.pinId);
  }
}
