# The traverse at the pin — what was tried, why it failed, what not to trust
2026-08-19. Owner ruling: **the gap detector is abandoned.** The traverse is *pinned, not retired* —
it still fires, still files frames, still records overlap. This page exists so a future session does
not spend a fortnight rediscovering the fortnight.

## Why it was abandoned rather than fixed

A gap is only actionable **in the room, while it can still be re-walked**. After the visit it is a
hole the desk works around, and the desk needs **frames**, not a verdict. Eight measures were built
in two weeks; all eight failed, and they failed in one family.

## The eight, and the one thing wrong with all of them

| # | measure | how it failed |
|---|---|---|
| 1 | whole-frame translational registration | a blank wall gives near-zero translation → reported **100% overlap** |
| 2 | half-frame registration, left against right | pegged at a 0.7500 rail — the search bound, not a measurement |
| 3 | per-axis whole-frame mis-registration | the axes disagreed on pairs a person could see were fine |
| 4 | optical flow coverage | a **covered lens** read 1.000 |
| 5 | blurred carry frames | read **contiguous at 0.80–0.93** — most confident on the worst input |
| 6 | local flow coherence | **+1.000 on everything**; it was measuring Vision's own smoothing prior |
| 7 | feature-print `placeDistance` | same-room pairs reach 0.858, different-room fall to 0.657 — bands overlap over 60 of 103 pairs |
| 8 | `placeDistance` at segment boundaries | ranked all four boundaries 1–4 of 69, but only because each boundary is where sharp meets smear |

⚑ **The family: every one of them is a correlation between two frames, and a correlation with
nothing to correlate returns a confident number.** Seven reported *maximum confidence where they had
least evidence*; the eighth reported *maximum alarm* there. Same defect, sign flipped — the answer
is driven by the quality of the evidence rather than by the thing being measured.

**The one measure that is structurally exempt is `textureScore`**: it is a property of a *single*
frame, so it has no partner to be fooled about. That is not a coincidence and it is the test to
apply to any future candidate.

## What did work, and stays

- **texture gate** — catches blank and blurred input, on one frame at a time.
- **`flowStill`** — catches a covered lens: the camera moved and the picture did not.
- **three-valued honesty** — `contiguous | gap | unverified`. A false gap is worse than silence, and
  `unverified` never reads as `gaps`.
- **the frames themselves**, which is what the desk was always going to use.

## ⛑ Constants nobody should trust, and why

Every one of these was fitted or judged against input that was **71% smear** — on the 2026-08-19
walk, 20 of 70 frames sat on a wall (mean texture 14.5), 50 were carry (mean 6.4), and 15 fell below
the texture floor outright.

    traverseMinimumOverlap   0.25    the gap threshold itself
    traverseMinimumTexture   5.0     the "nothing to see" floor
    stillThreshold           0.008   floor of the exposure-scaled gate
    flowStill                        the covered-lens gate's trigger point
    crossCheck               0.05    the half-against-whole agreement bound
    implausibleShift         2.5×    demoted to a recorded boolean, never restored
    placeDistance                    recorded, gates nothing, and must stay that way

**Sharp frames have never been put in front of any of them.** No constant here should be moved in
either direction — tightened *or* loosened — until one walk exists where the carry is as sharp as
the sweep. The shutter change of 2026-08-19 is what produces that walk.

## The two lock-at-the-start defects, both now fixed

`startTraverse` froze **exposure** and **rotation** at the instant the leg began, and applied both to
the whole leg as though nothing changed.

- **Exposure** produced 1/15 s on every traverse frame of every walk — a shutter for someone
  standing still — because the ruling behind it (*lock it and let the window blow*) reasoned about
  brightness and nobody noticed it also freezes the shutter. Now metered per leg; see
  [SHUTTER-COSTING-2026-08-19.md](SHUTTER-COSTING-2026-08-19.md).
- **Rotation** stamped `exifOrientation: 6` on all seventy frames of a walk where fifty were taken
  with the iPad at the owner's side. The frozen value stays — re-rotating mid-leg would make the
  pairs either side of a turn incomparable — but each frame now carries the angle the device
  actually had, and `framesTurnedFromStamp` names the ones that disagree.

⚑ **The class is general and worth carrying forward: a value read once at the start of a run and
applied to the whole run is a snapshot being quoted as an observation.** Same shape as a stale config
reading. Two instances were found in one function; assume there are others.

## What the panel says now

The verdict **stopped headlining at the same moment it stopped being trusted.** Frames lead; the
verdict and the gap count sit in the grey line beside `disparity`, labelled *recorded, not deciding*.

⚑ Leaving a demoted metric in the lead is the **third** instance of that defect here — `disparity`
printed as though it still gated, the torch word meant two things at once, and now this. A metric
that stops deciding must move at the same time, in the same change.
