# Traverse frame quality — spec, not a build

**Raised by the owner 2026-09-07:** *"If traverse is capturing at full image quality, I expect
traverses to end up being a lion's share of the storage for a visit… it's more about positioning of
runs and what connects to what in a larger system. Doesn't need to be built in yet, but
understood/spec'd out maybe just in case."*

**He is right, and the margin is larger than the intuition.** Written up now so the posed traverse is
built with the dial in the right place, rather than retrofitted around one.

---

## ⚑ 1 · The size, measured from his own export

**The 2026-09-07 two-zone walk** — three short legs, `intent: "pan"`:

| | frames | bytes | share |
|---|---|---|---|
| **traverse frames** | 67 | **221.8 MB** | ⚠️ **71% of all media** |
| object photographs | 9 | 32.2 MB | 10% |
| everything else (geometry, voice, room shots) | — | 59.3 MB | 19% |
| **total** | | **313.3 MB** | |

**Median traverse frame: 3.35 MB. Maximum: 3.94 MB.**

⛑ **And that is the *floor*, not the ceiling.** A mechanical room with a real pipe run is 5–7 legs of
20–30 frames — **125–210 frames, 420–700 MB in traverse alone** — and the posed traverse fires on
metres walked rather than on picture-shift, which on a long straight run fires *more* often, not less.
*A whole-house visit could plausibly put 2–3 GB through a mechanism whose output the desk uses for
topology.*

## ⚑ 2 · The dial is free, and that is the important finding

**Nothing the traverse measures touches the filed JPEG.** `textureScore`, `measureOverlap`,
`flowCoverage` and the accumulator all run on a **384-wide working buffer** downscaled from the video
stream. The JPEG is written and never read again on the device.

⛑ **So image quality is a pure output setting.** Changing it cannot move a verdict, cannot change what
is kept or discarded, and cannot alter a pose. *That is unusual and worth stating plainly, because the
normal reason not to touch a quality setting is that something downstream is silently calibrated to
it.* **Nothing here is.**

**Two levers, both already present:**

| lever | where | today |
|---|---|---|
| **JPEG compression** | `AVCapturePhotoSettings` (AV path) · `kCGImageDestinationLossyCompressionQuality` (ARKit path) | `.quality` / `0.95` |
| **Pixel dimensions** | downscale before encode; the machinery exists — `downscaled(_:crop:orientation:)` | full sensor, 4032×3024 |

## ⚠️ 3 · The endpoint intuition changes under the posed traverse — and it is worth knowing why

*"The start and end points are the most critical."* **True today and false the moment every frame
carries a pose.**

⛑ Today the two anchors are the *only* frames with a position, so they carry the leg's whole
geometry. **Under the posed traverse every frame is positioned** — so the endpoints stop being special
*for position*.

⚑ **What makes a frame valuable becomes what is IN it.** A frame showing a valve, a junction, a
transition through a wall, or a label is worth resolution. **A frame of eighteen inches of copper
between two of those is worth very little**, and it is the majority of a run.

*The field cannot tell which is which* — that is the classification-during-capture the three-visit
redesign removed, and it must not come back through a quality setting.

## ⛑ 4 · The recommendation, and it is deliberately dumb

**Uniform reduction of mid-leg frames. No cleverness about content.**

- **Mid-leg frames: 1600 px on the long edge, JPEG 0.7.** ≈ **250–400 KB**, an **8–13× reduction**.
  *That 221.8 MB becomes 20–30 MB.*
- **First and last frame of each leg: unchanged.** Not because they are geometrically special any
  more, but because **they are what a concierge aims at deliberately** — the object the run starts
  from and the one it ends at — and those are the two the desk is most likely to want to look at.
- **Nothing content-aware.** ⚑ *A rule that keeps resolution "where something interesting is" requires
  the app to know what is interesting, which is the one thing this design has spent months refusing to
  do.*

**1600 px is chosen against what the desk asks of these frames**, which is *what runs where and what
connects to what* — a question answered at a glance. It is **not** enough to read a serial plate, and
that is correct: a plate is an object capture, taken deliberately, at full resolution, on a pin.

## ⚠️ 5 · What would have to be decided before building it

1. **Owner ruling: is a mid-leg frame ever the evidence for a finding?** If the desk might cite one in
   a report — *"corrosion visible at the elbow"* — 1600 px may be too little, and the answer is a
   number rather than a principle. **This is his call and it is the only real question here.**
2. **Does the desk want the original retained anywhere?** Reducing at capture is irreversible. *A
   thumbnail-plus-original scheme doubles the plumbing and saves nothing on the device, which is where
   the constraint bites.*
3. **The manifest should record it.** A frame filed at reduced quality must say so — `frame.quality`
   or equivalent — or a desk comparing two exports cannot tell a reduced frame from a poor one.
   ⛑ *Same rule as `surface.source` and `originId`: the record dates itself.*

## What this is not

**Not a build item.** Recorded so the posed traverse is written with the encode in one place and the
quality read from a constant, rather than hard-coded at the call site — **so that turning this on
later is a one-line change and not a surgery.**
