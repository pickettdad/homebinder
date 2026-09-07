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
  /** ⚑ **May positions be taken** — the concierge's Pause, NOT whether ARKit is awake (it is asleep
   *  almost always, by design). It rides the open answer because re-entering a zone *reuses* the
   *  session rather than rebuilding it: a screen that assumed `true` here painted an armed strip
   *  over a session refusing every position, and the wall in this file's header took the room. */
  armed: boolean;
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
      /**
       * ⚑ **Where the lens was POINTING, measured.** The pose is where the concierge stood; this is
       * the surface in front of them, and the desk needs both to tell them apart.
       *
       * ⛑ **`source` is not decoration, and this comment used to be a lie.** It said *the mesh had
       * no answer*; the mesh was never asked. Until 2026-09-06 every surface came from
       * `allowing: .estimatedPlane` — a plane ARKit **invents** from the feature points around the
       * ray at that instant. Two photographs of one table lamp, two minutes apart in one unbroken
       * session, moved their surface **0.905 m while the camera moved 0.771 m**: the point tracked
       * the observer instead of staying on the object, and `distance` — the number the desk ranks
       * on, closest wins — moved with it.
       *
       * **A guess is now refused rather than reported**, so this field is absent more often and
       * every one that arrives was measured. Absent still reads *unknown*, never *nothing there*.
       */
      surface?: {
        x: number;
        y: number;
        z: number;
        distance: number;
        /** Which instrument answered: LiDAR depth on the optical axis (of the still's own frame, or
         *  of the live frame one instant later), or a ray/triangle hit on the reconstructed mesh. */
        source: "sceneDepth" | "sceneDepth.stream" | "mesh";
        /** Depth rungs: ARKit's own word for the samples — `high` | `medium` | `unrated`. */
        confidence?: string;
        /** Depth rungs: p90 − p10 across the sampled patch. Centimetres means one surface filled
         *  the window; a metre means the aimed point straddled an edge and this frame is worth
         *  less. The answer already commits to the near side. */
        spreadM?: number;
        /** Depth rungs: how many pixels answered. */
        samples?: number;
        /** Mesh rung: the block that stopped the ray, the same id as `mesh.pieces[].id`. */
        anchor?: string;
        /** Mesh rung: ARKit's `ARMeshClassification` word for the face — *the surface hit, never
         *  the subject of the photograph.* `wall` on a water-heater shot is the ray landing behind
         *  the thing. Absent means unclassified, which is every face under `.mesh`. */
        kind?: string;
      };
      /**
       * ⚑ **How much of the room ARKit believes it knows** — `notAvailable` | `limited` |
       * `extending` | `mapped`, straight from `ARFrame.worldMappingStatus`.
       *
       * ⛑ **Read this, not `tracking`.** `tracking` can only ever say `normal` on a positioned
       * pose, because the native side refuses anything else — 109 of 109 across the 2026-08-30
       * export. *A field with one possible value carries no information*, and this is the one that
       * does: `limited` forty minutes into a zone is a pose worth less than an early one.
       */
      mapping?: string;
      /**
       * ⚑ **How many times tracking has been re-established since this zone opened.**
       *
       * The mechanical room's poses walked **3 m below its own floor** over 42 minutes, in discrete
       * 0.4–0.7 m steps. Across that walk ARKit reported `initializing` 109 times and
       * `relocalizing` **zero** — so each wake re-derives the device pose rather than matching the
       * map it already had, and the error between one pose and the next has no correspondence.
       * *This count is what lets a desk say a late pose and an early one are not the same
       * measurement.*
       */
      reinits?: number;
      /** Seconds since that re-establishment — the other half of *how old is this pose's frame*. */
      sinceInitSec?: number;
      /**
       * ⛑ **Which world origin this pose was measured from, and it is not the same question as
       * `reinits`.**
       *
       * ⚑ *Owner, 2026-09-05:* **"floorplan positioning is needed to line up with captures, because
       * the desk uses both to place object containers in the room."** They do line up — re-entering
       * positioning after RoomPlan re-establishes *tracking* and keeps the *frame*, so a re-init
       * costs a second and changes nothing about where the origin is.
       *
       * **A reset does change it**, and it fires when a session genuinely dies. *The failure is
       * silent in the worst possible way:* the poses still look like poses, still in metres, and are
       * measured from somewhere else entirely.
       *
       * So: **equal epochs are comparable; different epochs must not be combined.** The floorplan
       * and the mesh carry the same field, which is what makes the check possible at the desk rather
       * than a matter of trust. An honest orphan beats false continuity — the standing rule.
       */
      originEpoch?: number;
      /** ⛑ The origin's NAME. `originEpoch` is a per-process counter, so the first origin of every
       *  launch is 1 — two runs in one zone both report 1 for different frames. **Equal ids mean one
       *  frame; nothing else does.** See the fuller note in `events.ts`. */
      originId?: string;
      /** ⛑ The origin's NAME.  is a per-process counter, so the first origin of every
       *  launch is 1 — two runs in one zone both report 1 for different frames. **Equal ids mean one
       *  frame; nothing else does.** See the fuller note in `events.ts`. */
      originId?: string;

      /** ⚑ Reported, not acted on. A pose taken against very few tracked points is a pose taken in
       *  a room with nothing to hold on to — which is the mechanical room's own description. */
      featurePoints?: number;
      /**
       * ⚑ **The camera model, row-major 3×3 `[fx, 0, cx, 0, fy, cy, 0, 0, 1]`, in pixels of
       * `imageWidth` × `imageHeight`.**
       *
       * The pose gives extrinsics — where the camera was. This gives what it saw with, and
       * **placing a marker on a photograph needs both.** ⛑ Without it the desk carries a
       * hand-maintained device-to-sensor table keyed on the EXIF model string, *which goes stale on
       * every new iPad and produces plausibly-wrong placements rather than errors.*
       *
       * ⚑ **Read it with `projection`.** A pose whose `projectable` is false has intrinsics that
       * describe ARKit's camera and **not the photograph they are stamped on.**
       */
      intrinsics?: number[];
      /** The frame the intrinsics are measured in. Focal length in pixels is meaningless without it. */
      imageWidth?: number;
      imageHeight?: number;
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
 * ⚑ **What this zone is missing that only the concierge, standing in it, can still fix.**
 *
 * ⛑ **The full bath left the house with four objects, 34 photographs, six plate reads and nothing
 * to place any of it on — and nobody knew until the desk opened the file two days later.** Its
 * floorplan was lost to a sensor failure mid-stop; the room looked finished from inside the app.
 *
 * *A gap discovered at the desk costs a second visit. The same gap named in the room costs a
 * minute.* So this is asked of a zone the concierge is looking at, not of an export.
 *
 * ⚑ **It reports and never blocks.** A garage that genuinely needs no floorplan is a legitimate
 * zone, and a concierge who has decided that must be able to walk away. The line says what is
 * missing; the judgement stays theirs.
 *
 * ⛑ **And it is a verdict before it is prose** — `complete` is the ordinary case and says nothing.
 * A warning that fires on every zone is a warning nobody reads by the third room.
 */
export function zoneGaps(zone: {
  photos: number;
  hasFloorplan: boolean;
  containers: { number: number; frames: { position?: ZonePosition }[] }[];
  /**
   ⛑ **Whether this zone's accumulated geometry has been filed — and it is not the same question as
   "did the concierge use mesh mode".**

   ⚑ *Since positioning runs `sceneReconstruction` continuously, the iPad builds geometry from the
   moment the zone opens, in every mode.* `harvestMesh` reads **all** of it, and it runs at exactly
   one moment: leaving mesh mode via Finish. **So Finish is not a "start scanning" button — it is
   the only "keep it" button**, and a zone left without pressing it discards everything the walk
   built, silently and for free.

   *This is the absence-versus-refusal distinction again*: a room with no geometry because nobody
   meshed and a room with no geometry because the concierge forgot are the same file.
   */
  meshFiled?: boolean;
}): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  // Only a zone somebody actually photographed can be missing anything. An untouched zone is not
  // incomplete, it is unstarted, and saying otherwise would fire on every room before it is walked.
  if (zone.photos === 0) return { complete: true, missing };
  if (!zone.hasFloorplan) missing.push("no floorplan — scan the room");
  /* ⚑ Gated on the zone having been worked in at all (`photos > 0`, above), so it never fires on a
     room somebody walked through. The instruction is the whole point: the fix is one tap and it is
     unavailable once the concierge has left. */
  if (zone.meshFiled === false) {
    missing.push("the room's 3D scan has not been kept — tap Mesh, then Finish mesh");
  }
  /* ⛑ **Named, not counted, and the field asked for exactly this.** *"It says 3 objects the desk
     cannot place, but then doesn't really say what they are or what to do."* ⚑ A number is a
     verdict; a list is an instruction. **The concierge is standing in the room and can fix an
     object they can identify** — and cannot fix a count. */
  const unplaceable = zone.containers.filter((c) => !containerAnchorState(c.frames).anchored);
  if (unplaceable.length > 0) {
    const names = unplaceable.map((c) => `#${c.number}`).join(", ");
    missing.push(
      `object${unplaceable.length === 1 ? "" : "s"} ${names} — take one more photo of each, standing still`,
    );
  }
  return { complete: missing.length === 0, missing };
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
 * ⚑ **May the room shot step out for its wide frame right now — and what does it cost?**
 *
 * The room shot needs a **107°** frame; ARKit's device is pinned to **64.7°** and, while world
 * tracking runs, to a zoom range of exactly `[1.0, 1.0]` — measured, `ZOOM-FLOOR-RESULT-2026-09-06`.
 * **So the frame costs a camera handover**, and this decides whether to take one.
 *
 * ⛑ **The first design of this gate refused at the zone onset it was built for**, and the reason is
 * worth keeping: it read a tracking state that `openZone` never sets, because opening a zone
 * deliberately does not start ARKit. *A gate whose default is "refuse" fires hardest on the case it
 * exists to serve.* **So this refuses only on facts that are positively known**, and is silent on
 * absence.
 *
 * ⚑ **And it refuses rarely, because the handover is measured as safe** — `HSArProbe`: the map came
 * back byte-identical, the origin moved 0.00003 m, no relocalisation. *What it costs is time, not
 * the room.* The owner's ruling is the shape this encodes: *"since room shot only happens once or
 * twice per room at the onset, we can accept a wait if needed… block its use mid zone if it could
 * throw things off."* **Blocking is for what cannot work; the wait is disclosed, not prevented.**
 */
export function roomShotAvailability(state: {
  /** Positively known to be running, from the native return. Absent means nobody has said. */
  traversing?: boolean;
  /** Positively known absent on this device. Absent means nobody has asked yet. */
  hasUltraWide?: boolean;
  /** The zone session's last reported failure, if any. */
  zoneFailure?: string | null;
  /** An object container the concierge has open. */
  containerOpen?: boolean;
  /** Handovers already spent in this zone — for disclosure, never for refusal. */
  handoversThisZone?: number;
}): { canStepOut: boolean; why?: string; fix?: string; note?: string } {
  /* ⛑ Each of these is a fact that makes the step-out IMPOSSIBLE, not merely unwise — and each is
     `=== true/false` rather than truthy, so an unanswered question never refuses. */
  if (state.traversing === true) {
    return { canStepOut: false, why: "a trace is running", fix: "Stop the trace, then take the room shot" };
  }
  if (state.hasUltraWide === false) {
    return { canStepOut: false, why: "this iPad has no ultra-wide lens", fix: "The 1× room shot is still positioned" };
  }
  if (state.zoneFailure) {
    return { canStepOut: false, why: state.zoneFailure, fix: "Restart positioning first — a step-out cannot recover it" };
  }
  /* ⚑ A room shot is a shot of the ROOM. Filing one into an open object would say the room belongs
     to the object — and the fix is one tap, which is what makes this worth refusing rather than
     silently re-targeting. */
  if (state.containerOpen === true) {
    return { canStepOut: false, why: "an object is open", fix: "Close the object first — a room shot belongs to the room" };
  }
  /* ⛑ Disclosed, not refused, and the distinction is the owner's ruling. The handover is safe; it
     costs a few seconds of re-establishing tracking on the way back. Saying so on the second and
     later shots lets a concierge decide; refusing would take that from them. */
  const spent = state.handoversThisZone ?? 0;
  return spent > 0
    ? { canStepOut: true, note: `stepping out again — positioning re-establishes each time (${spent} so far)` }
    : { canStepOut: true };
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
  /* ⛑ **The fitted-room recommendation is withdrawn** (owner ruling 2026-08-23). Kitchens, baths and
     pantries do not earn a mesh by being what they are.

     ⚑ **The peninsula finding is the reason for the withdrawal rather than a casualty of it.**
     RoomPlan misses the half wall; the remedy is not to mesh a whole kitchen for two minutes, it is
     to **mesh the peninsula for twenty seconds** — one feature, not one room.

     And the trigger for that needs no rule at all: **the plan is drawn to scale with lengths the
     moment a floorplan finishes**, so the concierge compares the drawing to the room and meshes what
     is in one and not the other. *A room-type list would be the app guessing at what a room contains;
     the drawing is the concierge seeing what it does not.* */
  // Density, not identity: a garage with eight containers earns it and a bedroom with one does not,
  // whatever either is called.
  if (zone.containers >= 4) return { recommend: true, because: `${zone.containers} objects in one zone` };
  return { recommend: false, because: "few objects, and nothing here is measured later" };
}

/**
 * The quoting table, derived from the plan.
 *
 * ⚑ **One walk producing numbers somebody can price from is the point of the whole capture** (owner
 * ruling 2026-08-21). RoomPlan hands back walls, doors, windows and openings with dimensions; every
 * measure below falls out of those, and none of them needs anybody to decide in the room what was
 * worth measuring.
 *
 * ⛑ **Baseboard is the one that earns its keep and the one most easily got wrong.** It is the
 * perimeter *minus the door openings* — a run of trim does not cross a doorway — so a perimeter
 * quoted as baseboard over-counts by roughly a door width per door, which on a house is a real
 * number in the wrong direction.
 *
 * ⚑ **And what the plan CANNOT give, said here rather than discovered when somebody asks:**
 * **flooring type** and **registers** are not in RoomPlan's output at all. Its object taxonomy knows
 * sofas and refrigerators; there is no floor-covering classification and no vent. Those have to come
 * from a concierge capture or from the mesh, and this function returns them as `null` rather than
 * omitting them — an absent key reads as *nobody computed it*, and `null` reads as *the plan does
 * not carry this*.
 */
export interface ZoneMeasures {
  /** Square metres, from the floor polygon the walls describe. */
  floorArea: number | null;
  ceilingHeight: number | null;
  /** Linear metres round the room. */
  perimeter: number | null;
  /** ⚑ Perimeter minus door openings — trim does not cross a doorway. */
  baseboard: number | null;
  /** Gross wall area, before openings are taken out. */
  wallAreaGross: number | null;
  /** …and after, which is the one a painter or a drywaller prices from. */
  wallAreaNet: number | null;
  windows: { count: number; totalGlazing: number; sizes: { width: number; height: number }[] };
  doors: { count: number; sizes: { width: number; height: number }[] };
  openings: { count: number };
  /** ⛑ Not in the plan. Null rather than absent — see the note above. */
  flooringType: null;
  registers: null;
}

export function zoneMeasures(plan: ZonePlan): ZoneMeasures {
  const walls = plan.walls ?? [];
  const windows = plan.windows ?? [];
  const doors = plan.doors ?? [];
  const openings = plan.openings ?? [];
  const sizes = (list: ZoneSurface[]) => list.map((s) => ({ width: s.width, height: s.height }));
  const area = (list: ZoneSurface[]) => list.reduce((sum, s) => sum + s.width * s.height, 0);

  // A wall's `width` is its run along the floor, so the perimeter is their sum. Not a convex-hull
  // job: RoomPlan already gives one surface per wall segment.
  const perimeter = walls.length ? walls.reduce((sum, w) => sum + w.width, 0) : null;
  // Tallest wall rather than mean: a sloped or stepped ceiling has more than one height, and the
  // useful single number for clearance is the greatest.
  const ceilingHeight = walls.length ? Math.max(...walls.map((w) => w.height)) : null;
  const wallAreaGross = walls.length ? area(walls) : null;
  const cutouts = area(windows) + area(doors) + area(openings);
  const doorWidths = doors.reduce((sum, d) => sum + d.width, 0);

  return {
    /* ⚑ Floor area is NOT perimeter × something. RoomPlan gives no floor polygon directly, so this
       is left null rather than approximated — a rectangle assumption is wrong in every L-shaped
       room, and a wrong area quoted to a flooring supplier is worse than no area. The mesh can
       answer it properly, which is the honest home for it. */
    floorArea: null,
    ceilingHeight,
    perimeter,
    baseboard: perimeter === null ? null : Math.max(0, perimeter - doorWidths),
    wallAreaGross,
    wallAreaNet: wallAreaGross === null ? null : Math.max(0, wallAreaGross - cutouts),
    windows: { count: windows.length, totalGlazing: area(windows), sizes: sizes(windows) },
    doors: { count: doors.length, sizes: sizes(doors) },
    openings: { count: openings.length },
    flooringType: null,
    registers: null,
  };
}
