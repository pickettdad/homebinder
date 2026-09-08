# `photoQualityPrioritization` does nothing on ARKit's high-resolution capture

**Measured on device, iPad Pro 11-inch (3rd gen), iPadOS 26.6.1, 2026-09-07, tethered, desk — no
walk.** `--hs-ar-probe`, `HSArProbe.probePhotoQuality()`. Raw: `Documents/hs-ar-probe.json`.

---

## ⚑ VERDICT — the lever does not exist, and the session that proposed it was wrong

**Owner, 2026-09-07:** *"I want the best solution for the image quality, not a bandaid."* This
session answered that iOS 26's `captureHighResolutionFrame(using:)` would let ARKit take a
photograph *through the photo pipeline* — fusion and all — without giving up the camera, and called
it "the non-bandaid answer." **It is not an answer.**

Measured on the **zone's own format** (`HSZoneSession.stillFormat()`, `1920×1440` stream,
`isRecommendedForHighResolutionFrameCapturing == true`, stills at `4032×3024`):

| rung | asked | result | texture | noise | shadow SNR | mean luma | ISO | shutter |
|---|---|---|---|---|---|---|---|---|
| **`.speed`** — ARKit's own default | 1 | ✅ ok | **7.10** | 1.30 | 15.4 | 108.9 | 722 | 1/60 |
| **`.balanced`** | 2 | ✅ ok | **7.10** | 1.30 | 15.5 | 109.2 | 722 | 1/60 |
| **`.quality`** | 3 | 🔴 **refused** — `ARError 107` | — | — | — | — | — | — |

⛑ **`.balanced` is accepted and changes not one measurable thing** — texture identical to two
decimal places, noise identical, shadow SNR within 0.1 on a handheld pair. *An accepted setting that
moves nothing is worse than a refused one, because it looks like it worked.*

⚑ **And ARKit's own default is `.speed` — the lowest rung.** That is the framework stating its
position: its high-resolution capture is a *sensor grab*, not a photograph, and it is not going to
be talked into becoming one.

## ⛑ The crash hazard is closed, and that was worth the probe on its own

`AVCapturePhotoOutput` is documented to **raise `NSInvalidArgumentException`** — not return an error
— when the requested prioritisation exceeds the output's `maxPhotoQualityPrioritization`, and
**ARKit owns that output and never exposes it**, so the cap cannot be read and cannot be raised. An
uncatchable exception in a mechanical room is a lost visit.

**It does not raise. It returns `ARErrorCodeHighResolutionFrameCaptureFailed` (107) in 2.5 ms.**
*So this was always safe to try, and is now known to be so rather than assumed either way.*

## ⚠️ The first cut of this probe measured the wrong thing, and the second cut is why it is citable

The first run read `session.configuration?.videoFormat` **as it found it** — after `probeStepOut`
had paused the session, handed the camera away and resumed — and measured a **2016×1512** still on a
format reporting `isRecommendedForHighResolutionFrameCapturing == false`. **The zone never runs that
format.** A refusal measured there would have been reported as a refusal of the feature.

⛑ *Same class as the covered-lens anchor in `TRAVERSE-SOURCE-RESULT`: a comparison is worth
something only when both sides are shown the same thing.* `probePhotoQuality` now re-runs the
session on `HSZoneSession.stillFormat()` itself and asserts `pqFormatRecommended` in the record.

**And all three rungs are asked, not just the hoped-for one.** A refusal of `.quality` alone cannot
separate *"ARKit will not process a still"* from *"ARKit will not go that far"* — and `.speed` is
the control that says the instrument works.

## ⚑ What the same run establishes, and it is the useful half

**The exposure is the variable, and it is not subtle.**

| | this run (dim room) | `PLATE-AB` ARKit frame (lit, braced) |
|---|---|---|
| shadow SNR | **15.4** | **41.5** |
| ISO | **722** | 1728 |
| shutter | 1/60 | 1/60 |

And on the owner's own field captures, scored on the Mac from the 2026-09-07 export: **shadow SNR
18.5**, shadows at luma 23 against 53, **1.6× the colour noise** — with **43% of the frame** below
luma 48 in this probe's scene.

⛑ **ARKit meters for a 60 Hz tracking stream**: short exposure, whatever ISO that costs, because a
dropped frame costs it tracking. **A photograph is not a tracking frame, and the concierge is
standing still when taking one.** That asymmetry is unexploited — the traverse locks exposure and
banked a measured **median texture 6.2 → 18.1**; the object capture locks nothing.

## What this rules out, so nobody pays for it twice

- **Not the photo pipeline.** Refused, and the accepted rung does nothing. *This document exists so
  the next session does not re-propose it.*
- **Not JPEG.** ≈2.2 bits/pixel at 12 MP, at the top of the band Apple's own camera writes.
- **Not motion blur.** Anisotropy coherence 0.03–0.13 across the owner's captures; hand-shake is
  strongly directional.
- **Not defocus.** No tile anywhere is sharp — max 14.0 against a good frame's 35.9.
- **Not the encode.** Real defects were found and fixed there (dropped colour attachments,
  uncalibrated colour space, a `CIContext` per photograph) and **none of them can move sharpness.**

## ⚑ Confirmed in passing, and it validates a fix shipped the same day

`hasYCbCrMatrix: true`, `hasPrimaries: true`, format `420f` (full-range bi-planar YCbCr).

**ARKit's buffers DO carry their colour attachments** — so `copyBuffer`'s `CVPixelBufferCreate`,
which makes a buffer with none, was genuinely dropping them and CoreImage was guessing the YCbCr
conversion on every filed still. *The fix was repairing a real loss rather than a theoretical one,
and this is the measurement that says so.*

## What is still open

- **Whether a photographic exposure is affordable for an object capture.** `EXPOSURE-LOCK-RESULT`
  proves ARKit permits `setExposureModeCustom` mid-session and that 1/60 @ ISO 400 costs tracking
  nothing. **Nothing has measured a longer, lower-gain exposure**, which is what a stationary
  photograph could afford and what the shadow SNR above is asking for.
- **The torch, which nothing has measured in a zone.** It is held on the same device, `hasTorch` is
  true, and a dim room is exactly its case.
- **`maxPhotoDimensions`** reads `4032×3024` — the sensor's full 12 MP, so there is no higher
  multi-frame-fused tier on this iPad to request.
