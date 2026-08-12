/**
 * Write-rate bench — is the 4b capture loop's write pattern sustainable on the device?
 *
 * WHY THIS EXISTS. Capture-screen spec §4.1a-i removes the confirm sheet ("assume Use, never
 * Retake"), adds auto-capture, and fires a three-frame bracket in nameplate mode. Per shutter
 * fire that is three events, three blobs and six outbox rows committed in ONE transaction —
 * the bracket-is-one-call ruling — at up to roughly one fire per second. **The app has never
 * written faster than a human tapping a confirm sheet.** This is about an order of magnitude
 * past anything it has done, and until now nobody had measured it.
 *
 * ⚑ WHAT IT MEASURES, AND THE SPLIT IS THE WHOLE POINT. Two costs sit on the capture path and
 * they have completely different fixes:
 *
 *   - **sha256 over the frame** — `crypto.subtle` over ~4 MB, on the main thread today.
 *   - **the Dexie/IndexedDB commit** — events + blobs + outbox + the session bump.
 *
 * If hashing dominates, the fix is a worker, or having the native plugin return the digest it
 * can compute while writing the file. If the commit dominates, the fix is the filesystem. **A
 * single milliseconds-per-capture number cannot tell those apart**, which is why this reports
 * them separately and why one number would have been the wrong measurement.
 *
 * ⚑ ISOLATION, and it is deliberate beyond ordinary caution. This writes to its own database
 * (`housesteady-writebench`) and deletes it when it finishes. It never opens the field
 * database. **#71 is an undiagnosed failure whose one known variable is pre-existing stored
 * data** — a benchmark that left a gigabyte of synthetic frames in the real database would be
 * indistinguishable from a cause, on the one machine that can finally investigate it.
 *
 * A quota refusal is a RESULT, not a crash: the device saying "no more at 900 MB" is the
 * finding, so it is caught and reported with how far it got.
 */
import Dexie from "dexie";
import { sha256Hex } from "../engine/canonical";

const BENCH_DB = "housesteady-writebench";

/** Bytes per frame. The walk's photographs measured 1.3–5.2 MB; a 12 MP JPEG is ~4 MB. */
export const DEFAULT_FRAME_BYTES = 4_000_000;

export interface BenchParams {
  /** Shutter fires to simulate. */
  fires: number;
  /** Frames per fire — 3 is the nameplate bracket, 1 is an ordinary capture. */
  framesPerFire: number;
  bytesPerFrame: number;
}

export interface FireSample {
  index: number;
  /** sha256 across this fire's frames. */
  hashMs: number;
  /** The single Dexie transaction: events + media + outbox + session bump. */
  txMs: number;
}

export interface BenchSummary {
  fires: number;
  frames: number;
  bytes: number;
  /** Hashing + committing only — frame generation is excluded, since the real camera supplies it. */
  workMs: number;
  hashMsP50: number;
  hashMsP95: number;
  txMsP50: number;
  txMsP95: number;
  /** Sustained fires per second if the loop ran back to back. Auto-capture wants ~1. */
  firesPerSecond: number;
  /**
   * Last quarter's median commit ÷ the first quarter's. **This is the number that matters
   * most**: a fast average that degrades as the database fills is a room that starts fine and
   * stalls at object thirty, which is exactly the failure a short test hides.
   */
  degradation: number;
  /** Which of the two costs dominates — names the fix rather than leaving it to be argued. */
  dominant: "hashing" | "commit" | "even";
}

export interface BenchResult {
  params: BenchParams;
  samples: FireSample[];
  summary: BenchSummary | null;
  completedFires: number;
  /** Set when the device refused. The refusal and where it happened ARE the result. */
  error?: string;
}

/** Nearest-rank percentile over an already-unsorted list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1] ?? 0;
}

/** Median of a slice, used for the degradation ratio. */
function medianOf(values: readonly number[]): number {
  return percentile(values, 50);
}

export function summarize(params: BenchParams, samples: readonly FireSample[]): BenchSummary | null {
  if (samples.length === 0) return null;

  const hashes = samples.map((s) => s.hashMs);
  const txs = samples.map((s) => s.txMs);
  const workMs = samples.reduce((n, s) => n + s.hashMs + s.txMs, 0);
  const frames = samples.length * params.framesPerFire;

  // Quartile comparison rather than first-vs-last sample: one slow commit is noise, a slower
  // quarter is a trend. With fewer than four fires there is no trend to see, so it reports 1.
  const q = Math.floor(samples.length / 4);
  const degradation =
    q > 0 ? medianOf(txs.slice(-q)) / Math.max(medianOf(txs.slice(0, q)), 0.001) : 1;

  const hashTotal = hashes.reduce((n, v) => n + v, 0);
  const txTotal = txs.reduce((n, v) => n + v, 0);
  // "Even" is a real answer — if neither dominates, neither fix alone is sufficient, and
  // saying so beats naming a winner that is 55% of the cost.
  const ratio = hashTotal / Math.max(txTotal, 0.001);
  const dominant = ratio > 1.5 ? "hashing" : ratio < 0.667 ? "commit" : "even";

  return {
    fires: samples.length,
    frames,
    bytes: frames * params.bytesPerFrame,
    workMs,
    hashMsP50: percentile(hashes, 50),
    hashMsP95: percentile(hashes, 95),
    txMsP50: percentile(txs, 50),
    txMsP95: percentile(txs, 95),
    firesPerSecond: workMs > 0 ? (samples.length / workMs) * 1000 : 0,
    degradation,
    dominant,
  };
}

/**
 * A synthetic frame. Tiled from one 64 KB block rather than filled byte-by-byte, because a
 * four-million-iteration loop per frame would be a cost this bench invented and then measured.
 * Content is irrelevant to sha256 and IndexedDB timing; what matters is that the buffer is
 * real rather than a sparse all-zero page some engines special-case.
 */
export function makeFrame(bytes: number, seed: number): Blob {
  const CHUNK = 65_536;
  const chunk = new Uint8Array(Math.min(CHUNK, bytes));
  let x = (seed || 1) >>> 0;
  for (let i = 0; i < chunk.length; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    chunk[i] = (x >>> 24) & 0xff;
  }
  const buf = new Uint8Array(bytes);
  for (let off = 0; off < bytes; off += chunk.length) {
    buf.set(chunk.subarray(0, Math.min(chunk.length, bytes - off)), off);
  }
  return new Blob([buf], { type: "image/jpeg" });
}

class BenchDb extends Dexie {
  // Index shapes mirror the field database so index maintenance costs the same. A bench that
  // wrote to unindexed tables would measure a cheaper thing than the one that ships.
  sessions!: Dexie.Table<{ id: string; lastEventSeq: number; updatedAt: string }, string>;
  events!: Dexie.Table<{ sessionId: string; seq: number; event: unknown }, [string, number]>;
  media!: Dexie.Table<Record<string, unknown>, string>;
  outbox!: Dexie.Table<Record<string, unknown>, number>;

  constructor() {
    super(BENCH_DB);
    this.version(1).stores({
      sessions: "id",
      events: "[sessionId+seq], sessionId",
      media: "id, sessionId, slotInstanceId, targetId",
      outbox: "++id, sessionId, status",
    });
  }
}

/** Delete the bench database. Safe to call at any time; never touches the field database. */
export async function dropBenchDb(): Promise<void> {
  await Dexie.delete(BENCH_DB);
}

export async function runWriteBench(
  params: BenchParams,
  /**
   * `onProgress` is awaited. The screen's handler is a synchronous setState, so this costs it
   * nothing — but an un-awaited hook is fire-and-forget, and an observer that wants to look at
   * the bench database mid-run would race the cleanup that deletes it. Awaiting it also cannot
   * corrupt the measurement, because the reported rate is derived from `workMs` (hashing plus
   * committing) rather than from wall-clock across the loop.
   */
  opts: { onProgress?: (done: number, total: number) => void | Promise<void> } = {},
): Promise<BenchResult> {
  const samples: FireSample[] = [];
  let error: string | undefined;

  await dropBenchDb(); // never measure on top of a previous run's rows
  const bench = new BenchDb();
  const sessionId = "bench-session";

  try {
    await bench.open();
    await bench.sessions.put({ id: sessionId, lastEventSeq: 0, updatedAt: new Date().toISOString() });

    let seq = 0;
    for (let fire = 0; fire < params.fires; fire++) {
      // Generated OUTSIDE the timed region: the real camera supplies these bytes, so making
      // them is this harness's cost and not the capture path's.
      const frames = Array.from({ length: params.framesPerFire }, (_, i) =>
        makeFrame(params.bytesPerFrame, fire * 31 + i + 1),
      );

      const hashStart = performance.now();
      const digests: string[] = [];
      for (const f of frames) digests.push(await sha256Hex(f));
      const hashMs = performance.now() - hashStart;

      const now = new Date().toISOString();
      const eventRows = frames.map((f, i) => ({
        sessionId,
        seq: ++seq,
        event: {
          type: "PhotoAdded",
          eventId: `bench-${fire}-${i}`,
          sessionId,
          seq,
          at: now,
          schemaVersion: 2,
          media: { mediaId: `bench-${fire}-${i}`, sha256: digests[i], mime: "image/jpeg", bytes: f.size },
          target: { kind: "zone", id: "bench-zone" },
          intent: "nameplate",
          source: { actor: "human", actorId: "bench", device: "bench", appVersion: "bench" },
        },
      }));
      const mediaRows = frames.map((f, i) => ({
        id: `bench-${fire}-${i}`,
        sessionId,
        targetKind: "zone",
        targetId: "bench-zone",
        kind: "photo",
        mime: "image/jpeg",
        bytes: f.size,
        sha256: digests[i],
        capturedAt: now,
        blob: f,
      }));
      // Two outbox rows per frame — one for the event, one for the media — exactly as
      // appendEvents writes them.
      const outboxRows = frames.flatMap((_, i) => [
        { sessionId, refType: "event", refId: `bench-${fire}-${i}`, status: "pending", attempts: 0, createdAt: now },
        { sessionId, refType: "media", refId: `bench-${fire}-${i}`, status: "pending", attempts: 0, createdAt: now },
      ]);

      const txStart = performance.now();
      await bench.transaction("rw", [bench.sessions, bench.events, bench.media, bench.outbox], async () => {
        await bench.events.bulkAdd(eventRows);
        await bench.media.bulkAdd(mediaRows);
        await bench.outbox.bulkAdd(outboxRows);
        await bench.sessions.update(sessionId, { lastEventSeq: seq, updatedAt: now });
      });
      const txMs = performance.now() - txStart;

      samples.push({ index: fire, hashMs, txMs });
      await opts.onProgress?.(fire + 1, params.fires);
    }
  } catch (e) {
    // A QuotaExceededError here is the answer, not a bug. Report it with the fire count so
    // "it refused at 340 MB" is readable straight off the screen.
    error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  } finally {
    bench.close();
    await dropBenchDb();
  }

  return { params, samples, summary: summarize(params, samples), completedFires: samples.length, error };
}
