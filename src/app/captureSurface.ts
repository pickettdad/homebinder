/**
 * Which camera surface is live — the routing rule behind "capture mode owns the camera"
 * (owner ruling 2026-08-11).
 *
 * A PREDICATE RATHER THAN A JSX CONDITION, for the reason `offersVerdict` states in
 * `engine/v2/checklist.ts`: doctrine that arrives as an early return inside a component
 * cannot be scanned or tested, and this project has lost the same rule that way before. This
 * one can be asserted directly.
 *
 * The failure it removes: capture mode renders ON the `walk` and `zone2` screen names, so the
 * floating trio and capture mode's own Photo/Video/Voice buttons were both live on one
 * screen — two photo doors and two video doors, differing only in whether they passed through
 * the confirm sheet. §4.1a adds three more declared kinds on top of that, and the doubling is
 * what breaks first.
 */
import type { VisitKind } from "../engine/v2/events";
import { modeForVisit } from "../engine/v2/checklist";

/** Screens where a capture has an unambiguous destination, so a floating shutter is safe. */
const GLOBAL_CAMERA_SCREENS = ["walk", "zone2", "pin", "inbox"];

export function globalCameraApplies(visitKind: VisitKind | null, screenName: string): boolean {
  // Capture mode brings its own doors — the three declared kinds live on them, and a second
  // set of shutters on the same screen is the thing being removed.
  if (modeForVisit(visitKind) === "capture") return false;
  return GLOBAL_CAMERA_SCREENS.includes(screenName);
}
