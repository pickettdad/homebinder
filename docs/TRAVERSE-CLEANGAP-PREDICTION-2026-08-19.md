# The clean gap — recorded BEFORE opening the folder. Third blind prediction.
2026-08-19. Sweep textured wall A · lower iPad to side, lens open and uncovered, walk ·
raise at textured wall B · continue.

## 1 · The transition pairs — I predict flow-v3 CALLS THEM CONTIGUOUS. This is a failure.

Two sub-cases, and they behave differently:

(a) If the carry produced frames — lowered iPad, blurred floor — TEXTURE CATCHES THEM. Last
    round the carry frames measured 4.1-4.3 against a 5.0 floor, and 23 of 48 pairs on the
    walk-to-new-room run were caught. So the transition is caught BY PROXY, through the blur,
    not because anything understood that the wall changed.

(b) ⚑ If the carry produced NO frames, there is ONE pair: last sharp frame of wall A against
    first sharp frame of wall B. Both richly textured. Nothing shared. **This is the case with
    no guard left.**
      - texture: BOTH HIGH, > 10. Passes. Texture never looks at the pair.
      - coverage: 0.80-1.00. Vision's flow always returns a field; with a smoothness prior and
        no true correspondence it yields moderate smooth vectors, and moderate vectors keep
        pixels inside the frame, which is all `covered` counts.
      - flowStill: does NOT fire. The image "moved" — spuriously, but it moved.
      - verdict: contiguous. WRONG.

## 2 · ⚑ I predict implausibleShift WOULD have caught it, and I removed it last round.
Translation-only registration on two unrelated frames returns a large garbage displacement —
the 0.73-1.00 signature seen all through this track. So the gate I demoted in #118 was very
likely the accidental guard on the only case the feature exists to detect. If the data shows
this, the demotion was right in its reasoning and wrong in its effect, and it needs restoring
as a partner rather than a gate.

## 3 · Fast vs slow mechanical: I predict BOTH jump substantially, near-all contiguous.
implausibleShift was rejecting 8/16 fast and 11/19 slow on healthy-texture frames. With it
demoted, those pairs now reach flow, which will find ~0.8 coverage. Expect fast and slow to
converge, which would confirm the fast/slow difference lived entirely in that gate.

## 4 · What I expect to be needed, if 1(b) holds
Not another correlation. A SHARED-CONTENT test that looks at the pair without fitting a
transform: Vision's `VNFeaturePrintObservation` + `computeDistance`. Same wall -> small
distance; different walls -> large. It is a learned descriptor rather than a pixel correlation,
so it is not obviously in the family that has failed five times. ⚑ To be tested blank-first
before any good walk, and it must ALSO be checked against a blank pair, because a descriptor
of two blank frames may well report them identical — which would be the sixth instance.
