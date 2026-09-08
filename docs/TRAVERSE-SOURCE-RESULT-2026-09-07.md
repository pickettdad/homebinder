# A shutter at traverse cadence costs the tracking stream **nothing** — and the texture gate needs re-cutting

**Measured on device, iPad Pro 11-inch (3rd gen), 2026-09-07, tethered, one continuous walk.**
`--hs-traverse-source`, `HSTraverseSource.swift`. Raw: `Documents/hs-traverse-source.json`.

---

## ⚑ 1 · The shutter is free at traverse cadence

| window | fps | shots | failures | latency p50 | instrument cost |
|---|---|---|---|---|---|
| baseline | **29.97** | 0 | 0 | — | 615 ms |
| **1 Hz** | **29.96** | 24 | **0** | 71.6 ms | 678 ms |
| **2 Hz** | **29.96** | 49 | **0** | 83.8 ms | 656 ms |
| baseline again | **29.96** | — | — | — | 680 ms |

**Flat 30.0 across all four windows. 73 successful high-resolution captures, not one failure.**
Still resolution **4032×3024**, from a `1920×1440@30` stream.

⛑ **Baseline drift −0.0%**, which is the confound check finding no confound — window order, thermal
rise and map growth all moved across those 110 seconds and none of them moved the number.

⚑ **And the instrument ruled itself out**, which is the finding the first cut could not have produced:
**615 ms of probe work in the no-shutter window against 678 ms at 1 Hz.** *Essentially identical, so
the probe's own cost is not hiding inside the answer.* The first cut computed texture on ARKit's
pooled buffer inside the capture completion on the main thread — **only in the shutter windows**, at
the same order of magnitude as the effect being hunted.

**This retires the concern that motivated the probe.** `HSZoneSession`'s comment asserting the
tracking stream is never interrupted was Gate 1's measurement — taken at **one capture per fifteen
seconds** — extrapolated fifteenfold. *It happens to be right, and now it is measured at the cadence
that matters rather than inferred from one that does not.*

## ⚠️ 2 · The texture gate does not transfer, and by a knowable factor

**Covered lens, ARKit: `2.59`. Covered lens, AVFoundation (on record, `HSCameraPlugin`'s blank-first
calibration set): `1.83 / 1.88`, taken as `1.855`.**

```
pipeline scale = 2.59 / 1.855 = ×1.40
traverseKeepTexture  5.0  →  ≈ 7.0
```

⛑ **The blank anchor is what made this answerable at all.** A covered lens is *the one scene both
pipelines can be shown identically* — scene-free by construction. The first cut compared ARKit's still
against ARKit's stream, which is a real question and **not this one**, and no value it returned could
have said whether 5.0 transfers.

⚠️ **Shipping 5.0 unchanged would have left the gate 40% too loose, and the failure would have been
invisible** — frames kept that should not be, at a rate nobody could attribute. *Under a posed
traverse a wrongly-kept frame is a point on the pipe line that is not really there.*

**Corroboration from the same walk:** the room read `stream 18.95 → 24.12` against a blank of `2.59`
— a healthy, textured basement — and the still read consistently **≈1.3× its own stream** (`30.49`
against `24.12`), which is a separate and smaller effect from the pipeline scale and should not be
confused with it.

## What is still unknown

- **Whether the exposure lock interacts with the shutter.** Both are proven separately
  (`EXPOSURE-LOCK-RESULT-2026-09-06`, and this); neither run had both.
- **Feature points under shutter load.** The tracking *state* held `normal` throughout, which is
  coarser than the count Gate 1 used.
- **`0.20` targetTravel and `0.25` minimumOverlap** were fitted against AVFoundation frames like the
  texture gate. This probe re-cuts texture only; **the others still carry the old pipeline's
  calibration**, and the registration stamp must change when the frame source does.
