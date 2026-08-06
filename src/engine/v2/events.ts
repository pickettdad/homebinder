/**
 * v2 session events — the append-only vocabulary for the pin/anchor/checklist model
 * (REDESIGN-v2 §3, PLAN-STAGE-1 §3).
 *
 * Same doctrine as v1 (schema/events.ts): every field-visible action is one immutable
 * event; state is a pure fold; corrections are new events; every event carries
 * provenance. v1 and v2 events share EventBase/Source and the storage layer, but form
 * separate unions — a session is either v1 (slot model) or v2 (pin model), never both,
 * and each fold only ever sees its own union. The "SessionInitialized" type string is
 * shared with v1 deliberately (same lifecycle meaning); the payload differs and is
 * disambiguated by the session's kind, never by sniffing the event.
 *
 * Key decisions encoded here:
 * - Pin numbers are SESSION-SCOPED: sequential and stable across zones WITHIN one visit,
 *   never reused after a retire (gaps are fine), and they restart at #1 on the next visit
 *   because the counter lives on the session row. They are a label for saying "pin #4" out
 *   loud in a room — NOT a cross-visit key. `pinId` (uuid, minted offline) is the identity
 *   the binder adopts as canonical; the session-plan import carries it between visits.
 *   Said this precisely because the looser phrasing here ("global, permanent") is what
 *   PLAN-STAGE-1 §7b read as cross-visit identity and asserted for weeks (F-29).
 *   The number is stamped by appendEvents inside the storage transaction (lastPinNumber
 *   pattern); callers pass pinNumber: 0 as a placeholder and must read the stamped event back.
 * - Checklist item RESOLUTION is recorded; item EXISTENCE is derived (checklist.ts) —
 *   so config or pin changes re-derive cleanly and nothing stale is persisted.
 * - attest discipline (master §2): "action" items may only ever be resolved by an
 *   explicit human ItemResolved carrying a pass/fail result. Nothing in this schema
 *   lets software satisfy them — enforcement lives in the UI + audit, but the record
 *   shape (result on the resolution) is defined here.
 */
import type { EventBase, CaptureMediaMeta } from "../schema/events";

export const EVENT_SCHEMA_VERSION_V2 = 2;

export type PinFlag = "fine" | "monitor" | "issue";

/**
 * What this visit came to do (Capture Mode spec §1). Set once at session start and never
 * corrected.
 *
 * There is deliberately NO `VisitKindCorrected` event, and the distinction is not "we think
 * it won't change" — it is that this is a different KIND of fact from the one that earned a
 * correction event. `PropertyFlagsCorrected` exists because a fact about the HOUSE proved
 * wrong on site: there is propane after all. Visit kind is a fact about what we came to do,
 * decided by the schedule before anyone arrives, and never discovered in a basement. A visit
 * whose kind changes is a different visit.
 *
 * If that is ever wrong it is cheap to revise: the log is append-only, so adding a correction
 * event later is purely additive — new type, one fold case, no migration.
 *
 * `monthly` is here even though the monthly visit's shape is undesigned (owner, 2026-08-05),
 * because the KIND is the durable fact and the log is permanent: recording a monthly visit as
 * an inspection is unrecoverable, while the mode it renders as is derived and revisable. See
 * `modeForVisit` in checklist.ts for that seam.
 */
export type VisitKind = "discovery" | "inspection" | "monthly";

/** Where a pin's type comes from: the component library, or freeform (REDESIGN §3). */
export type PinTypeRef =
  | { kind: "component"; componentType: string }
  | { kind: "freeform"; label: string };

/**
 * Media/notes attach to a pin, a zone, or the session inbox. Canvas photos are not a
 * target — the canvas photo IS the CanvasAdded event's media.
 */
export type CaptureTarget =
  | { kind: "pin"; id: string }
  | { kind: "zone"; id: string }
  | { kind: "inbox" };

/** Which checklist an ItemResolved/ItemReopened addresses. Component items are per-pin. */
export type ItemScope =
  | { kind: "zone"; zoneId: string }
  | { kind: "pin"; pinId: string }
  | { kind: "session" };

/** Canonical string key for an ItemScope — used by fold state maps and selectors. */
export function itemScopeKey(scope: ItemScope): string {
  if (scope.kind === "zone") return `zone:${scope.zoneId}`;
  if (scope.kind === "pin") return `pin:${scope.pinId}`;
  return "session";
}

export type ItemResolution =
  | {
      kind: "satisfied";
      // "choice" (master v1.3) records the selected option in evidence.value — the same
      // slot `measure` uses, so the binder reads one structured field for both.
      via: "pin" | "check" | "note" | "measure" | "photo" | "choice";
      /** For attest:action items (tests): the outcome, recorded verbatim. */
      result?: "pass" | "fail";
      evidence?: {
        pinId?: string;
        noteId?: string;
        mediaId?: string;
        value?: number | string;
        unit?: string;
      };
      note?: string;
    }
  | { kind: "na"; reasonId: string; note?: string };

export interface ZoneAuditSnapshot {
  coreUnresolved: string[];
  standardUnresolved: number;
  naCount: number;
}

export type V2SessionEvent =
  | (EventBase & {
      type: "SessionInitialized";
      configId: string;
      configVersion: string;
      configHash: string;
      propertyFlags: string[];
      propertyLabel?: string;
      /** Optional so pre-2026-08 logs still fold; absent means a session that predates
       *  visit kinds, NOT a discovery visit. `visitKindOf` distinguishes the two. */
      visitKind?: VisitKind;
    })
  /** ses.triggers-confirmed: intake flags confirmed or corrected on site. Full replacement. */
  | (EventBase & { type: "PropertyFlagsCorrected"; propertyFlags: string[]; note?: string })
  // ---- zones (created as walked — never from config)
  | (EventBase & {
      type: "ZoneCreated";
      zoneId: string;
      zoneType: string;
      label: string;
      attributes: Record<string, boolean>;
      /** Storey grouping for the walk list: "basement" | "main" | "second" | … | "exterior". */
      level?: string;
    })
  | (EventBase & { type: "ZoneRenamed"; zoneId: string; label: string })
  | (EventBase & { type: "ZoneRetyped"; zoneId: string; zoneType: string })
  | (EventBase & { type: "ZoneLevelSet"; zoneId: string; level: string })
  | (EventBase & { type: "ZoneAttributesSet"; zoneId: string; attributes: Record<string, boolean> })
  | (EventBase & { type: "ZoneClosed"; zoneId: string; note?: string; audit: ZoneAuditSnapshot })
  | (EventBase & { type: "ZoneReopened"; zoneId: string; note?: string })
  // ---- pins (numbers session-scoped: see the header — never a cross-visit key)
  | (EventBase & { type: "PinCreated"; pinId: string; pinNumber: number; zoneId?: string })
  | (EventBase & { type: "PinTyped"; pinId: string; pinType: PinTypeRef })
  /** Human sub-label / nickname — additive; the component type tag is unchanged. */
  | (EventBase & { type: "PinLabeled"; pinId: string; label: string })
  | (EventBase & { type: "PinFlagged"; pinId: string; flag: PinFlag | null })
  | (EventBase & { type: "PinAssigned"; pinId: string; zoneId?: string })
  | (EventBase & { type: "PinRetired"; pinId: string; note?: string })
  // ---- canvases + anchors (photo canvases in Stage 1; kind leaves room for "plan")
  | (EventBase & { type: "CanvasAdded"; canvasId: string; zoneId: string; kind: "photo"; media: CaptureMediaMeta })
  | (EventBase & { type: "CanvasRetired"; canvasId: string })
  | (EventBase & { type: "AnchorPlaced"; anchorId: string; pinId: string; canvasId: string; x: number; y: number })
  | (EventBase & { type: "AnchorMoved"; anchorId: string; x: number; y: number })
  | (EventBase & { type: "AnchorRemoved"; anchorId: string })
  // ---- media + notes, target-addressed (inbox → retag later)
  // durationMs is set only for video (added 2026-07-25); stills omit it. Video is filed as
  // visual evidence through PhotoAdded rather than VoiceNoteAdded — it belongs beside stills.
  | (EventBase & { type: "PhotoAdded"; media: CaptureMediaMeta; target: CaptureTarget; durationMs?: number })
  | (EventBase & { type: "VoiceNoteAdded"; media: CaptureMediaMeta; target: CaptureTarget; durationMs?: number })
  | (EventBase & { type: "MediaDiscarded"; mediaId: string })
  | (EventBase & { type: "MediaReassigned"; mediaId: string; target: CaptureTarget })
  /** Short context caption on a capture ("panel, before dead-front photo") — travels with it. */
  | (EventBase & { type: "MediaCaptioned"; mediaId: string; text: string })
  | (EventBase & { type: "NoteAdded"; noteId: string; target: CaptureTarget; text: string })
  | (EventBase & { type: "NoteEdited"; noteId: string; text: string })
  | (EventBase & { type: "NoteReassigned"; noteId: string; target: CaptureTarget })
  // ---- checklist resolution (existence is derived, never evented)
  | (EventBase & { type: "ItemResolved"; scope: ItemScope; itemId: string; resolution: ItemResolution })
  | (EventBase & { type: "ItemReopened"; scope: ItemScope; itemId: string })
  // ---- on-demand chat, recorded (actor ai on replies via Source)
  | (EventBase & {
      type: "ChatMessageSent";
      threadId: string;
      target: { kind: "pin"; id: string } | { kind: "zone"; id: string };
      text: string;
      mediaIds: string[];
    })
  | (EventBase & {
      type: "ChatReplyRecorded";
      threadId: string;
      model: string;
      text: string;
      usage?: { inputTokens: number; outputTokens: number };
    })
  | (EventBase & { type: "ChatFailed"; threadId: string; jobId: string; code: string })
  // ---- lifecycle
  | (EventBase & { type: "SessionCompleted" })
  /** Un-completes a finished inspection so it can be edited again; reason is logged. */
  | (EventBase & { type: "SessionReopened"; reason: string })
  | (EventBase & {
      type: "ExportProduced";
      manifestSha256: string;
      files: { name: string; bytes: number; sha256?: string }[];
    });

export type V2SessionEventType = V2SessionEvent["type"];

/** Payload = an event minus everything the appender stamps. */
export type V2EventPayload = V2SessionEvent extends infer E
  ? E extends EventBase
    ? Omit<E, keyof EventBase>
    : never
  : never;
