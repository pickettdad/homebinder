# The mechanical room's poses — measured, and it is none of the three theories

**2026-09-02 · controlled test, one zone, 14 minutes, tethered pull.** The instruments added on
2026-09-01 answered it on their first run.

## The measurements

| pose | y | mapping | featurePoints | resumeJumpM | sleepSec | sinceInitSec |
|---|---|---|---|---|---|---|
| 1 | +0.013 | **notAvailable** | **0** | 0.00024 | 116.4 | 1.41 |
| 2–10 | +0.012 … +0.017 | **limited** ×9 | **2 – 9** | 0.0016 – 0.0121 | 19.8 – 35.2 | ~1.4 |

**Ten poses over 5.8 minutes: 5 mm of total variation in y, 2 cm in x/z.**

## What each number kills

⛑ **`resumeJumpM` = 0.24 mm across a 116-second sleep.** *The estimate does not move while the
camera is away.* **The sleep/wake theory is dead by direct measurement**, not by argument.

⛑ **`featurePoints` = 0 to 9, in a feature-rich room, at a fixed mark.** A healthy session tracks
hundreds. ⚑ **And the first pose reports `tracking: "normal"` with ZERO tracked points** — the
clearest possible demonstration that the tautological field says nothing.

⛑ **`mapping` never leaves `limited`.** Not once in ten poses does it reach `extending` or `mapped`.
**ARKit never builds a world map at all.**

⚑ **`sinceInitSec` ≈ 1.4 s against `sleepSec` of 20–116 s. ARKit is awake for roughly 2% of the
session.** It is granted `.normal` about a second after re-initialising and put back to sleep
moments later.

## The diagnosis

**With `worldMappingStatus: limited` and a handful of feature points, there is no map — so there is
no loop closure and no global correction. Every pose is dead-reckoned from the one before it.**

⚑ **Standing still, dead reckoning is perfect: 5 mm over six minutes.** **Walking, it accumulates —
which is exactly the walk's signature**, where large vertical steps carried a mean horizontal move
of 0.651 m against 0.233 m for small ones.

⛑ **It is not the room, not the subject and not the wake. It is the duty cycle** — the session is
starved of the awake time it needs to build the map that would correct it. *All three earlier
theories, including two of mine, were about what happens during the second ARKit is awake. The
answer is how little of the session that second is.*

## The frame does move, and by how much

**Two floorplans of the same room, ten minutes apart, in one session:**

| | floor y | ceiling y | measured height |
|---|---|---|---|
| minute 4 | **−1.617** | +0.783 | **2.400 m** |
| minute 14 | **−1.457** | +1.093 | **2.550 m** |

⚑ **The floor rose 16 cm and the ceiling 31 cm in ten minutes.** ⛑ **And RoomPlan's own measurement
of the same room's height changed by 150 mm.** The room did not get taller — *this is the frame
drifting and RoomPlan re-measuring inside it*, and it is a bound on what any single floorplan
number is worth.

**16 cm in 10 minutes standing still is not 3 m in 42 minutes walking.** The controlled test
reproduced the mechanism and not the magnitude, because the magnitude needs travel.

## Two things confirmed working, one small defect

✓ **Mesh geometry ships.** Three meshes carrying **2,914 / 3,485 / 4,282 vertices** in the arrays,
matching `vertexCount` exactly, and face indices at exactly 3 × `faceCount`. 8 KB payloads became
230–360 KB.

✓ **`walkedExtent` is now the geometry**, not anchor centres — ~1 m extents on individually meshed
objects, which is the right order for what was scanned.

⛑ **The geometry files are named `.bin`.** `extensionFor` had no `application/json` branch, so five
payloads that are plain readable text shipped with an extension meaning *opaque bytes*. Fixed.

## What this does not settle

**Whether more awake time fixes it.** The lever is `sinceInitSec` — currently ~1.4 s. *That is a
one-line experiment and it should be run before anything larger is designed.* If a pose read after
4 s shows `mapping: extending` and a hundred feature points, the fix is a wait. If it does not,
the fix is decision one — ARKit holding the camera for the zone — and this is the evidence for it.
