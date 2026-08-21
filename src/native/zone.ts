/**
 * The zone session — three bounded modes over one coordinate space.
 *
 * ⚑ **The rule this file exists to hold: a position is measured or it is absent, and it is never
 * inferred.** A container whose anchor frame was taken while the session was paused is unpositioned
 * forever and nothing downstream can tell — it does not arrive wrong, it arrives *absent*, and an
 * absence is indistinguishable from a container nobody positioned on purpose. So the refusal is a
 * value the caller has to handle, not a `null` it can shrug at.
 *
 * The predicates live here rather than in a component for the reason `traverseVerdict` and
 * `frameStateOf` do: doctrine inside a component cannot be scanned or tested.
 */

/** The three bounded jobs. Nothing holds world tracking across a two-to-three hour visit. */
export const ZONE_MODES = ["roomplan", "mesh", "positioning"] as const;
export type ZoneMode = (typeof ZONE_MODES)[number];

export interface ZoneOpened {
  zoneId: string;
  startedAt: string;
  mode: ZoneMode;
  unmet: string[];
  meshSupported: boolean;
  roomPlanSupported: boolean;
}

/**
 * A measured position, or the reason there is not one.
 *
 * ⚑ **`positioned` is the discriminant and the refusal carries `why`.** A shape where the caller can
 * read `x` without first reading `positioned` is a shape where a missing position becomes 0,0,0 —
 * which is a real place in the zone, roughly where the concierge was standing when it opened.
 */
export type ZonePosition =
  | {
      positioned: true;
      zoneId: string;
      tracking: string;
      mode: ZoneMode;
      at: string;
      x: number;
      y: number;
      z: number;
      /** Column-major 4×4. A pose without an orientation cannot say which way the camera faced. */
      transform: number[];
      /** ⚑ Where the lens was POINTING, when geometry existed to hit. The pose is where the
       *  concierge stood; this is the surface in front of them, and the desk needs both to tell
       *  them apart. Absent means the mesh had no answer — *unknown*, never *nothing there*. */
      surface?: { x: number; y: number; z: number; distance: number };
    }
  | { positioned: false; why: string; tracking?: string };

export interface ZoneSurface {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
  z: number;
  confidence: string;
  transform: number[];
}

export interface ZonePlan {
  captured: boolean;
  why?: string;
  zoneId?: string;
  walls?: ZoneSurface[];
  doors?: ZoneSurface[];
  windows?: ZoneSurface[];
  openings?: ZoneSurface[];
  /** ⚑ RoomPlan's own object list, and it is NOT the object container. Its taxonomy knows sofas and
   *  refrigerators and has no water heater, no softener, no pressure tank — so reading it as an
   *  inventory would under-count exactly the rooms this service exists for. Context, nothing more. */
  roomPlanObjects?: { id: string; category: string; width: number; height: number; depth: number }[];
}

/**
 * ⚑ **Can this container be anchored right now?**
 *
 * Asked before the shutter rather than after, because the answer *no, the session is paused* is
 * actionable in the room and useless afterwards. Three reasons a position is unavailable and they
 * are not the same thing: no zone is open, the session is paused between containers, or tracking has
 * not settled. The first two the concierge fixes in a second; the third they fix by standing still.
 */
export function anchorAvailability(state: {
  open: boolean;
  paused: boolean;
  tracking?: string;
}): { canAnchor: boolean; why?: string; fix?: string } {
  if (!state.open) return { canAnchor: false, why: "no zone open", fix: "Enter the zone first" };
  if (state.paused) return { canAnchor: false, why: "paused", fix: "Resume to take a position" };
  if (state.tracking && state.tracking !== "normal") {
    return { canAnchor: false, why: `tracking ${state.tracking}`, fix: "Hold still and look at something with detail" };
  }
  return { canAnchor: true };
}

/**
 * Does this container have a real position, and does it need one?
 *
 * ⚑ **At least one frame per container carries a measured position; everything else inherits it.**
 * So the question is never *is this frame positioned* — it is *does this container have an anchor
 * yet*. A container with one anchored frame and nine unanchored ones is complete; a container with
 * ten unanchored frames is a container the desk cannot place, and it looks identical in a filmstrip.
 */
export function containerAnchorState(frames: { position?: ZonePosition }[]): {
  anchored: boolean;
  anchorIndex: number | null;
  inheriting: number;
} {
  const index = frames.findIndex((f) => f.position?.positioned === true);
  return {
    anchored: index >= 0,
    anchorIndex: index >= 0 ? index : null,
    // Everything else in the container, which is what inherits. Counted so a filmstrip can say
    // "1 positioned, 9 inheriting" rather than leaving the reader to work out which is which.
    inheriting: index >= 0 ? frames.length - 1 : frames.length,
  };
}

/**
 * ⚑ **What the app recommends the mesh on, and why it is a recommendation rather than a rule.**
 *
 * The owner's line is *mesh only where the room earns it — mechanical, laundry*. The thing that
 * earns it is not the room's name but what will be asked of it later: clearance in front of
 * equipment, run lengths, whether a replacement fits through the door. So the signal is **how many
 * object containers the zone has**, which the app knows by the time the floorplan is done, plus the
 * zone kind as a prior.
 *
 * **The concierge decides.** They have seen the room; the app has seen a count. A recommendation the
 * concierge can decline is a suggestion; one they cannot is the app classifying the room, which is
 * the thing the whole service moves to the desk.
 */
export function meshRecommendation(zone: { kind?: string; containers: number }): {
  recommend: boolean;
  because: string;
} {
  const kind = (zone.kind ?? "").toLowerCase();
  const equipmentRoom = ["mechanical", "utility", "laundry", "boiler", "furnace"].some((k) =>
    kind.includes(k),
  );
  if (equipmentRoom) return { recommend: true, because: "equipment room — distances get asked about these" };
  // Density, not identity: a garage with eight containers earns it and a bedroom with one does not,
  // whatever either is called.
  if (zone.containers >= 4) return { recommend: true, because: `${zone.containers} objects in one zone` };
  return { recommend: false, because: "few objects, and nothing here is measured later" };
}
