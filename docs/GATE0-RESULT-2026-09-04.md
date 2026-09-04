# Gate 0 — result

**2026-09-04 · `iPad13,4`, iPadOS 26.6.1 · 11 minutes, 1,319 samples, bare `ARWorldTrackingConfiguration`.**
No plane detection, no scene reconstruction, no frame semantics, no RoomPlan, no high-resolution
format, no photography. **The platform, stripped of us.**

## ⚑ PASS — 4.5 cm, against a 10 cm kill threshold

    rest #1   0.50 – 3.95 min   415 samples   centre (+1.324, −0.760, +0.167)
    rest #2   8.64 – 9.22 min    70 samples   centre (+1.365, −0.770, +0.150)

    return-to-reference displacement: 4.5 cm   (vertical component −0.9 cm)

⛑ **One caveat, and it is a real one: there were two rests, not three, and the first ran 3.5
minutes.** The protocol asked for a rest at 0, 5 and 10 minutes. So this is **one** comparison, and
it assumes both rests were the same physical spot. *If they were not, the 4.5 cm means nothing.* The
three findings below do not depend on the jig at all.

## The mechanism, confirmed three ways — none of which needs the reference point

| | production build (2 % duty cycle) | **Gate 0 (continuous)** |
|---|---|---|
| `worldMappingStatus` | **never past `limited`** | **`mapped` 323 · `extending` 249** · limited 743 · notAvailable 4 |
| tracked feature points | **0 – 9** | **median 133, max 558** |
| origin `ARAnchor` revised by ARKit | *never observable* | ⚑ **yes — the anchor moved** |

⚑ **Fifteen to sixty times more tracked points, a map that actually reaches `mapped`, and an anchor
ARKit went back and corrected.** *That is loop closure, which the production build has never once
achieved and could not have.*

**This is the research response's central claim, measured on the target device in eleven minutes:
give ARKit the camera continuously and it builds the map that corrects it.**

## What this says about the top-ranked risk

The response ranked an **iPadOS 26.4+ world-tracking drift regression on LiDAR devices** as risk #1,
on two forum reports, and said our own data could not distinguish it from our duty-cycle failure
because both produce *good standing still, error with travel*.

⛑ **Not reproduced at this scale.** Eleven minutes of ordinary room walking on 26.6.1 returned to
4.5 cm with a −0.9 cm vertical component. **That is not the reported signature** — which is
directional drift that grows with travel — and it is nothing like our own 3 m.

⚑ **"Not reproduced" is not "does not exist."** The reports describe longer routes, outdoors, without
loop closure. **A single room with constant re-observation is the most favourable case there is**, and
it is also exactly our use case. *The honest statement is that the regression does not bite at the
scale and in the setting we work in.*

## What is now known that was not

**Our failure was never the room, the subject, the wake, or the OS. It was that the tracker was off.**
Gate 0 removes the only variable and the numbers move by more than an order of magnitude.

**Also answered, for free: 7 of this device's 13 video formats carry
`isRecommendedForHighResolutionFrameCapturing`** — including 1920×1440@60 and @30, and 1920×1080@60
and @30. *That is the response's Gate 1 minutes 0–5, closed without walking.*

## What Gate 0 did NOT test, said plainly

**No photography, no RoomPlan, no scene reconstruction, no high-resolution format, no thermal load,
and eleven minutes rather than forty-five.** Everything that makes this expensive is absent. ⛑ *Gate
0 clears the platform; it says nothing about whether our production load survives on it.* Gate 1 is
where that is answered, and the numbers it must beat are 10 cm at 45 minutes.
