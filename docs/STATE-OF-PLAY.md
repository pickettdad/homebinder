# State of play — Field Mac session

**Rewritten wholesale, 2026-09-06.** *Replaced, never appended to. Its consumer is the next session,
which may be a fresh one after a usage cut-off.*

---

## ⚑ Where the build actually is

**The continuous ARKit zone session works end to end on device.** ARKit holds the rear camera for the
life of a room; photographs come back through `captureStill` at **4032×3024 in 60–90 ms** with a pose
measured from the frame that became the photograph.

The last tethered walk (2026-09-06) was the **first fully clean one**:

| | |
|---|---|
| floorplan delivery | **0.68 s** (`roomPlanStopping` → `roomDelivered`) |
| `sessionFailed` | **0** |
| `reinits` | **2** — one to open, one for RoomPlan |
| `originEpoch` | **1** all walk — one coordinate frame |
| mesh | **24 anchors** |
| stills through ARKit | **6**, three reporting `mapping: "mapped"` |
| black screens | none |

**Positioning error is measured and settled — do not propose measuring it again.**
`docs/GATE1-RESULT-2026-09-04.md`: **6.0 cm max over 45 min against a 10 cm go/no-go**, plateauing
near 5 cm and wandering. ⛑ *Bounded error, not drift.*

---

## ⛑ The defect that was open, and the fix that shipped 2026-09-06

**The capture raycast does not hit the object.** Both sites use `allowing: .estimatedPlane`
(`HSZoneSession.swift:745` in `captureStill`, `:1015` in `position()`), which asks ARKit to *invent* a
plane. A water heater is not a detected plane, so the ray returns a guess.

⚑ **Proven from the field, not argued.** Two photographs of one object, same session, same
`originEpoch`, 2 minutes apart (2026-09-06 export, Bedroom 4):

```
camera moved   dx=+0.352  dy=-0.658  dz=+0.195   0.771 m
surface moved  dx=+0.537  dy=-0.683  dz=+0.253   0.905 m
per-axis ratio surface/camera:  x 1.53   y 1.04   z 1.30
```

**All near 1, none near 0.** A ray hitting the same physical object would barely move — the ratio
would be ~0. **The surface tracks the observer**, and the standoff barely changed (0.867 → 0.936 m).

**⚑ The subject was a table lamp** (owner, 2026-09-06), and that sharpens the diagnosis rather than
confirming the first reading of it. Checking the rest of the export: `surface.distance` across the
current build runs **0.333 m to 2.982 m, stdev 0.701** — *not* a constant. **So the ray is hitting
something real. It is hitting the wrong something.**

⛑ **A lamp is ~0.15 m across and thin. `.estimatedPlane` finds the big background plane — the wall or
the table behind it — never the small object in front.** Two standing positions give two points on
that background, which is exactly the 1:1 tracking. *And it generalises to everything this app
photographs: a valve, a nameplate, a shutoff, a lamp. **Planes miss precisely the objects that matter.***

*The session's own doctrine already said the answer:* **"A plane is a guess at a surface; the mesh IS
the surface."** The raycast never used the mesh.

⚑ **The lamp raises `sceneDepth` above the mesh as the likely winner.** LiDAR measures the nearest
thing at the centre pixel; mesh reconstruction is poor on thin geometry and may not contain the lamp
at all. **Nearest-surface-along-the-ray is the requirement, not any-surface.**

**Fixed 2026-09-06 — `HSSurface`, one function both capture doors ask.** `sceneDepth` on the
optical axis first (the LiDAR measures the nearest thing at that pixel whether or not reconstruction
kept it), a ray/triangle intersection against `ARMeshAnchor` geometry where depth cannot see, and a
**refusal** otherwise. No plane, no estimate, no `ARRaycastQuery` left in the session. Every exported
`surface` carries `source`; the zone log carries `surfaceMs` and the reason each rung refused, in
place of the bare `surface: true/false` that let a 96% rate of inventing planes read as validation.

⚑ **The acceptance test is the owner's own pair, and it is now runnable:** two photographs of one
object from two standing positions, ratio of surface movement to camera movement. **Near 0 and this
worked. Near 1 and it did not.** ⛑ *There is a third outcome and it must not be read as success:*
ratio near 0 but `distance` systematically longer than the standoff — that is the ray finding the
wall behind a thin object, which is the case `sceneDepth` exists in this ladder to avoid and the
case the mesh rung alone cannot. Unproven on hardware: it needs a tethered Debug run and then a
TestFlight archive, per the build order.

---

## What is fixed and on the device

- **ARKit frames are copied, never retained** — holding one past the delegate starved the frame pool
  and froze the viewfinder while the shutter kept working
- **`start()` consults zone ownership** inside the queue block; **`openZone` closes the outgoing zone**
  rather than stranding `zoneOwnsCamera` true for the rest of the walk
- **`enter()` shows the preview** — it is the one function that always takes the lens, and
  `showArPreview` had lived in five callers with `wake()` as caller six
- **`pause()` hides the AR preview** before releasing the lens
- **RoomPlan is held until it delivers** — `stop()` is async and dropping the reference made delivery
  a coin toss; **both ends of the build are logged** (`roomDidEnd` / `roomBuilding` / `roomBuilt`)
- **`supersedeRoomPlan`** — one function, three callers, so an interrupted plan is recorded not dropped
- **`originEpoch`** advances only on `.resetTracking`, stamped on plan, mesh and every pose
- **Mesh and positioning are one configuration** — `enterUnchanged` makes switching free
- **Every capture carries its own pose** (the per-container sampling rate is retired)
- **Mesh overlay follows the mode**, not the presence of anchors

## Still open

**From the 2026-09-06 audit (22 confirmed, 14 high — a design workflow is producing patches):**
`roomWaiter` cleared on a Task thread racing `enter(.mesh)` · re-entering a paused zone resets the
React flag but not the native arm · `beginTraverse` gives the lens to ARKit then needs the capture
session · torch override that can never be left · `stop()` never unlocks white balance · in-zone
stills record `torch: false` always · traverse readout prints `disparity 0.000` · `sleepSession()`
has no callers so `resumeJumpM`/`sleepSec` can never be populated.

**From the running list:** `item.scope` has no consumer · door identity across zones (blocked on
design) · property/session-plan import (desk side unbuilt).

---

## Next

**The mechanical room walk, and it is the export that unblocks Builder.** Everything above serves it.

⚑ *Before asking the field for a number, check whether a gate already bought it.* Gate 0 (4.5 cm),
Gate 1 (6.0 cm bounded, thermal nominal, 9%/46 min) and the plate A/B are **results, not history**.
