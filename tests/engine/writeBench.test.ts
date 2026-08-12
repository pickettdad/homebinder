/**
 * The write-rate bench — the stage 4b named risk turned into something runnable.
 *
 * These state invariants about the MEASUREMENT rather than about any timing, because timings
 * are the thing being discovered and asserting one here would be inventing the answer. What
 * must hold is that the bench writes the same transaction shape the capture path writes (or
 * it measures a cheaper thing than the one that ships), that it never touches the field
 * database, and that a refusal is reported rather than thrown.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import Dexie from "dexie";
import {
  makeFrame,
  percentile,
  runWriteBench,
  summarize,
  type FireSample,
} from "../../src/dev/writeBench";
import { db } from "../../src/storage/db";

const params = { fires: 4, framesPerFire: 3, bytesPerFrame: 1024 };

describe("summarize — the numbers the screen reports", () => {
  const samples = (tx: number[]): FireSample[] =>
    tx.map((t, i) => ({ index: i, hashMs: 1, txMs: t }));

  it("returns nothing for no samples rather than a zeroed summary", () => {
    // A zeroed summary reads as "0 ms, excellent" — a run that never happened must be
    // distinguishable from a run that was instant.
    expect(summarize(params, [])).toBeNull();
  });

  it("counts frames as fires × frames-per-fire, not as fires", () => {
    // The bracket is the whole reason this measurement exists; a summary that counted fires
    // as photographs would understate the write volume threefold.
    const s = summarize(params, samples([1, 1, 1, 1]))!;
    expect(s.fires).toBe(4);
    expect(s.frames).toBe(12);
    expect(s.bytes).toBe(12 * 1024);
  });

  it("reports degradation above 1 when the commits slow as the database fills", () => {
    // The load-bearing figure: a room that starts fast and stalls at object thirty is exactly
    // what an average hides.
    const worsening = summarize(params, samples([10, 10, 10, 10, 40, 40, 40, 40]))!;
    expect(worsening.degradation).toBeGreaterThan(1.5);

    const steady = summarize(params, samples([10, 11, 10, 11, 10, 11, 10, 11]))!;
    expect(steady.degradation).toBeLessThan(1.5);
  });

  it("names which cost dominates, and says 'even' rather than picking a marginal winner", () => {
    // The split is the point — hashing and committing have different fixes, and a 55/45 split
    // must not be reported as a winner.
    const hashHeavy = summarize(params, [{ index: 0, hashMs: 100, txMs: 10 }])!;
    expect(hashHeavy.dominant).toBe("hashing");

    const commitHeavy = summarize(params, [{ index: 0, hashMs: 10, txMs: 100 }])!;
    expect(commitHeavy.dominant).toBe("commit");

    const even = summarize(params, [{ index: 0, hashMs: 55, txMs: 45 }])!;
    expect(even.dominant).toBe("even");
  });

  it("orders percentiles", () => {
    const values = [5, 1, 9, 3, 7];
    expect(percentile(values, 50)).toBeLessThanOrEqual(percentile(values, 95));
    expect(percentile([], 50)).toBe(0);
  });
});

describe("makeFrame", () => {
  it("produces a blob of exactly the requested size, for any size", () => {
    // Tiled from a 64 KB block, so the sizes that matter are the ones either side of a tile
    // boundary — a frame one byte short of a real photograph would quietly understate every
    // timing.
    for (const bytes of [1, 1024, 65_536, 65_537, 200_000]) {
      expect(makeFrame(bytes, 1).size, `${bytes} bytes`).toBe(bytes);
    }
  });

  it("is not a sparse all-zero buffer", async () => {
    const bytes = new Uint8Array(await makeFrame(4096, 7).arrayBuffer());
    expect(bytes.some((b) => b !== 0)).toBe(true);
  });
});

describe("runWriteBench — end to end", () => {
  it("writes one event, one media row and two outbox rows per frame, in one transaction per fire", async () => {
    // The invariant that makes the measurement meaningful: the bench must write the shape
    // appendEvents writes. If it wrote fewer rows it would measure a cheaper thing than the
    // one that ships, and report a rate the real loop cannot hit.
    //
    // Asserted by inspecting the bench database mid-run, because the bench deletes it on the
    // way out — that deletion is itself part of what is being guaranteed.
    let observed: { events: number; media: number; outbox: number } | null = null;

    const result = await runWriteBench(params, {
      onProgress: async (done) => {
        if (done !== params.fires || observed) return;
        const bench = await new Dexie("housesteady-writebench").open();
        observed = {
          events: await bench.table("events").count(),
          media: await bench.table("media").count(),
          outbox: await bench.table("outbox").count(),
        };
        bench.close();
      },
    });

    expect(result.error, result.error).toBeUndefined();
    expect(result.completedFires).toBe(params.fires);

    const frames = params.fires * params.framesPerFire;
    expect(observed).toEqual({ events: frames, media: frames, outbox: frames * 2 });
  });

  it("never writes to the field database", async () => {
    // Stated as a test rather than trusted to the database name. #71's one known variable is
    // pre-existing stored data, and a bench that seeded a gigabyte of synthetic frames into
    // the real database would be indistinguishable from a cause on the machine that can
    // finally investigate it.
    const before = await db.media.count();
    await runWriteBench({ fires: 2, framesPerFire: 2, bytesPerFrame: 512 });
    expect(await db.media.count()).toBe(before);
    expect(await db.events.count()).toBe(0);
  });

  it("removes its scratch database when it finishes", async () => {
    await runWriteBench({ fires: 1, framesPerFire: 1, bytesPerFrame: 512 });
    expect(await Dexie.exists("housesteady-writebench")).toBe(false);
  });

  it("records a summary whose frame count matches what it actually wrote", async () => {
    const result = await runWriteBench(params);
    expect(result.summary?.frames).toBe(result.completedFires * params.framesPerFire);
  });
});
