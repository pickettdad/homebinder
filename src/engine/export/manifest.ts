/**
 * Export manifest — the structured handoff to the downstream pipeline (Phase 11 inbox).
 *
 * Self-contained by design: it embeds the full pinned config snapshot AND the verbatim
 * event log, so the pipeline can re-derive every slot state independently; the derived
 * blocks are a convenience and a cross-check, not the trust root. Every media file is
 * listed with its sha256 so "did everything arrive intact" is a mechanical check.
 */
import type { RouteConfig } from "../schema/routeConfig";
import type { SessionEvent, Source } from "../schema/events";
import type { SessionState } from "../fold";
import { slotProgress, visitTwoGaps, zoneCounts, sessionTotals } from "../selectors";

export const MANIFEST_SCHEMA_VERSION = 1;

export interface MediaFileEntry {
  mediaId: string;
  slotInstanceId: string;
  kind: "photo" | "voice";
  /** Path inside the zone zip, e.g. "media/basement/bsmt.furnace-nameplate/<mediaId>.jpg" */
  file: string;
  zoneId: string;
  mime: string;
  bytes: number;
  sha256: string;
  capturedAt: string;
  durationMs?: number;
  source: Source;
}

export interface ExportManifest {
  manifestSchemaVersion: number;
  session: {
    sessionId: string;
    propertyLabel?: string;
    flags: string[];
    startedAt?: string;
    completedAt?: string;
    exportedAt: string;
    appVersion: string;
  };
  config: { routeId: string; version: string; hash: string; snapshot: RouteConfig };
  rooms: SessionState["rooms"];
  slotStates: {
    slotInstanceId: string;
    defId: string;
    zoneId: string;
    roomInstanceId?: string;
    label: string;
    required: boolean;
    status: string;
    photoCount: number;
    voiceCount: number;
    exception?: { reasonId: string; note?: string; at: string };
  }[];
  zoneSummaries: { zoneId: string; label: string; gate: "open" | "closed"; counts: ReturnType<typeof zoneCounts> }[];
  visitTwoGaps: { slotInstanceId: string; defId: string; zoneId: string; zoneLabel: string; label: string; reasonId: string; note?: string }[];
  totals: ReturnType<typeof sessionTotals>;
  media: MediaFileEntry[];
  orphanEvents: SessionEvent[];
  events: SessionEvent[];
}

function extensionFor(mime: string): string {
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  return "bin";
}

/** slotInstanceId already starts with "<zoneId>/", so the path is fully readable. */
export function mediaFilePath(slotInstanceId: string, mediaId: string, mime: string): string {
  return `media/${slotInstanceId}/${mediaId}.${extensionFor(mime)}`;
}

export function buildManifest(args: {
  state: SessionState;
  config: RouteConfig;
  events: SessionEvent[];
  exportedAt: string;
  appVersion: string;
}): ExportManifest {
  const { state, config, events, exportedAt, appVersion } = args;

  const media: MediaFileEntry[] = [];
  for (const zone of state.zones) {
    for (const slot of zone.slots) {
      for (const p of slot.photos)
        media.push({
          mediaId: p.mediaId, slotInstanceId: slot.instanceId, kind: "photo",
          file: mediaFilePath(slot.instanceId, p.mediaId, p.mime),
          zoneId: zone.zoneId, mime: p.mime, bytes: p.bytes, sha256: p.sha256,
          capturedAt: p.at, source: p.source,
        });
      for (const v of slot.voiceNotes)
        media.push({
          mediaId: v.mediaId, slotInstanceId: slot.instanceId, kind: "voice",
          file: mediaFilePath(slot.instanceId, v.mediaId, v.mime),
          zoneId: zone.zoneId, mime: v.mime, bytes: v.bytes, sha256: v.sha256,
          capturedAt: v.at, durationMs: v.durationMs, source: v.source,
        });
    }
  }

  return {
    manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
    session: {
      sessionId: state.sessionId,
      propertyLabel: state.propertyLabel,
      flags: state.flags,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      exportedAt,
      appVersion,
    },
    config: { routeId: state.routeId, version: state.configVersion, hash: state.configHash, snapshot: config },
    rooms: state.rooms,
    slotStates: state.zones.flatMap((zone) =>
      zone.slots.map((slot) => ({
        slotInstanceId: slot.instanceId,
        defId: slot.defId,
        zoneId: zone.zoneId,
        roomInstanceId: slot.roomInstanceId,
        label: slot.label,
        required: slot.required,
        status: slotProgress(slot).kind,
        photoCount: slot.photos.length,
        voiceCount: slot.voiceNotes.length,
        exception: slot.exception
          ? { reasonId: slot.exception.reasonId, note: slot.exception.note, at: slot.exception.at }
          : undefined,
      })),
    ),
    zoneSummaries: state.zones.map((z) => ({
      zoneId: z.zoneId, label: z.label, gate: z.gate, counts: zoneCounts(z, config),
    })),
    visitTwoGaps: visitTwoGaps(state, config).map((g) => ({
      slotInstanceId: g.slot.instanceId, defId: g.slot.defId, zoneId: g.slot.zoneId,
      zoneLabel: g.zoneLabel, label: g.slot.label, reasonId: g.reasonId, note: g.note,
    })),
    totals: sessionTotals(state, config),
    media,
    orphanEvents: state.orphanEvents,
    events,
  };
}
