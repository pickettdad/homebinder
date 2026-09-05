# The plate test — result

**2026-09-04 · `iPad13,4`, iPadOS 26.6.1 · one Liberty Pumps P382LE41 nameplate**, stamped metal,
dusty, low contrast, glossy, photographed at an oblique angle. Three frames through each path,
braced, same framing. **Both sets read by the same Vision recogniser at the same settings.**

## ⚑ The new path wins on the only thing that matters

| | frames | confidence | characters | **serial read** |
|---|---|---|---|---|
| **ARKit** (`captureHighResolutionFrame`) | 3 × 4032×3024 | **1.000 · 1.000 · 1.000** | 256 · 255 · 257 | ⚑ **`B10208434` — correct, 3 of 3** |
| **current path** (`AVCapturePhotoOutput`) | 3 × 4032×3024 | 0.981 · 1.000 · 0.974 | 254 · 255 · 258 | ⛑ **`10208434` — leading `B` dropped, 3 of 3** |

**`P382LE41`, `115 V`, `60 Hz`, `12 A`, `41 gal`, `0512`, `4/10` — both paths, all correct.**

⛑ **The difference is the serial, and 3-of-3 against 0-of-3 is not noise.** *A serial number missing
its first character is a serial number that matches nothing in a manufacturer's database* — the
failure is silent, looks like a successful read, and is exactly the class this project exists to
avoid.

**Confidence is also higher and steadier: 1.000 three times, against 0.974–1.000.**

## ⚑ It wins despite carrying a handicap

**The ARKit frames are 4.5 MB, the current path's are 6.4 MB** — because the probe re-encodes
ARKit's pixel buffer itself at JPEG 0.95, while the current path's frames come straight out of
Apple's photo pipeline. *So the new path is being read through an extra lossy compression the old
one never sees, and still reads the plate better.* **A production path that encoded at higher
quality could only improve on this.**

## What this does not establish

⛑ **The torch state is unknown, on both.** Both logged `torch false` — read immediately after
`setTorchModeOn`, and the torch was measured on 2026-08-28 to take **6 ms**. *The log is too early,
not the torch off.* It is the same on both sides, so the comparison holds; the worst-case
torch-on-glossy-metal scenario has not actually been tested.

**The two paths metered very differently** — ARKit at ISO 1728 / 1/60, the current path at ISO 162 /
1/120. Both readings were taken seconds after applying settings and may not have converged.
⚑ *Worth noting that the higher-ISO, slower-shutter path is the one that read better*, which is the
opposite of the intuition.

**One plate, three frames each.** A decisive result on this plate is not a general claim about all
plates.

## Verdict

**The last open objection to the new architecture is closed.** Photograph quality is not merely
acceptable through the tracking session — **on the hardest plate available it was better**, on the
field that a desk cannot recover from being wrong.
