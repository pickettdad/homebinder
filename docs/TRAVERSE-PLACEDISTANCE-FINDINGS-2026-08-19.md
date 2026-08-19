# placeDistance does not separate. The measurement, before any recommendation.
2026-08-19. Walk: `hs-traverse-2026-08-19T11-49-45Z`, 70 frames, 51 s, one leg,
`continuesFrom: null`, lens `wide`, registration `flow-v3`. Scored against
[TRAVERSE-CLEANGAP-PREDICTION-2026-08-19.md](TRAVERSE-CLEANGAP-PREDICTION-2026-08-19.md).

## 0 · Correction — the carry IS the gap, and the traverse filed it as sweep

**An earlier cut of this document said the walk contained no gap to detect. That was wrong, and it
was wrong in the worst available direction: it recorded the app's failure to detect a gap as the
owner's failure to make one.** Nobody asked for a pause. The point was to test whether an
*undeclared* break is noticed.

The owner walked exactly what was ordered: sweep a wall → carry the iPad at his side, lens open and
pointing at the floor → raise at a second wall → carry again → sweep a third with an alcove. The 52
smeared frames are the carry, and they are unmistakable in the frames themselves — 33, 50, 51 and 54
show his own feet and the floor moving past.

    frames  0–3    wall 1, living room, brick     sharp
    frames  4–35   CARRY A                        smear, floor, feet
    frames 36–38   wall 2, gym                    sharp
    frames 39–56   CARRY B                        smear, floor, feet
    frames 57–69   wall 3, office + alcove        sharp

⚑ **The traverse fired straight through both breaks and filed the carry as sweep.** `gaps: 0` is a
miss, not an absence. What the mechanism actually said across the two carries:

| segment | contiguous | unverified |
|---|---|---|
| carry A (31 pairs) | **12** | 19 |
| carry B (17 pairs) | **6** | 11 |
| the four wall↔carry boundaries | **3** | 1 |

**Twenty-one affirmative "contiguous" calls across a break the concierge genuinely made.** The
unverified verdicts are the honest half — texture and `flowStill` declined to speak on 30 carry
pairs — but declining is not detecting, and the 21 affirmations are the false negative the feature
exists to prevent.

⚑ **And the frames are all stamped `exifOrientation: 6`, all 70 of them** — the run's rotation is
fixed at `startTraverse` alongside the exposure. So the carry frames, taken with the iPad held at
the owner's side, are stored claiming an orientation the device did not have. That is the same
lock-at-the-start pattern as §6, in a second place.

## 0a · What placeDistance did at the boundaries, which cuts both ways

**The four wall↔carry boundaries are the four highest `placeDistance` readings in the walk — ranks
1, 2, 3 and 4 out of 69.**

| pair | boundary | reading | rank | verdict filed |
|---|---|---|---|---|
| 56→57 | carry B → wall 3 | 1.061 | 1 | contiguous |
| 35→36 | carry A → wall 2 | 1.050 | 2 | contiguous |
| 3→4 | wall 1 → carry A | 1.042 | 3 | contiguous |
| 38→39 | wall 2 → carry B | 0.932 | 4 | unverified |

On this walk the measure ranked every transition at the top and **was not wired to anything** — it
is recorded and never gates. It is tempting to read that as "so wire it up".

**Don't.** It ranked them because each boundary is where sharp meets smear (§4), and the carry is
what makes both the blur and the place change — they are perfectly confounded here. §2 shows what
happens when they are separated: on sharp frames alone, same-room pairs reach 0.858 while
different-room pairs fall to 0.657. A boundary detector that only fires when one side is ruined is
a blur detector, and `textureScore` is already a better one, measured on a single frame with
nothing to be fooled about.

⚑ **Which means fixing the shutter (§6) removes this apparent success along with the smear.** Once
the carry frames are sharp, there is nothing here at all.

## 1 · The distribution — adjacent pairs as the device measured them

Split as §0 requires: 65 pairs sit **inside** a segment and are genuine continuations; 4 are the
wall↔carry **boundaries** and are genuine breaks.

    within a segment (n = 65)   min 0.249 · q1 0.473 · median 0.538 · q3 0.655 · p90 0.707 · max 0.838
    the four boundaries (n = 4)  0.932 · 1.042 · 1.050 · 1.061

Against the prior different-place floor of 0.726, **six of the 65 genuine continuations sit at or
above it** — 0.739, 0.744, 0.761, 0.766, 0.769, 0.838. Those six are false alarms at that
threshold, on a walk where nothing moved rooms.

Combined with the prior 61 same-place readings (0.269–0.699, one room, held steady), the same-place
set is now **n = 126, range 0.249–0.838**. The old clean band was a property of *that walk* — one
room, slow, steady, no carry — not of the measure.

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

**Yes. It still sits on the wrong side.**

0.873 is a genuine same-place reading. In this walk it sits above **all 65** genuinely-continuous
adjacent pairs (whose maximum is 0.838), above **all 87** same-room cross-pairs (maximum 0.858), and
above **63 of 103** different-room pairs — past the different-place median of 0.839. There is no
reading of this data on which 0.873 lands in same-place territory.

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
| §1(a) carry frames caught by texture, "by proxy, not because anything understood the wall changed" | **Half held, and the half that failed is the one that matters.** 22 pairs stopped at `tooLittleTexture` and 13 at `flowStill` — but 21 carry-and-boundary pairs were still affirmed `contiguous` (§0). The proxy leaks, and a leaky proxy for a false-negative guard is a false-negative guard. |
| §1(b) the no-carry-frames case, "no guard left" | **Untested.** The carry produced frames, so this case did not arise. |
| §4 feature print as a shared-content test, "not obviously in the family that has failed five times" | **Wrong, and it is in the family.** §2 and §4. |
| §4's own caveat — test it blank-first | **Vindicated and insufficient.** It passed blank and blurred inputs; it fails on the *distribution*, which only sixty samples a side could show. Blank-first is necessary, not sufficient. |

## 8 · What this invalidates about everything measured so far

**Every traverse measure has been evaluated against frames that were 71% smear.** By recorded
texture: 20 of 70 frames sit on a wall (mean texture 14.5), 50 are carry (mean 6.4), and 15 fall
below the `traverseMinimumTexture = 5.0` floor outright.

Texture, optical flow, coverage, `flowStill`, `crossCheck`, `implausibleShift`, `placeDistance` and
every constant tuned around them were fitted to that input. **Sharp frames have never been tested
against any of them.** No constant in the traverse should be trusted, in either direction, until one
walk exists where the carry is as sharp as the sweep — see
[SHUTTER-COSTING-2026-08-19.md](SHUTTER-COSTING-2026-08-19.md).
