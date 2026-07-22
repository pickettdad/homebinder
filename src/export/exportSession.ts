/**
 * Export: manifest.json + per-zone media zips, handed off via the share sheet
 * (AirDrop / Save to Files) with a download fallback.
 *
 * Never one giant archive: ~1GB in-memory zips crash Safari, and share-sheet handoffs
 * of huge files fail unpredictably. Zones are chunked at ~250MB (a dense zone can split
 * into part-1/part-2). STORE mode only — JPEG/AAC don't recompress. The manifest lists
 * every file with its sha256 so the downstream pipeline verifies arrival mechanically;
 * the share sheet's own success signal is unreliable and is not trusted.
 */
import { downloadZip } from "client-zip";
import type { RouteConfig } from "../engine/schema/routeConfig";
import type { SessionState } from "../engine/fold";
import type { SessionEvent } from "../engine/schema/events";
import { buildManifest, type ExportManifest } from "../engine/export/manifest";
import { sha256Hex } from "../engine/canonical";
import { db } from "../storage/db";
import { APP_VERSION } from "../storage/sessionRepo";

const CHUNK_BYTES = 250 * 1024 * 1024;

export interface ExportFile {
  name: string;
  bytes: number;
  kind: "manifest" | "media-zip";
  getFile: () => Promise<File>;
}

export interface ExportPlan {
  manifest: ExportManifest;
  files: ExportFile[];
}

export async function planExport(args: {
  state: SessionState;
  config: RouteConfig;
  events: SessionEvent[];
  reviewPendingCount?: number;
}): Promise<ExportPlan> {
  const { state, config, events, reviewPendingCount } = args;
  const manifest = buildManifest({
    state, config, events,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    reviewPendingCount,
  });

  const shortId = state.sessionId.slice(0, 8);
  const files: ExportFile[] = [];

  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBlob = new Blob([manifestJson], { type: "application/json" });
  files.push({
    name: `housesteady-${shortId}-manifest.json`,
    bytes: manifestBlob.size,
    kind: "manifest",
    getFile: async () =>
      new File([manifestBlob], `housesteady-${shortId}-manifest.json`, { type: "application/json" }),
  });

  // Chunk each zone's media at CHUNK_BYTES.
  for (const zone of state.zones) {
    const zoneMedia = manifest.media.filter((m) => m.zoneId === zone.zoneId);
    if (zoneMedia.length === 0) continue;
    const chunks: (typeof zoneMedia)[] = [];
    let current: typeof zoneMedia = [];
    let currentBytes = 0;
    for (const m of zoneMedia) {
      if (current.length > 0 && currentBytes + m.bytes > CHUNK_BYTES) {
        chunks.push(current);
        current = [];
        currentBytes = 0;
      }
      current.push(m);
      currentBytes += m.bytes;
    }
    if (current.length) chunks.push(current);

    chunks.forEach((chunk, i) => {
      const suffix = chunks.length > 1 ? `-part${i + 1}` : "";
      const name = `housesteady-${shortId}-${zone.zoneId}${suffix}.zip`;
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

  return { manifest, files };
}

export type HandoffResult = "shared" | "downloaded" | "failed";

/** Share one export file; falls back to an <a download> when share isn't available. */
export async function handoffFile(file: File): Promise<HandoffResult> {
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return "failed";
      // fall through to download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}

export async function manifestSha256(manifest: ExportManifest): Promise<string> {
  return sha256Hex(JSON.stringify(manifest, null, 2));
}
