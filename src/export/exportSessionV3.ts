/**
 * Pin-model export packaging (PLAN-STAGE-1 §7) — manifest.json + media zips grouped by zone.
 *
 * Mirrors the v2 packaging doctrine deliberately: never one giant archive (~1GB in-memory zips
 * crash Safari and share-sheet handoffs of huge files fail unpredictably), so each group is
 * chunked at ~250MB; STORE mode only (JPEG/AAC don't recompress); every file is listed in the
 * manifest with its sha256 so "did it all arrive intact" is mechanical.
 *
 * The owner's rule (2026-07-25): an inspection is not finished until it has been **exported
 * cleanly out of the app** — written to the iPad's Files (or shared onward) so nothing can be
 * lost with the app. It does NOT have to leave the device at that moment; getting it to
 * cloud/USB is the next stage of the process. So "verified export" here means: the integrity
 * sweep passed AND every produced file was confirmed handed off.
 */
import { downloadZip } from "client-zip";
import { buildManifestV3, sweepMediaIntegrity, type IntegrityReport, type ManifestV3 } from "../engine/export/manifestV3";
import type { V2SessionEvent } from "../engine/v2/events";
import type { SessionStateV2 } from "../engine/v2/fold";
import { sha256Hex } from "../engine/canonical";
import { db } from "../storage/db";
import { APP_VERSION } from "../storage/sessionRepo";

const CHUNK_BYTES = 250 * 1024 * 1024;

export interface ExportFileV3 {
  name: string;
  bytes: number;
  kind: "manifest" | "media-zip";
  getFile: () => Promise<File>;
}

export interface ExportPlanV3 {
  manifest: ManifestV3;
  files: ExportFileV3[];
  /** Pre-export proof that every referenced media resolves to a stored blob of the right size. */
  integrity: IntegrityReport;
}

/** Human-readable group label for a zip filename: the zone's label, else the raw group key. */
function groupSlug(state: SessionStateV2, group: string): string {
  const zone = state.zones.find((z) => z.zoneId === group);
  const raw = zone?.label ?? group;
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || group
  );
}

export async function planExportV3(args: {
  state: SessionStateV2;
  events: V2SessionEvent[];
  configSnapshot: unknown;
  /** Recompute each media's sha256 as well as its byte count. Slower; off by default. */
  verifyHash?: boolean;
}): Promise<ExportPlanV3> {
  const { state, events, configSnapshot, verifyHash = false } = args;

  const manifest = buildManifestV3({
    state,
    events,
    configSnapshot,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
  });

  const integrity = await sweepMediaIntegrity(
    manifest.media,
    async (mediaId) => (await db.media.get(mediaId))?.blob,
    { verifyHash },
  );

  const shortId = state.sessionId.slice(0, 8);
  const files: ExportFileV3[] = [];

  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBlob = new Blob([manifestJson], { type: "application/json" });
  const manifestName = `housesteady-${shortId}-manifest.json`;
  files.push({
    name: manifestName,
    bytes: manifestBlob.size,
    kind: "manifest",
    getFile: async () => new File([manifestBlob], manifestName, { type: "application/json" }),
  });

  // One zip per group (zone, or `_misc` for inbox / no-zone pins), chunked at CHUNK_BYTES.
  const groups = [...new Set(manifest.media.map((m) => m.group))];
  for (const group of groups) {
    const items = manifest.media.filter((m) => m.group === group);
    if (items.length === 0) continue;

    const chunks: (typeof items)[] = [];
    let current: typeof items = [];
    let currentBytes = 0;
    for (const m of items) {
      if (current.length > 0 && currentBytes + m.bytes > CHUNK_BYTES) {
        chunks.push(current);
        current = [];
        currentBytes = 0;
      }
      current.push(m);
      currentBytes += m.bytes;
    }
    if (current.length) chunks.push(current);

    const slug = groupSlug(state, group);
    chunks.forEach((chunk, i) => {
      const suffix = chunks.length > 1 ? `-part${i + 1}` : "";
      const name = `housesteady-${shortId}-${slug}${suffix}.zip`;
      files.push({
        name,
        bytes: chunk.reduce((sum, m) => sum + m.bytes, 0),
        kind: "media-zip",
        getFile: async () => {
          const entries = [];
          for (const m of chunk) {
            const row = await db.media.get(m.mediaId);
            if (!row) throw new Error(`media ${m.mediaId} missing from storage`);
            entries.push({ name: m.file, lastModified: new Date(m.capturedAt), input: row.blob });
          }
          const blob = await downloadZip(entries).blob();
          return new File([blob], name, { type: "application/zip" });
        },
      });
    });
  }

  return { manifest, files, integrity };
}

export async function manifestV3Sha256(manifest: ManifestV3): Promise<string> {
  return sha256Hex(JSON.stringify(manifest, null, 2));
}
