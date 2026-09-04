# The mechanical room's poses, step by step — what the captures were actually doing

**2026-09-01.** Written because two theories were offered and both were wrong, and the owner asked
the right question: *"Did we actually diagnose one by one through that section?"* ⚑ **We had not.
This is that pass.** 77 poses, joined to their own photographs.

## What was claimed, and what it was worth

| claim | verdict |
|---|---|
| Repeated wakes rebuild the world; the zone has ~77 origins | ⛑ **Wrong.** `HSArProbe` had already measured that cycle: origin moved **0.00003 m**, mesh byte-identical. `mustReset` fires **once per zone** — 5 resets, 5 zones |
| Zero `relocalizing` in 109 wakes is a symptom | ⛑ **Wrong — it is a tautology.** `initialWorldMap` and `sessionShouldAttemptRelocalization` appear nowhere in the plugin; relocalisation was never possible to observe |
| A degenerate room: specular metal, rows of near-identical pipes, no depth | ⛑ **Wrong, and the owner called it.** The room shot shows exposed joists, shelving full of coloured spools and cans, boxes, a printer, distinct equipment. **It is feature-rich.** The "repeating pipes" line was the operator's description of *close-up work*, generalised into a description of the room by someone who had not looked at it |

## What the pose track actually does

**Not a collapse and not a slope. Seventeen discrete steps over 42 minutes, in both directions.**

    +0.181  -0.324  +0.432  +0.300  -0.311  -0.339  +0.267  -0.265  -0.424
    +0.317  -0.447  -0.525  -0.684  +0.608  +0.297  -0.605  -0.403

⚑ **The r = −0.91 line is drawn through a staircase.** `−0.088 m/min` is an artefact of fitting a
line to steps and should not be quoted as a drift rate.

⛑ **And the early excursions come back.** At 14.0–15.4 min the pose rises to **+0.568** and returns
to **−0.088** — a 0.66 m round trip in eighty seconds. *Drift does not come back.* Later excursions
recover only partly, around a falling baseline. **The thing that changes over the 42 minutes is not
the rate of wandering but how much of each excursion is recovered.**

## What coincides with a step

| | n | mean \|Δy\| | mean horizontal move | mean gap |
|---|---|---|---|---|
| steps > 0.25 m | 17 | 0.407 m | **0.651 m** | 22.0 s |
| steps ≤ 0.25 m | 58 | 0.059 m | **0.233 m** | 36.7 s |

⚑ **A large vertical step is ~3× more likely when the operator moved.** Only **3 of 17** happened
while nearly stationary, and those three are 0.30, 0.31 and 0.34 m — *the size of a person crouching
or standing up.* **This is not a frame collapsing underneath a stationary person.**

## The two extremes, looked at rather than reasoned about

⛑ **The objects are described, not named. An earlier cut of this file named them — "sump pit",
"brine tank" — and the owner corrected both.** *Naming equipment from a photograph is exactly the
inference this project forbids the app from making, and it cost a conclusion here:* the "sump pit"
reading was defended on the grounds that a sump pit is a metre deep. **It is a pump lid sitting a
few inches below the concrete**, so `surface.y = −3.07` — about a metre below the floor — is
**wrong by roughly a metre and is not evidence the ray-cast was sound.**

**The largest single drop (−0.684 m, 30.59 min)** is taken **straight down** at a large circular
black lid set into the concrete floor, with a black discharge pipe rising out of it. The lid, the
pipe and bare concrete fill the frame at close range.

**The highest pose (+0.568 m, 14.31 min)** is taken close on a **large, smooth, featureless
translucent plastic drum**, filling most of the frame, against a white wall.

⛑ **Both extremes share one thing, and it is not the room: a large, smooth, close, low-texture
surface filling the frame.** White poly tank; bare concrete and a pit mouth. *That is a property of
the subject, not of the mechanical room* — which is exactly the distinction the third wrong theory
failed to make.

## What is NOT concluded here

⚑ **The mechanism is still unknown, and this document does not invent a fourth theory.** What it
establishes is the shape — discrete, bidirectional, movement-correlated, partly reversible — and it
rules out the two mechanisms that were asserted.

**Two measurements now in the build settle it, and neither existed on the walk:**

- **`featurePoints`** — the tracked-point count on the frame the pose was read from. If the brine
  tank and the sump floor are low-count and the steps sit on the low-count frames, the subject
  hypothesis is measured rather than argued.
- **`resumeJumpM` / `sleepSec`** — where the session went to sleep against where it woke. *The
  operator does not teleport.* This separates "the estimate moved while paused" from "the estimate
  moved while walking" in one number, and the first two theories both died for want of it.

**The test is ten minutes in the same room**, not another walk: ~20 positions including one straight
down at the sump and one close on the brine tank.

⛑ **And one thing worth stating plainly for the desk pass**: a pose one metre below a concrete floor
is not a pose to be trusted, and **nothing in the export said so** — `tracking` read `normal` on
every one of them, because it could not read anything else.
