/**
 * ⛑ **Two rooms with the same name must not produce two files with the same name.**
 *
 * Found in pre-flight for a deliberately two-bedroom walk. The zip filename was built from the zone
 * LABEL, the living-space type's default label is literally `bedroom`, and the zone sheet prefills
 * it — so both rooms produced `housesteady-<id>-bedroom.zip`.
 *
 * ⚑ **The export screen treats that name as a key.** It resolves `plan.files.find(f => f.name ===
 * name)` and stores save-status by name, so saving either row zipped the *first* zone twice, flipped
 * both rows to shared, and Finish recorded a verified export. **Zone B's photographs, floorplan and
 * mesh never left the iPad while the manifest listed every one of them with a sha256** — a
 * complete-looking record over an archive missing a whole room, invisible to the integrity sweep,
 * which checks the device's store rather than the zip.
 *
 * The invariant is **not** the naming scheme, which may change. It is that **two zones never share a
 * tag**, which holds at two zones and at twenty.
 */
import { describe, expect, it } from "vitest";
import { exportGroupTag } from "../../src/export/exportSessionV3";
import type { SessionStateV2 } from "../../src/engine/v2/fold";

const stateWith = (zones: { zoneId: string; label: string }[]) =>
  ({ zones: zones.map((z) => ({ ...z, type: "living-space" })) }) as unknown as SessionStateV2;

const A = "01a07482-ae8e-780e-8b0e-d40f7764262a";
const B = "01a0748f-25a8-72b5-af6f-e5b88aa69326";

describe("export filenames", () => {
  it("gives two identically-named rooms two distinct tags", () => {
    // ⚑ THE invariant — and the case the app itself creates, since it prefills "bedroom".
    const state = stateWith([
      { zoneId: A, label: "bedroom" },
      { zoneId: B, label: "bedroom" },
    ]);
    expect(exportGroupTag(state, A)).not.toBe(exportGroupTag(state, B));
  });

  it("keeps the label, because a human picks these out of a file list", () => {
    // ⛑ Distinctness alone is not enough: an opaque id would be unique and unusable.
    const state = stateWith([{ zoneId: A, label: "Mechanical Room" }]);
    expect(exportGroupTag(state, A)).toContain("mechanical-room");
  });

  it("leaves the one group that cannot collide alone", () => {
    // There is only ever one `_misc`, so a suffix would be noise in every filename.
    // Slugged to "misc" by groupSlug, and un-suffixed — that is the pre-existing behaviour, asserted
    // so the collision fix is visibly scoped to zones.
    expect(exportGroupTag(stateWith([]), "_misc")).toBe("misc");
  });
});
