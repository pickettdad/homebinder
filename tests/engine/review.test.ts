/**
 * "Second look" semantics: review events fold correctly, findings never affect
 * completeness or gates, deferrals feed the gap list, and the server-side core
 * enforces the doctrine lint and id discipline.
 */
import { describe, expect, it } from "vitest";
import { parseRouteConfig } from "../../src/engine/schema/routeConfig";
import { baselineRoute } from "../../src/config/route.baseline";
import { fold } from "../../src/engine/fold";
import type { EventPayload, SessionEvent, Source } from "../../src/engine/schema/events";
import { EVENT_SCHEMA_VERSION } from "../../src/engine/schema/events";
import { visitTwoGaps, openFindings, sessionTotals } from "../../src/engine/selectors";
import { canCloseZone } from "../../src/engine/gate";
import { chunkZonePhotos } from "../../src/review/chunk";
import { lintFinding, validateFindings, parseModelJson } from "../../netlify/functions/lib/reviewCore";
import { buildManifest } from "../../src/engine/export/manifest";

const config = parseRouteConfig(baselineRoute);
const human: Source = { actor: "human", actorId: "test", device: "vitest", appVersion: "0.5.0" };
const ai: Source = { actor: "ai", actorId: "claude-haiku-4-5", device: "server", appVersion: "0.5.0" };

function log(payloads: (EventPayload & { __source?: Source })[]): SessionEvent[] {
  return payloads.map((p, i) => {
    const { __source, ...payload } = p;
    return {
      ...payload, eventId: `e${i}`, sessionId: "s1", seq: i + 1,
      at: "2026-07-21T10:00:00.000Z", schemaVersion: EVENT_SCHEMA_VERSION,
      source: __source ?? human,
    } as SessionEvent;
  });
}

const init: EventPayload = {
  type: "SessionInitialized", routeId: config.routeId, configVersion: config.configVersion,
  configHash: "h1", flags: [],
};

const finding = {
  findingId: "job1-0",
  slotInstanceId: "garage/gar.slab",
  mediaIds: ["m1"],
  severity: "reshoot" as const,
  message: "Photo too dark to judge the slab — reshoot with more light?",
  confidence: 0.8,
};

describe("review events in the fold", () => {
  const base: (EventPayload & { __source?: Source })[] = [
    init,
    { type: "PhotoCaptured", slotInstanceId: "garage/gar.slab", media: { mediaId: "m1", sha256: "x", mime: "image/jpeg", bytes: 1 } },
    {
      type: "ReviewRecorded", reviewJobId: "job1", zoneId: "garage", model: "claude-haiku-4-5",
      findings: [finding], usage: { inputTokens: 1000, outputTokens: 100 }, __source: ai,
    },
  ];

  it("records findings with model provenance and usage totals", () => {
    const state = fold(config, log(base));
    const garage = state.zones.find((z) => z.zoneId === "garage")!;
    expect(garage.findings).toHaveLength(1);
    expect(garage.findings[0]!.status).toBe("open");
    expect(garage.findings[0]!.model).toBe("claude-haiku-4-5");
    expect(state.reviewUsage).toEqual({ inputTokens: 1000, outputTokens: 100 });
    expect(openFindings(garage)).toBe(1);
  });

  it("dedupes findings by findingId across duplicate deliveries", () => {
    const dup = [...base, base[2]!];
    const state = fold(config, log(dup));
    const garage = state.zones.find((z) => z.zoneId === "garage")!;
    expect(garage.findings).toHaveLength(1);
    // usage counts both deliveries — spend is honest even when state dedupes
    expect(state.reviewUsage.inputTokens).toBe(2000);
  });

  it("findings never affect completeness, gates, or gap counts until deferred", () => {
    const state = fold(config, log(base));
    const garage = state.zones.find((z) => z.zoneId === "garage")!;
    expect(canCloseZone(garage)).toBe(false); // still blocked by ORDINARY missing slots only
    expect(visitTwoGaps(state, config).filter((g) => g.source === "ai-finding")).toHaveLength(0);
  });

  it("deferring a finding feeds the visit-two gap list and totals", () => {
    const state = fold(config, log([
      ...base,
      { type: "ReviewFindingResolved", findingId: "job1-0", zoneId: "garage", resolution: "deferred" },
    ]));
    const gaps = visitTwoGaps(state, config).filter((g) => g.source === "ai-finding");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.note).toContain("reshoot with more light");
    expect(sessionTotals(state, config).gapCount).toBeGreaterThan(0);
  });

  it("clearing and reshooting resolve without touching the gap list", () => {
    for (const resolution of ["cleared", "reshot"] as const) {
      const state = fold(config, log([
        ...base,
        { type: "ReviewFindingResolved", findingId: "job1-0", zoneId: "garage", resolution },
      ]));
      const garage = state.zones.find((z) => z.zoneId === "garage")!;
      expect(garage.findings[0]!.status).toBe(resolution);
      expect(visitTwoGaps(state, config).filter((g) => g.source === "ai-finding")).toHaveLength(0);
    }
  });

  it("exports findings in a separate aiReview manifest section", () => {
    const events = log(base);
    const state = fold(config, events);
    const manifest = buildManifest({
      state, config, events, exportedAt: "2026-07-21T13:00:00.000Z", appVersion: "0.5.0",
      reviewPendingCount: 2,
    });
    expect(manifest.aiReview.findings).toHaveLength(1);
    expect(manifest.aiReview.findings[0]!.status).toBe("open");
    expect(manifest.aiReview.pendingJobsAtExport).toBe(2);
    expect(manifest.aiReview.usage.inputTokens).toBe(1000);
  });
});

describe("route config gate.review", () => {
  it("defaults to none and parses 'ai' on the equipment zones", () => {
    const zone = (id: string) => config.zones.find((z) => z.id === id)!;
    expect(zone("arrival").gate.review).toBe("none");
    expect(zone("basement").gate.review).toBe("ai");
    expect(zone("garage").gate.review).toBe("ai");
    expect(zone("final-checks").gate.review).toBe("none");
  });
});

describe("chunking", () => {
  it("splits photos into bounded chunks preserving order", () => {
    const photos = Array.from({ length: 19 }, (_, i) => ({ slotInstanceId: `s${i % 5}`, mediaId: `m${i}` }));
    const chunks = chunkZonePhotos(photos, 8);
    expect(chunks.map((c) => c.length)).toEqual([8, 8, 3]);
    expect(chunks.flat().map((c) => c.mediaId)).toEqual(photos.map((p) => p.mediaId));
    expect(chunkZonePhotos([])).toEqual([]);
  });
});

describe("server review core", () => {
  const request = {
    job: { jobId: "job9" },
    slots: [{ slotInstanceId: "basement/bsmt.sump", defId: "bsmt.sump", label: "Sump" }],
    images: [{ mediaId: "mA", slotInstanceId: "basement/bsmt.sump", width: 1024, height: 768, dataBase64: "" }],
  };

  it("downgrades verdict language to info with neutral wording", () => {
    const bad = { ...finding, message: "This wiring is a code violation and definitely a hazard." };
    const { finding: linted, downgraded } = lintFinding(bad);
    expect(downgraded).toBe(true);
    expect(linted.severity).toBe("info");
    expect(linted.message).not.toMatch(/violation|hazard/i);
  });

  it("passes doctrine-compliant messages through untouched", () => {
    const ok = { ...finding, message: "Possible efflorescence near the corner — worth a moisture reading before you leave?" };
    expect(lintFinding(ok).downgraded).toBe(false);
  });

  it("drops findings referencing ids not in the request and mints deterministic ids", () => {
    const raw = {
      findings: [
        { slotInstanceId: "basement/bsmt.sump", mediaIds: ["mA", "mHALLUCINATED"], severity: "reshoot", message: "Glare over the label — reshoot at an angle?", confidence: 0.9 },
        { slotInstanceId: "nowhere/fake", mediaIds: [], severity: "anomaly", message: "made up", confidence: 0.9 },
      ],
    };
    const out = validateFindings(raw, request);
    expect(out).toHaveLength(1);
    expect(out[0]!.findingId).toBe("job9-0");
    expect(out[0]!.mediaIds).toEqual(["mA"]); // hallucinated media ref stripped
  });

  it("parses fenced and bare JSON, rejects garbage", () => {
    expect(parseModelJson('```json\n{"findings": []}\n```')).toEqual({ findings: [] });
    expect(parseModelJson('{"findings": []}')).toEqual({ findings: [] });
    expect(parseModelJson("no json here")).toBeNull();
  });
});
