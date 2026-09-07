# Can the traverse keep its exposure lock under ARKit? **Yes.**

**Measured on device, iPad Pro 11-inch (3rd gen), 2026-09-06, tethered.** `--hs-exposure-lock`,
`HSExposureLock.swift`. Raw: `Documents/hs-exposure-lock.json`.

---

## ⚑ VERDICT — `YES. ARKit permits the exposure lock; a traverse could run on ARKit frames and keep its texture`

Asked for the traverse's own values — **1/60 s at ISO 400**, inside the metered band it actually uses
— against a live zone-shaped session (`sceneReconstruction`, `sceneDepth`, plane detection, tracking
`normal`).

| | asked | **reached** |
|---|---|---|
| exposure mode | `.custom` | ✅ **`.custom` (3)** |
| ISO | 400 | ✅ **399.88** |
| shutter | 0.016667 s | ✅ **0.016585 s** |
| white balance | `.locked` | ✅ **`.locked` (0)** |
| focus | `.locked` | ✅ **`.locked` (0)** |
| `lockForConfiguration` | — | ✅ **did not throw** |

⛑ **And the change is real rather than coincidental: ISO moved from 1472 on auto to 400 on the
lock.** *The device was metering a dim room at 1472 and did what it was told.*

## Why this decides something large

**Owner, 2026-09-06:** *"I am wondering if we add back in position into each frame along a trace. We
avoided that at first because of the camera handover cost but now things are very different… so a
pipe running along walls and ceilings could actually be somewhat mapped out?"*

⚑ **The cost did change, and this was the last thing that could have blocked it.** The traverse today
yields the lens (`handLens("traverse")` → `pauseZone`), so **ARKit is paused and no frame can carry a
pose.** Running the trace on ARKit's own frames instead would:

- give **every frame a pose and a `HSSurface` raycast**, for free — the session is already delivering
  them at 60 fps
- remove the lens handover entirely, and with it the **~5 s tracking re-establishment each leg pays**
- remove the black viewfinder and the *"no position"* banner a traverse currently shows

⛑ **The only thing that stood in the way was the exposure lock**, and it is not a small thing: it is
the traverse's one measured win — **median texture 6.2 → 18.1, blank-texture verdicts 22 → 0**, Vision
reading brand names at 1.00 confidence. *A trace shot on auto-exposure while walking is the near-black
legs of 2026-08-19 again.* **Losing the lock to gain the pose would not have been a trade worth
making. It is not the trade on offer.**

⚠️ **And a refusal was the reasonable expectation.** `ZOOM-FLOOR-RESULT-2026-09-06` found ARKit pins
the device's zoom range to exactly `[1.0, 1.0]` while world tracking runs — *not defaults it, pins
it.* A framework that takes zoom away might have taken exposure. **It does not.**

## What a posed trace would actually deliver

Every frame carrying `{pose, surface}` turns a run trace from a strip of pictures into **a series of
measured points along the run** — which is what Baseline Service Design §4.1b's run trace is for, and
what *"the one capture whose two ends are not in the same place"* was written about.

⚠️ **Bounded honestly, and by the same limit as everything else:** `HSSurface` reaches ~5 m
(`ZOOM-FLOOR-RESULT` and the room-shot finding). A pipe walked at a metre or two is well inside that;
a duct across a high ceiling may not be. **"Somewhat mapped out" is the right phrase — a run of
measured points where the sensor could reach, and honest absences where it could not.**

## What this does not settle

- **Cadence and resolution.** The traverse's current frames come from `AVCapturePhotoOutput`; ARKit's
  would come from `captureHighResolutionFrame` or the video stream. *Frame rate, resolution and the
  cost of a still every N frames are unmeasured on this path.*
- **The torch.** Held on the same device; supported (`hasTorch: true`) but untested under a lock.
- **Whether the flow/overlap machinery still reads the same** on ARKit-sourced frames.
