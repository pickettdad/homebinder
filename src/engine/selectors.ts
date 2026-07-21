/**
 * Pure queries over SessionState. All completeness/gate semantics live here and in
 * gate.ts so they are unit-testable and reusable server-side later.
 */
import type { RouteConfig } from "./schema/routeConfig";
import type { SessionState, SlotState, ZoneState } from "./fold";

export type SlotProgress =
  | { kind: "pending" }               // nothing yet
  | { kind: "partial"; have: number; need: number } // some photos, below minCaptures
  | { kind: "needs-voice" }           // photos done, required voice note missing
  | { kind: "captured" }
  | { kind: "excepted"; reasonId: string };

export function slotProgress(slot: SlotState): SlotProgress {
  if (slot.exception) return { kind: "excepted", reasonId: slot.exception.reasonId };
  if (slot.photos.length === 0) return { kind: "pending" };
  if (slot.photos.length < slot.minCaptures) return { kind: "partial", have: slot.photos.length, need: slot.minCaptures };
  if (slot.voiceNote === "required" && slot.voiceNotes.length === 0) return { kind: "needs-voice" };
  return { kind: "captured" };
}

/** Resolved = counts toward completeness: fully captured or explicitly excepted. */
export function isSlotResolved(slot: SlotState): boolean {
  const p = slotProgress(slot);
  return p.kind === "captured" || p.kind === "excepted";
}

/**
 * afterAllTagged: a slot stays locked until every slot carrying the tag (across the
 * whole plan) is resolved. This is how the water-run re-check waits for the wet rooms.
 */
export function isSlotUnlocked(state: SessionState, slot: SlotState): boolean {
  for (const c of slot.constraints) {
    const tagged = state.zones.flatMap((z) => z.slots).filter((s) => s.tags.includes(c.tag));
    if (tagged.some((s) => !isSlotResolved(s))) return false;
  }
  return true;
}

export interface ZoneCounts {
  requiredTotal: number;
  requiredResolved: number;
  captured: number;
  excepted: number;
  deferred: number;
  optionalCaptured: number;
  optionalTotal: number;
}

export function zoneCounts(zone: ZoneState, config: RouteConfig): ZoneCounts {
  const gapReasons = new Set(config.exceptionReasons.filter((r) => r.feedsGapList).map((r) => r.id));
  const counts: ZoneCounts = {
    requiredTotal: 0, requiredResolved: 0, captured: 0, excepted: 0, deferred: 0,
    optionalCaptured: 0, optionalTotal: 0,
  };
  for (const slot of zone.slots) {
    const p = slotProgress(slot);
    if (!slot.required) {
      counts.optionalTotal += 1;
      if (p.kind === "captured") counts.optionalCaptured += 1;
      continue;
    }
    counts.requiredTotal += 1;
    if (p.kind === "captured") { counts.captured += 1; counts.requiredResolved += 1; }
    else if (p.kind === "excepted") {
      counts.requiredResolved += 1;
      if (gapReasons.has(p.reasonId)) counts.deferred += 1;
      else counts.excepted += 1;
    }
  }
  return counts;
}

/** Next incomplete required slot in route order — the auto-advance target. */
export function nextIncompleteSlot(state: SessionState, zoneId: string, afterInstanceId?: string): SlotState | undefined {
  const zone = state.zones.find((z) => z.zoneId === zoneId);
  if (!zone) return undefined;
  const startIdx = afterInstanceId ? zone.slots.findIndex((s) => s.instanceId === afterInstanceId) + 1 : 0;
  const eligible = (s: SlotState) => s.required && !isSlotResolved(s) && isSlotUnlocked(state, s);
  return zone.slots.slice(startIdx).find(eligible) ?? zone.slots.slice(0, startIdx).find(eligible);
}

export interface GapItem {
  slot: SlotState;
  zoneLabel: string;
  reasonId: string;
  note?: string;
  /** exception = deterministic gate exit; ai-finding = a deferred Second-look item. */
  source: "exception" | "ai-finding";
}

/** The visit-two gap list: gap-feeding exceptions plus deferred AI findings. */
export function visitTwoGaps(state: SessionState, config: RouteConfig): GapItem[] {
  const gapReasons = new Set(config.exceptionReasons.filter((r) => r.feedsGapList).map((r) => r.id));
  const gaps: GapItem[] = [];
  for (const zone of state.zones) {
    for (const slot of zone.slots)
      if (slot.exception && gapReasons.has(slot.exception.reasonId))
        gaps.push({
          slot, zoneLabel: zone.label, reasonId: slot.exception.reasonId,
          note: slot.exception.note, source: "exception",
        });
    for (const finding of zone.findings) {
      if (finding.status !== "deferred") continue;
      const slot = zone.slots.find((s) => s.instanceId === finding.slotInstanceId);
      if (!slot) continue;
      gaps.push({
        slot, zoneLabel: zone.label, reasonId: "ai-finding-deferred",
        note: finding.message, source: "ai-finding",
      });
    }
  }
  return gaps;
}

/** Open (undispositioned) Second-look findings for a zone. Advisory — blocks nothing. */
export function openFindings(zone: ZoneState): number {
  return zone.findings.filter((f) => f.status === "open").length;
}

export interface SessionTotals {
  requiredTotal: number;
  requiredResolved: number;
  photoCount: number;
  voiceCount: number;
  zonesClosed: number;
  zonesTotal: number;
  gapCount: number;
}

export function sessionTotals(state: SessionState, config: RouteConfig): SessionTotals {
  let requiredTotal = 0, requiredResolved = 0, photoCount = 0, voiceCount = 0;
  for (const zone of state.zones) {
    const c = zoneCounts(zone, config);
    requiredTotal += c.requiredTotal;
    requiredResolved += c.requiredResolved;
    for (const slot of zone.slots) {
      photoCount += slot.photos.length;
      voiceCount += slot.voiceNotes.length;
    }
  }
  return {
    requiredTotal,
    requiredResolved,
    photoCount,
    voiceCount,
    zonesClosed: state.zones.filter((z) => z.gate === "closed").length,
    zonesTotal: state.zones.length,
    gapCount: visitTwoGaps(state, config).length,
  };
}

/** Baseline photos for a reCheckOf slot (side-by-side comparison at capture time). */
export function reCheckBaseline(state: SessionState, slot: SlotState): SlotState | undefined {
  if (!slot.reCheckOf) return undefined;
  return state.zones.flatMap((z) => z.slots).find((s) => s.defId === slot.reCheckOf);
}
