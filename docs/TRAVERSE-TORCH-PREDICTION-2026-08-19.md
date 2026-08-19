# placeDistance under the torch — recorded BEFORE opening the folder. Fourth blind prediction.
2026-08-19. Same mechanical room, same route, three lighting conditions.

## ⚑ I disagree with the design session on the DIRECTION, and this records it.

The design session expects the torch to push placeDistance UP (frames less alike), reasoning that
the lit pool moves with the camera while the room does not, so one frame has its near half lit and
the next a different near half.

⚑ I predict the opposite: the torch pushes placeDistance DOWN — frames MORE alike — and that this
is worse, not better.

A feature print is a learned descriptor over the whole frame, not a correspondence between
regions. The torch pool sits in roughly the SAME IMAGE POSITION in every frame, because it is
bolted to the camera. To a descriptor that is shared content, even though it corresponds to
nothing in the room. **A feature that travels with the instrument reads as evidence about the
room** — which is `lightScore` unable to see its own torch, one measure over, and the eighth
instance of this track's shape.

## Predictions, by condition

1 · LIGHTS ON, no torch — the control.
    placeDistance same-wall 0.30-0.60, matching the mechanical numbers already measured
    (0.308, 0.433). Texture high, 12-26. This should look like the earlier good walks.

2 · LIGHTS ON + TORCH — I predict placeDistance FALLS somewhat versus (1), perhaps 0.25-0.45.
    The room is already lit so the torch adds a constant bright blob rather than revealing
    anything. Constant blob = spurious shared content.

3 · ⚑ DARK + TORCH — I predict placeDistance falls FURTHEST, 0.15-0.40, approaching the
    covered-lens value of 0.202. Now the torch pool is the ONLY lit content: every frame is
    bright-pool-plus-darkness, and consecutive frames resemble each other for that reason rather
    than because they show the same wall.
    Texture: mid and variable, 4-12, because most of the frame is black. Some pairs may dip
    below the 5.0 floor and be caught as tooLittleTexture.
    Coverage: HIGH, 0.9+, by the usual route — less to track, more confidence.

## What it means either way
If I am right, the torch makes placeDistance LESS able to separate places, so it must never be
calibrated on torch-lit runs, and "use the torch to stabilise it" is exactly backwards.
If the design session is right and it rises, the torch is merely noisy rather than deceptive,
and the measure survives with a lighting caveat.

⚑ If placeDistance under dark+torch lands near 0.2 while the frames plainly show different parts
of the room, that is the seventh instance confirmed and the measure cannot be rescued by light.
