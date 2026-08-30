# The traverse keeps nothing — what is ruled out, what is not

**2026-08-30 · open.** Recorded because three explanations have been offered and two are dead,
and the live one has never been tested.

## The symptom

Across four device runs in three lit rooms, **every traverse frame was discarded**: `kept: 0`,
texture **0.98–3.34** against `traverseKeepTexture = 5.0`. The walks that worked scored
**6.2–18.1** (2026-08-19: 70 frames, mean 14.5 on a wall, 6.4 on carry; the metered shutter took
the median 6.2 → 18.1).

## Ruled out, each by a measurement rather than an argument

| | |
|---|---|
| **The session preset / VGA frames** | ⛑ Real, and fixed. `dims: 4032x3024` and `photoRestored: true` on every reclaim — *and the frames were still discarded* |
| **The wide lens** | ⚑ **My diagnosis, and wrong.** The reasoning was sound — a 120° frame spreads the same wall over a fifth of the pixels — but the run that followed was on `lens: normal` at full resolution and scored **1.12–3.34**, the same range. *Sound reasoning about a thing that was not happening* |
| **A dark room** | The owner reports normal room lighting, and the object capture pulled off the device confirms it. **Not a dark room** |

## ⚑ Live, and never tested: the exposure plan raced the format restore

`traverseExposurePlan` opens with `let format = device.activeFormat` and derives the ISO ceiling
and **both shutter clamps** from it; `lightScore()` reads it too, so the **torch** decision inherits
the same numbers.

**The log times it exactly.** Every leg planned its exposure *before* the format was restored:

    9.55  traverseStart          <- exposure planned here
    9.84  presetRestored 296 ms  <- format correct only now
    40.45 traverseStart
    40.74 presetRestored 297 ms

⛑ **So both legs were shot on a shutter and an ISO ceiling computed from ARKit's binned video
format.** That produces exactly the soft, noisy frames a Laplacian scores near zero — *and it is
the one candidate consistent with every run, including the ones on the correct lens and the correct
preset.*

**A `sessionQueue.sync { }` barrier now closes it** — the queue is serial and the restore is already
enqueued, so an empty sync returns when the restore ahead of it finishes. **Untested against a real
leg**, because the run that produced the numbers above was on the build before it.

## What must NOT be done next

⚑ **Do not lower `traverseKeepTexture`.** It was calibrated in the room this instrument exists for,
and a threshold moved to make a bedroom pass would blind the mechanical room. *Changing a constant to
make a symptom disappear is how the first unexplained constant in this file got there.*

**The next test is one leg on the barrier build**, reading `traverseStop.kept` and the discard
scores. If texture climbs into the 6–18 band the race was the cause. If it does not, the remaining
hypothesis is that a painted wall and a duvet genuinely have no Laplacian energy — **and that is a
finding about where the traverse works, not a bug.**
