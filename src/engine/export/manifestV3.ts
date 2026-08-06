/**
 * Manifest v3 — the binder-builder contract for the PIN model (PLAN-STAGE-1 §7).
 *
 * Self-contained by design: the full config snapshot + the verbatim event log travel with
 * the derived blocks, so the downstream binder builder can re-derive everything and the
 * derived views are a convenience/cross-check, not the trust root. Every media file is listed
 * with its sha256 and byte count so "did it all arrive intact" is a mechanical check.
 *
 * This is the pin-model successor to `manifest.ts` (v2, slot model), which cannot represent a
 * pin session. Packaging (`exportSession.ts`) groups media by the `group` key below; the media
 * path scheme follows §7: `media/<zone-or-_misc>/pin-<number>/…`, canvas photos under
 * `media/<zone>/_canvas/…`, zone-targeted media with no pin under `media/<zone>/_zone/…`,
 * inbox/unassigned under `media/_misc/_inbox/…`.
 */
import type { Source } from "../schema/events";
import type { PinFlag, PinTypeRef, V2SessionEvent, VisitKind } from "../v2/events";
import type {
  AnchorState,
  ChatMessage,
  LifecycleEntry,
  MediaRef,
  NoteState,
  ResolutionState,
  SessionStateV2,
} from "../v2/fold";

export const MANIFEST_V3_SCHEMA_VERSION = 3;

/** Group/path constant for media with no zone (misc-bucket pins and the inbox). */
const MISC = "_misc";

function extensionFor(mime: string): string {
  // Video is tested FIRST: "video/mp4" contains "mp4", and the audio branch below would
  // otherwise name an inspection video ".m4a" — a silently corrupt file in the binder.
  if (mime.startsWith("video/")) {
    if (mime.includes("quicktime")) return "mov";
    if (mime.includes("webm")) return "webm";
    return "mp4";
  }
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  return "bin";
}

/** Media kind in the manifest. `video` was added 2026-07-25; it rides in the visual
 *  (`photos`) collections beside stills, so kind is derived from mime, never assumed. */
export type MediaKindV3 = "photo" | "voice" | "video";

const kindOf = (mime: string): MediaKindV3 =>
  mime.startsWith("image") ? "photo" : mime.startsWith("video") ? "video" : "voice";

/** What a media file is attached to — the binder builder files it accordingly. */
export type MediaOwner =
  | { kind: "pin"; pinId: string; pinNumber: number }
  | { kind: "canvas"; canvasId: string }
  | { kind: "zone"; zoneId: string }
  | { kind: "inbox" };

export interface MediaFileEntryV3 {
  mediaId: string;
  kind: MediaKindV3;
  owner: MediaOwner;
  /** Zip grouping key: the zoneId, or `_misc` for inbox / no-zone (misc-bucket pin) media. */
  group: string;
  /** Path inside the media zip. */
  file: string;
  mime: string;
  bytes: number;
  sha256: string;
  capturedAt: string;
  durationMs?: number;
  caption?: string;
  source: Source;
}

export interface ManifestV3<TConfig = unknown> {
  manifestSchemaVersion: 3;
  session: {
    sessionId: string;
    propertyLabel?: string;
    flags: string[];
    /** What this visit came to do. Absent on sessions predating visit kinds (2026-08);
     *  absent is NOT discovery — see visitKindOf. */
    visitKind?: VisitKind;
    startedAt?: string;
    completedAt?: string;
    /** Full complete/reopen history — re-work is auditable (owner req 2026-07-24). */
    lifecycle: LifecycleEntry[];
    exportedAt: string;
    appVersion: string;
  };
  config: { configId: string; version: string; hash: string; snapshot: TConfig };
  zones: {
    zoneId: string;
    type: string;
    label: string;
    level?: string;
    attributes: Record<string, boolean>;
    closedAt?: string;
    closeNote?: string;
    canvases: { canvasId: string; kind: "photo"; retired: boolean; mediaId: string; file: string }[];
    /** The close-out audit snapshot recorded at ZoneClosed, if the zone was closed. */
    audit?: { coreUnresolved: string[]; standardUnresolved: number; naCount: number };
  }[];
  pins: {
    pinId: string;
    number: number;
    zoneId?: string;
    /** PinTypeRef: freeform types are preserved verbatim as {kind:"freeform",label} — never
     * collapsed to a bare string — so recurring freeform labels are a component-library signal
     * (PLAN-STAGE-1 §7 vocabulary telemetry). */
    type?: PinTypeRef;
    /** Human nickname, exported as its OWN field — never merged into `type` (§7 telemetry). */
    label?: string;
    flag: PinFlag | null;
    retired?: { at: string; note?: string };
    anchors: AnchorState[];
    mediaIds: string[];
    noteIds: string[];
    chatThreadIds: string[];
  }[];
  /** Unassigned captures at export — explicitly listed, never silently dropped. */
  inbox: { mediaIds: string[]; noteIds: string[] };
  notes: NoteState[];
  chats: { threadId: string; target: { kind: "pin" | "zone"; id: string }; messages: ChatMessage[] }[];
  /** Every recorded checklist attestation (zone/pin/session scope) — the audit substrate. */
  resolutions: ResolutionState[];
  media: MediaFileEntryV3[];
  totals: {
    zones: number;
    pins: number;
    canvases: number;
    photos: number;
    /** Counted separately from `photos` since 2026-07-25 — without this, videos would fall
     *  through every bucket and photos+voiceNotes would silently undercount mediaFiles. */
    videos: number;
    voiceNotes: number;
    notes: number;
    chats: number;
    inboxItems: number;
    mediaFiles: number;
    mediaBytes: number;
  };
  /** Events whose target vanished (retired/never-created) — surfaced, never dropped. */
  orphanEvents: V2SessionEvent[];
  events: V2SessionEvent[];
}

function collectMedia(state: SessionStateV2): MediaFileEntryV3[] {
  const out: MediaFileEntryV3[] = [];
  const push = (m: MediaRef, kind: MediaKindV3, owner: MediaOwner, group: string, sub: string) =>
    out.push({
      mediaId: m.mediaId,
      kind,
      owner,
      group,
      file: `media/${group}/${sub}/${m.mediaId}.${extensionFor(m.mime)}`,
      mime: m.mime,
      bytes: m.bytes,
      sha256: m.sha256,
      capturedAt: m.at,
      durationMs: m.durationMs,
      caption: m.caption,
      source: m.source,
    });

  for (const zone of state.zones) {
    // kindOf, not "photo": videos ride in the visual collection beside stills.
    for (const p of zone.photos) push(p, kindOf(p.mime), { kind: "zone", zoneId: zone.zoneId }, zone.zoneId, "_zone");
    for (const v of zone.voiceNotes) push(v, "voice", { kind: "zone", zoneId: zone.zoneId }, zone.zoneId, "_zone");
    for (const c of zone.canvases)
      push(c.media, "photo", { kind: "canvas", canvasId: c.canvasId }, zone.zoneId, "_canvas");
  }
  for (const pin of state.pins) {
    const group = pin.zoneId ?? MISC;
    const sub = `pin-${pin.number}`;
    const owner: MediaOwner = { kind: "pin", pinId: pin.pinId, pinNumber: pin.number };
    for (const p of pin.photos) push(p, kindOf(p.mime), owner, group, sub);
    for (const v of pin.voiceNotes) push(v, "voice", owner, group, sub);
  }
  for (const m of state.inbox) push(m, kindOf(m.mime), { kind: "inbox" }, MISC, "_inbox");
  return out;
}

export function buildManifestV3<TConfig = unknown>(args: {
  state: SessionStateV2;
  events: V2SessionEvent[];
  /** The per-session pinned checklist config snapshot (includes the layer definitions). */
  configSnapshot: TConfig;
  exportedAt: string;
  appVersion: string;
}): ManifestV3<TConfig> {
  const { state, events, configSnapshot, exportedAt, appVersion } = args;
  const media = collectMedia(state);
  const mediaIdsOf = (m: MediaRef) => m.mediaId;

  return {
    manifestSchemaVersion: MANIFEST_V3_SCHEMA_VERSION,
    session: {
      sessionId: state.sessionId,
      propertyLabel: state.propertyLabel,
      flags: state.propertyFlags,
      visitKind: state.visitKind,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      lifecycle: state.lifecycle,
      exportedAt,
      appVersion,
    },
    config: { configId: state.configId, version: state.configVersion, hash: state.configHash, snapshot: configSnapshot },
    zones: state.zones.map((z) => ({
      zoneId: z.zoneId,
      type: z.zoneType,
      label: z.label,
      level: z.level,
      attributes: z.attributes,
      closedAt: z.closedAt,
      closeNote: z.closeNote,
      canvases: z.canvases.map((c) => ({
        canvasId: c.canvasId,
        kind: c.kind,
        retired: c.retired,
        mediaId: c.media.mediaId,
        file: `media/${z.zoneId}/_canvas/${c.media.mediaId}.${extensionFor(c.media.mime)}`,
      })),
      audit: z.audit,
    })),
    pins: state.pins.map((p) => ({
      pinId: p.pinId,
      number: p.number,
      zoneId: p.zoneId,
      type: p.pinType,
      label: p.label,
      flag: p.flag,
      retired: p.retired,
      anchors: p.anchors,
      mediaIds: [...p.photos.map(mediaIdsOf), ...p.voiceNotes.map(mediaIdsOf)],
      noteIds: p.noteIds,
      chatThreadIds: p.chatThreadIds,
    })),
    inbox: { mediaIds: state.inbox.map(mediaIdsOf), noteIds: state.inboxNoteIds },
    notes: [...state.notes.values()],
    chats: [...state.chats.values()].map((t) => ({ threadId: t.threadId, target: t.target, messages: t.messages })),
    resolutions: [...state.resolutions.values()],
    media,
    totals: {
      zones: state.zones.length,
      pins: state.pins.length,
      canvases: state.zones.reduce((n, z) => n + z.canvases.length, 0),
      photos: media.filter((m) => m.kind === "photo").length,
      videos: media.filter((m) => m.kind === "video").length,
      voiceNotes: media.filter((m) => m.kind === "voice").length,
      notes: state.notes.size,
      chats: state.chats.size,
      inboxItems: state.inbox.length,
      mediaFiles: media.length,
      mediaBytes: media.reduce((n, m) => n + m.bytes, 0),
    },
    orphanEvents: state.orphanEvents,
    events,
  };
}

// ---- Pre-export integrity sweep (PLAN-STAGE-1 §7 / owner decision: "not done until a verified
// off-device copy exists"). Proves every active media reference resolves to a stored blob with the
// expected byte count — and, optionally, the expected sha256 — BEFORE an export is trusted.

export type IntegrityProblemKind = "missing-blob" | "byte-mismatch" | "hash-mismatch";

export interface IntegrityProblem {
  mediaId: string;
  file: string;
  kind: IntegrityProblemKind;
  detail: string;
}

export interface IntegrityReport {
  ok: boolean;
  checked: number;
  problems: IntegrityProblem[];
}

async function sha256OfBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify every media entry resolves to a stored blob of the expected size (and hash, if asked).
 * `loadBlob` is injected so this is storage-agnostic and unit-testable. Byte-count + existence
 * are format-agnostic and always run; `verifyHash` is opt-in because it assumes the stored
 * `sha256` is lowercase hex of the raw bytes.
 */
export async function sweepMediaIntegrity(
  media: MediaFileEntryV3[],
  loadBlob: (mediaId: string) => Promise<Blob | undefined>,
  opts: { verifyHash?: boolean } = {},
): Promise<IntegrityReport> {
  const problems: IntegrityProblem[] = [];
  for (const m of media) {
    const blob = await loadBlob(m.mediaId);
    if (!blob) {
      problems.push({ mediaId: m.mediaId, file: m.file, kind: "missing-blob", detail: "no stored blob" });
      continue;
    }
    if (blob.size !== m.bytes) {
      problems.push({
        mediaId: m.mediaId,
        file: m.file,
        kind: "byte-mismatch",
        detail: `expected ${m.bytes} bytes, stored ${blob.size}`,
      });
      continue;
    }
    if (opts.verifyHash) {
      const actual = await sha256OfBlob(blob);
      if (actual !== m.sha256) {
        problems.push({ mediaId: m.mediaId, file: m.file, kind: "hash-mismatch", detail: `expected ${m.sha256}` });
      }
    }
  }
  return { ok: problems.length === 0, checked: media.length, problems };
}
