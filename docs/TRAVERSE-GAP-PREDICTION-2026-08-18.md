# flow-v2 against a REAL gap — recorded BEFORE opening the owner's four folders
2026-08-18. Second prediction in this track. Written blind.

A real gap is not a covered lens. It is a perfectly good image of somewhere else: full texture,
full contrast, nothing shared. Flow has never seen that, and it is the case the whole feature
exists to detect.

## 1 · The real gap (mechanical room, carried to a different wall, continued)

⚑ I predict flow-v2 CALLS IT CONTIGUOUS. I expect coverage 0.85-1.00 and the `flowStill` guard
NOT to fire.

The guard asks: did the camera move while the picture did not? On a real gap the camera moved AND
the picture changed completely, so both halves are satisfied and the guard passes the pair
through to coverage — which is high, for the same reason it was high on the covered lens.

Why coverage is high with nothing shared: a dense flow estimator always returns a field. With no
true correspondence it finds spurious local matches and a smoothness prior pulls them together,
so the vectors are moderate and mostly short. Short vectors keep pixels inside the frame, and
"inside the frame" is what `covered` counts.

⚑ If this is right, the guard I shipped last round is aimed at the wrong failure. It catches a
BLIND measure and not a WRONG one, and those are different: the covered lens had no information,
a real gap has full information about the wrong place.

## 2 · The discriminator I expect to be needed: coherence, not magnitude
Real motion is spatially smooth and consistent in direction — neighbouring pixels agree. Spurious
matching between unrelated images is not: direction scatters. So the measure that should separate
them is the VARIANCE or directional agreement of the flow field, which flow-v2 does not compute.
`flowP90 / flowMedian` is the cheapest proxy already being recorded.

## 3 · Faster walking reads MORE contiguous — I predict the owner is right and it is a defect
Faster motion means more blur, blur means less texture, less texture means the estimator has less
to correlate, and every measurement in this feature has reported most confident where it had
least evidence. So speed should RAISE coverage. If the numbers show that, it is the same failure
a fourth time and not a separate one.

## 4 · Covered lens on flow-v2
Here I expect the guard DID work — a covered lens produces near-zero flow while the accumulator
says he walked, which is exactly what `flowStill` tests. The owner reports it "went quiet then
fired intermittently", which is consistent with the guard firing and the run continuing.

## Standing
Threshold untouched. If 1 is right, the fix is coherence, and it must be tested against a blank
input FIRST — all four measures so far were tested against a good walk first, and all four passed.
