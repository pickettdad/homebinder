# placeDistance does not separate. The measurement, before any recommendation.
2026-08-19. Walk: `hs-traverse-2026-08-19T11-49-45Z`, 70 frames, 51 s, one leg,
`continuesFrom: null`, lens `wide`, registration `flow-v3`. Scored against
[TRAVERSE-CLEANGAP-PREDICTION-2026-08-19.md](TRAVERSE-CLEANGAP-PREDICTION-2026-08-19.md).

## 0 · What the walk actually contains, because it is not the walk the prediction assumed

Three rooms, traversed in sequence, with the camera **running and pointed at the world the whole
time**: living room (brick wall, sofa) → gym → office. The concierge never lowered the iPad and
never broke the leg. So the predicted case 1(b) — *one pair, last sharp frame of wall A against
first sharp frame of wall B, no carry frames between* — **did not occur and remains untested**.

⚑ **There is therefore no gap in this recording to detect.** `gaps: 0` is not a miss. Every one of
the 69 adjacent pairs is a genuine continuation. That makes the walk a **false-alarm test**: any
pair a threshold would call a gap is a pair it got wrong.

Frames 0–3, 36–38 and 57–69 are sharp. The remaining 52 are heavy motion smear (see §4).

## 1 · The distribution — adjacent pairs as the device measured them (n = 69, all continuous)

    min 0.249 · p10 0.374 · q1 0.477 · median 0.539 · q3 0.671 · p90 0.766 · max 1.061

Against the prior different-place floor of 0.726, **10 of 69 genuinely-continuous pairs sit at or
above it**: 0.739, 0.744, 0.761, 0.766, 0.769, 0.838, 0.932, 1.042, 1.050, 1.061.

Combined with the prior 61 same-place readings (0.269–0.699, one room, held steady), the
same-place set is now **n = 130, range 0.249–1.061**, with 10 above 0.726. The old clean band was
a property of *that walk* — one room, slow, steady — not of the measure.

## 2 · The distribution — true different-place pairs, built by hand (n = 103)

Adjacent pairs cannot supply different-place samples here, so all pairs among the sharp frames
were computed off-device with the same Vision descriptor
(`VNGenerateImageFeaturePrintRequest` + `computeDistance`), labelled by room from the frames:

| set | what it is | n | min | q1 | median | q3 | max |
|---|---|---|---|---|---|---|---|
| `SAME_ADJ` | consecutive, same room | 17 | 0.210 | 0.356 | 0.422 | 0.558 | **0.767** |
| `SAME_FAR` | same room, different walls | 70 | 0.399 | 0.585 | 0.692 | 0.797 | **0.858** |
| `DIFF` | different rooms | 103 | **0.657** | 0.786 | 0.839 | 0.939 | 1.059 |

**The bands overlap over 0.657–0.858, and that overlap holds 60 of the 103 different-room pairs
and 44 of the 87 same-room pairs.** Extremes, all verified by eye: same-room `59↔68` reads 0.858;
different-room `38↔57` reads 0.657.

Best achievable threshold, same-place = any same-room pair:

| threshold | false gaps | missed gaps |
|---|---|---|
| 0.70 | 36 / 87 | 4 / 103 |
| 0.78 | 21 / 87 | 23 / 103 |
| 0.86 | 0 / 87 | 61 / 103 |

There is no setting with acceptable error on both sides. Restricting *same place* to consecutive
frames only — the most flattering framing available — still leaves 3 of 17 false gaps at the
best threshold.

## 3 · The neon-room pair, asked and answered plainly

**Yes. It still sits on the wrong side, and it is no longer a counterexample — it is typical.**

0.873 is a genuine same-place reading. In this walk it sits above **all 87** same-room pairs and
above **63 of 103** different-room pairs — i.e. deep inside the different-place band, past its
median of 0.839. And four of this walk's 69 genuinely-continuous adjacent pairs read at or above
it (0.932, 1.042, 1.050, 1.061).

The +0.027 margin was an artifact of five samples. With sixty-plus on each side it is gone.

## 4 · Why it fails — and it is the eighth instance, with the sign flipped

`corr(placeDistance, |log textureFrom/textureTo|) = +0.638` across the 69 pairs. The measure
tracks **change in sharpness**, not change in place. The walk's three largest readings are all
sharpness transitions, and two of the three are unambiguously the same view:

| pair | reading | what the frames show | texture |
|---|---|---|---|
| 3→4 | 1.042 | same living-room corner — brick, sofa, plant, bin in both | 17.7 → 6.5 |
| 35→36 | 1.050 | same gym — cubbies and TRX strap in both | 8.5 → 15.0 |
| 56→57 | 1.061 | hallway into the office, continuous | 6.3 → 16.6 |

⚑ This is the family that has now failed eight times, in its mirror image. The seven before it
reported **maximum confidence where they had least evidence**. This one reports **maximum alarm**
there. Same defect: *the answer is driven by the quality of the evidence rather than by the thing
being measured.* A descriptor distance is not a pixel correlation, but it is still a comparison
between two frames, and a blurred frame's descriptor is a descriptor of blur.

**And there is a second, quieter reason it cannot do the job.** `placeDistance` measures *scene
similarity*. The gap detector needs *overlap*. Two ends of one wall are the same place and share
no pixels; a blank stretch of wall shares pixels with no distinguishing scene at all. The measure
answers a different question, and §2's `SAME_FAR` row is that mismatch in numbers.

## 5 · Reproducibility, which is its own finding

The same descriptor, on the same two images, disagrees with itself by **mean |Δ| 0.053, max 0.212**
between the device (downscaled buffer) and this harness (full JPEG), bias +0.020. The measure's own
run-to-run spread is roughly **twice the margin the threshold was to be drawn in**. Any future
threshold on this quantity has to be stated together with the resolution it was measured at.

## 6 · Exposure is locked for the whole leg, and that locks blur as well as brightness

All 70 frames: **1/15 s, ISO 500, f/2.4 — identical**, across three rooms of visibly different
brightness. That is `startTraverse` doing exactly what it was told (`HSCameraPlugin.swift`
~L2041): exposure, white balance and focus lock at the start of the leg, an owner ruling recorded
in the code as *"lock it and let the window blow."*

⚑ **The ruling was made about one axis of the trade and silently binds a second.** Its stated
reason is highlight clipping — a *brightness* argument. But locking exposure also freezes the
**shutter**, and 1/15 s is a shutter for a person standing still and panning slowly. The moment
the concierge walks, every frame smears. 52 of 70 frames here are unusable as evidence, ISO 500
sits far below the format's ceiling, and nothing in the traverse re-opens the question when the
device starts moving.

This is reported, not acted on. It is a separate finding from the gap question and needs its own
owner ruling.

## 7 · Scoring the prediction

| claim | outcome |
|---|---|
| §1(a) carry frames caught by texture, "by proxy, not because anything understood the wall changed" | **Held.** 22 of 69 pairs stopped at `tooLittleTexture`, 13 more at `flowStill` — 35 of 69 unverified, and the walk deserved it. |
| §1(b) the no-carry-frames case, "no guard left" | **Untested.** The walk did not produce it. |
| §4 feature print as a shared-content test, "not obviously in the family that has failed five times" | **Wrong, and it is in the family.** §2 and §4 above. |
| §4's own caveat — test it blank-first | **Vindicated, and insufficient.** It was tested against blank and blurred inputs and passed those; it fails on the *distribution*, which only sixty samples a side could show. Blank-first is necessary and not sufficient. |
