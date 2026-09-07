# Zoom floor — can ARKit's own camera widen? **No.**

**Measured on device, iPad Pro 11-inch (3rd gen), 2026-09-06, tethered.** `--hs-zoom-floor`,
`HSZoomFloor.swift`. Raw result: `Documents/hs-zoom-floor.json` on the device.

---

## ⚑ VERDICT — `NO — floor is 1.0; a handover is required for a wide frame`

**ARKit configures the plain `.builtInWideAngleCamera`.** Not a virtual device, no constituents, no
switch-over zoom factors. **There is no ultra-wide behind it to reach.**

| | at rest | **while ARKit runs** |
|---|---|---|
| device type | `builtInWideAngleCamera` | `builtInWideAngleCamera` |
| constituents | *(not a virtual device)* | *(not a virtual device)* |
| **min zoom** | **1.0** | **1.0** |
| max zoom | 16.0 | ⚠️ **1.0** |
| field of view | 64.7° | 62.3° |

⛑ **And the row that says more than the verdict: `maxZoom` collapses from 16.0 to 1.0 the moment
ARKit claims the device.** While world tracking runs, the zoom range is pinned to exactly `[1.0,
1.0]` — **not even digital zoom is available.** *There was no narrow escape to miss; the door is
welded shut, not merely closed.*

## What the hardware does have, and cannot be reached

```
builtInWideAngleCamera   min=1.0  fov=64.7°     ← what ARKit takes
builtInUltraWideCamera   min=1.0  fov=107.3°    ← what the room shot needs
builtInDualWideCamera    min=1.0  fov=111.6°
```

⚑ **64.7° against 107.3° is what the handover buys** — and it is why no crop or digital trick
substitutes. *The pixels outside a 64° frame do not exist to be recovered.*

---

## ⛑ Why a clean negative was worth two minutes

**It retires an option rather than leaving it to be re-argued.** Every design for the room shot's
wide frame pays a camera handover, and the only question that could have removed that cost was
whether ARKit's device widens by itself. **Nobody had ever read the number** — the device *type* was
measured twice (`HSArProbe`, `HSLensProbe`); the zoom floor never once.

⚑ **It also priced the thing it did not remove.** The handover is now known to be *necessary*, not
merely *chosen*, and the FOV numbers say exactly what it delivers.

## What this does not settle

**The handover's cost under a genuinely-mapped continuous session is still unmeasured.** The
86–607 ms in Baseline Service Design v1.12 comes from `HSArProbe`, against a **pre-built ultra-wide
session that does not exist on the shipping path** — `configureSession` creates exactly one input and
guards on `session.inputs.isEmpty`, so every ultra-wide input is allocated lazily inside `swapLens`,
the operation the same probe timed at **7 ms at launch and 9,006 ms while ARKit holds the camera.**

⛑ **So the pre-build is a prerequisite, not an optimisation** — the spec says so and the measurement
agrees. It is the first thing the handover build must add.
