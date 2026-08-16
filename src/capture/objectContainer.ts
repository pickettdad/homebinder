/**
 * The object container (Baseline Service Design v1.8 §4.1a-ii).
 *
 * *Tap +, a container opens and you are in it. Everything captured next is tagged to that
 * object: the unit, its text, other angles, its concerns.*
 *
 * WHY THIS IS A MODULE AND NOT A `useState` IN THE VIEWFINDER, and it is the same reason
 * `globalCameraApplies` and `offersVerdict` are predicates: **doctrine that arrives as a branch
 * inside a component cannot be scanned or tested**, and every rule below is doctrine. The one
 * that matters most — *a run trace is not a member of the container it starts in* — is a single
 * `if` whose absence would be invisible and whose presence nothing downstream can check.
 *
 * NO SCHEMA CHANGE, ruled in v1.8 §4.2: **a container is an untyped, unanchored pin.** That is
 * already the shape — `PinCreated` carries a `zoneId` and nothing else, `PinTyped` is a separate
 * event that simply never happens, and captures file to `{kind: "pin"}` exactly as pin evidence
 * always has. Nothing here invents a record; it decides which existing one a capture goes to.
 *
 * ⚑ **A container declares *this is a thing and I am now photographing it*, never what the thing
 * is.** It is triage scaffolding — the desk splits, merges and reassigns. So there is no naming
 * step, no type, no count of what a room "should" contain: **there is nothing to count against,
 * because nothing here knows how many objects a room holds.** The furnace folder gets a furnace
 * icon without anybody typing "furnace", because its first photograph is of the furnace.
 *
 * ⚑ **Ungrouped capture stays free.** A concierge who walks in and simply shoots still produces
 * a complete, valid visit — `null` is a first-class state throughout this file, never an error
 * to recover from and never a prompt.
 */
import type { CaptureIntent, CaptureTarget } from "../engine/v2/events";
import type { MediaRef, PinStateV2 } from "../engine/v2/fold";

/**
 * The open container. Carries its zone because **a container spanning two zones is always
 * wrong** — the zone is not context to be looked up later, it is part of what is open.
 */
export interface OpenContainer {
  pinId: string;
  zoneId: string;
}

/** One object as the strip draws it. `iconMediaId` is the establishing shot; absent until one. */
export interface ContainerSummary {
  pinId: string;
  number: number;
  iconMediaId?: string;
  /** Carried beside the id because a thumbnail cannot be drawn without knowing what it is. */
  iconMime?: string;
  captureCount: number;
}

/**
 * Is this pin an object container?
 *
 * Untyped and unanchored — which is not a marker we set, it is the *absence* of the two events
 * that would make it something else. A container the desk later types, or that gets anchored to
 * a canvas, stops being a container and becomes an ordinary pin, and that is correct: it has
 * been identified, so the scaffolding has done its job and is no longer scaffolding.
 *
 * Retired pins are out. A retired container is a mistake somebody undid, and offering it back
 * in the strip is offering to file into a thing that was deliberately thrown away.
 */
export function isObjectContainer(pin: PinStateV2, zoneId: string): boolean {
  return pin.zoneId === zoneId && !pin.pinType && pin.anchors.length === 0 && !pin.retired;
}

/**
 * The zone's containers, in the order they were made.
 *
 * By `number`, which `appendEvents` stamps inside the transaction — so the order is the order
 * they were created and not the order they happen to sit in the folded array. Same reasoning as
 * `groupIntoRuns` sorting rather than trusting array order.
 */
export function containersInZone(pins: readonly PinStateV2[], zoneId: string): ContainerSummary[] {
  return pins
    .filter((p) => isObjectContainer(p, zoneId))
    .sort((a, b) => a.number - b.number)
    .map((p) => ({
      pinId: p.pinId,
      number: p.number,
      // ⚑ The FIRST capture, not the latest. The establishing shot is the folder's identity;
      // an icon that changed to the most recent close-up of a rating plate would leave a strip
      // of unrecognisable crops, which is the one thing the icon exists not to be.
      iconMediaId: p.photos[0]?.mediaId,
      iconMime: p.photos[0]?.mime,
      captureCount: p.photos.length,
    }));
}

/**
 * Tapping an object in the strip.
 *
 * ⛑ **Tapping the one you are already in leaves it** — the exit v1.7 had no room for. Same
 * gesture as entering, so it costs no new control and nothing new to learn: the icon you tapped
 * to get in is the icon you tap to get out.
 */
export function tapContainer(open: OpenContainer | null, pinId: string, zoneId: string): OpenContainer | null {
  if (open?.pinId === pinId) return null;
  return { pinId, zoneId };
}

/**
 * The zone changed under an open container.
 *
 * **Leaving the zone closes it automatically.** Not a warning and not a prompt: a container
 * spanning two zones is always wrong, so there is no decision to put to anybody.
 */
export function containerAfterZoneChange(open: OpenContainer | null, zoneId: string | null): OpenContainer | null {
  if (!open) return null;
  return open.zoneId === zoneId ? open : null;
}

/**
 * Where a capture files.
 *
 * ⚑ **A run trace is the exception, and it is the whole reason this is a function rather than a
 * ternary at the call site.** A trace *starts* inside a container and *ends* outside it — file
 * it inside and you have asserted the pipe belongs to the furnace, which is a claim nobody made
 * and which the desk would then have to disprove. So it files to the zone, exactly as it does
 * when no container is open, and the container it started in stays open behind it.
 *
 * ⚑ **What is NOT recorded here: that the trace started at this container.** v1.8 says the
 * starting container is recorded as an endpoint, and there is nowhere in the event log for that
 * to land — `PhotoAdded` carries one `target` and one `intent`, and an endpoint is neither. It
 * is a manifest question, which makes it a cross-repo contract and not this session's to settle
 * (Mac Session Brief §5). Recorded here as a stated gap rather than approximated, because an
 * approximation would be indistinguishable from the real thing at the desk. Same stance as the
 * OCR read that has nowhere to land (#163).
 */
export function captureTargetFor(
  open: OpenContainer | null,
  zoneId: string,
  intent?: CaptureIntent,
): CaptureTarget {
  if (!open || intent === "run-trace") return { kind: "zone", id: zoneId };
  return { kind: "pin", id: open.pinId };
}

/**
 * Is the next capture into this container its establishing shot?
 *
 * True exactly when the container is empty, because the establishing shot is *the first shot* —
 * there is no separate act and no button. **It is free: it is the shot taken first anyway.** It
 * becomes the folder's icon, and the frame that rides that object's identification call as
 * context.
 */
export function isEstablishingShot(pin: Pick<PinStateV2, "photos"> | undefined): boolean {
  return !!pin && pin.photos.length === 0;
}

/** What the strip draws. Exactly one of `objects` / `captures` is populated — see below. */
export interface StripModel {
  /**
   * The open container, drawn at the top of the strip under the `+`.
   *
   * Present so that **the exit gesture has something to land on while you are inside**: in a
   * container the strip shows that container's captures, so without this row there would be no
   * icon to tap to leave, and the "same gesture, no new control" rule would need a new control.
   */
  current: ContainerSummary | null;
  /** Out of a container: the zone's objects, stacked, each wearing its first photograph. */
  objects: ContainerSummary[];
  /** In a container: that container's captures, oldest first. */
  captures: MediaRef[];
}

export function stripModel(
  pins: readonly PinStateV2[],
  zoneId: string,
  open: OpenContainer | null,
): StripModel {
  const objects = containersInZone(pins, zoneId);
  if (!open) return { current: null, objects, captures: [] };
  const current = objects.find((o) => o.pinId === open.pinId) ?? null;
  const pin = pins.find((p) => p.pinId === open.pinId);
  return { current, objects: [], captures: pin ? [...pin.photos] : [] };
}
