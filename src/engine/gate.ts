/**
 * Zone-gate enforcement — deterministic, local, instant. A zone cannot close while any
 * required slot is neither captured nor explicitly excepted. This is Tier 1 doctrine:
 * completeness never waits on a model or a signal bar.
 *
 * GateReviewer is the v1 seam: the AI zone review plugs in behind this interface.
 * v0.5 ships the pass-through only.
 */
import type { ZoneState, SlotState } from "./fold";
import { slotProgress } from "./selectors";

export type GateGapKind = "no-photo" | "below-min" | "voice-required";

export interface GateGap {
  slot: SlotState;
  kind: GateGapKind;
  detail: string;
}

/** Everything blocking this zone's gate. Empty array = zone may close. */
export function gateOutstanding(zone: ZoneState): GateGap[] {
  const gaps: GateGap[] = [];
  for (const slot of zone.slots) {
    if (!slot.required) continue;
    const p = slotProgress(slot);
    switch (p.kind) {
      case "captured":
      case "excepted":
        break;
      case "pending":
        gaps.push({ slot, kind: "no-photo", detail: "no photo captured" });
        break;
      case "partial":
        gaps.push({ slot, kind: "below-min", detail: `${p.have} of ${p.need} minimum captures` });
        break;
      case "needs-voice":
        gaps.push({ slot, kind: "voice-required", detail: "voice note required for this slot" });
        break;
    }
  }
  return gaps;
}

export function canCloseZone(zone: ZoneState): boolean {
  return gateOutstanding(zone).length === 0;
}

export interface GateReviewFinding {
  slotInstanceId: string;
  severity: "info" | "reshoot" | "anomaly";
  message: string;
}

/** v1 seam: AI zone review implements this. Never blocks the deterministic gate. */
export interface GateReviewer {
  review(zone: ZoneState): Promise<GateReviewFinding[]>;
}

export class PassThroughReviewer implements GateReviewer {
  async review(): Promise<GateReviewFinding[]> {
    return [];
  }
}
