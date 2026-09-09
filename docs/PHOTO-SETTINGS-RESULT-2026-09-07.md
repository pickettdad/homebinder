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

---

# Addendum — the exposure ladder and the torch, same desk session

## ⚑ Exposure: real, and modest

**Constant exposure, trading gain for time**, so a rung that improves the picture does so by
collecting more light rather than by being brighter. Mean luma held 109.5 → 100.1 across the ladder.

| rung | reached | shadow noise | shadow SNR | texture |
|---|---|---|---|---|
| **auto** (ARKit's own) | 1/60 · ISO 706 | 1.61 | 15.3 | 7.13 |
| 1/30 · ISO 200 | 1/30 · ISO 200 | 1.08 | **18.9** | 5.50 |
| **1/15 · ISO 100** | 1/15 · ISO 100 | **1.02** | **19.4** | 5.73 |
| 1/8 · ISO 50 | 1/8 · ISO 50 | 1.29 | 15.1 | 6.92 |

**≈ −37% shadow noise, +27% shadow SNR at 1/15–1/30.** ⚠️ **And it turns back at 1/8** — handheld
motion at an eighth of a second, or the sensor's own floor. *The ladder has an optimum rather than a
direction, which is why it was measured rather than reasoned.*

⛑ **Texture falls as SNR rises, and that is not a contradiction — it is the reason two statistics
are recorded rather than one.** A Laplacian answers to detail *and* noise. Removing noise at
constant detail lowers it. **Texture alone would have called the quiet rungs worse.**

## ⚠️ The torch: 13%, not the multiple this session predicted

| | shadow SNR | dark luma | ISO |
|---|---|---|---|
| off (before) | 15.6 | 24.9 | 739 |
| **on** | **17.7** | 27.2 | 687 |
| off (after — the control) | 15.2 | 24.8 | 708 |

⛑ **The closing control matches the opener** — SNR 15.6 → 15.2, dark luma 24.9 → 24.8, dark share
0.283 → 0.286. *The scene did not move, so the middle reading means what it says.*

**And what it says is +13%.** The lamp lifted the shadows from luma 24.9 to 27.2 and no further: **a
phone LED cannot fill a room-sized space at a few metres.** *This session predicted "multiples" and
was wrong; the number is recorded here so the prediction is not repeated.*

## 🔴 What this desk CANNOT answer, and the owner named it

**Feature counts read 2–4 in every rung, against Gate 1's median of 229.** The first reading of that
was "a textureless scene." **The owner's diagnosis is better and it is structural:**

> *"You are starting fresh in a space with no world-tracking history and expecting it to pick things
> up immediately?"*

⚑ **ARKit triangulates feature points from parallax.** A stationary iPad, seconds after a cold
`run()`, generates almost none — **so a stationary probe reads near-zero features regardless of how
textured the scene is.** The instrument is not measuring the scene; it is measuring the fact that
nothing has moved.

⛑ **So the cost half of the exposure question cannot be answered on a desk, by this probe or any
other stationary one.** *A long exposure's effect on tracking is only observable while walking* —
the same correction `EXPOSURE-LOCK-RESULT` had to make, arriving again through a different door.

**The image half is unaffected**: a photograph of a static scene is a fair test of a photograph.

## Where this leaves the softness

**Every lever now has a number, and none of them is large:**

| lever | measured | status |
|---|---|---|
| photo pipeline / fusion | — | 🔴 **refused** (`.quality`), inert (`.balanced`) |
| exposure 1/15–1/30 | **+27% shadow SNR** | ⚠️ tracking cost unmeasured — needs a walk |
| torch | **+13% shadow SNR** | ✅ safe, small |
| JPEG quality · colour space · encode | 0 | ✅ fixed anyway; **cannot** move sharpness |

⚠️ **Combined, exposure and torch are worth perhaps 40% in a dim room — not a transformation.** The
honest reading is that **a single-frame 12 MP grab in an unlit room is close to what it is**, and
the largest remaining variable is not in the code: *it is how far the concierge stands from what
they are photographing.* **That belongs to the owner, not to a setting.**
