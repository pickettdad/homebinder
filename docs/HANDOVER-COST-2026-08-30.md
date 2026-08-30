# What a position anchor costs at a leg boundary — measured

**2026-08-30 · `iPad13,4`, iPadOS 26.6 · two-leg trace, tethered pull of the zone log.**
Recorded because the field reported *"the camera/pose handover from leg 1 to 2 was a bit of a wait"*
and a number is the only useful answer.

## The boundary, broken down

    22.24  traverseStop          leg 1 ends
    22.40  cameraYielded         +0.16   AVFoundation lets go
    22.77  tracking limited      +0.36   ARKit has the lens
    27.67  tracking normal       +4.90   ⛑ RELOCALISING
    27.68  position ok           +0.02   the pose itself is free
    28.07  cameraReclaimed       +0.39
    28.30  presetRestored        +0.23   224 ms
    28.53  traverseStart         +0.23   exposure settled in 223 ms
                                 -----
                                  6.29 s

⚑ **4.9 of the 6.3 seconds is ARKit relocalising, and everything else is already small.** The pose
read itself costs 20 ms. There is no fat left in our code at this boundary.

## ⛑ The asymmetry, which is the finding

| | to `tracking normal` |
|---|---|
| **First position of a zone** (`reset: true`, fresh world) | **0.85 s** |
| **Every later position** (`reset: false`, resuming a slept session) | **4.87 – 4.90 s** |

**A fresh session tracks in under a second; a resumed one relocalises in five.** *Relocalisation is
matching the current view against a saved map*, so it is **feature-dependent** — and these numbers
come from a bedroom. ⚑ **A mechanical room is the densest-featured room in the house and may
relocalise far faster.** That is a prediction, stated as one, and the first real walk answers it.

**`.resetTracking` would take it back to 0.85 s and is not available**: it destroys the origin every
position in the zone is measured against, which is the one thing that makes the anchors comparable.

## What this costs the concierge, honestly

A traverse leg boundary costs **~6 s**, of which ~5 s is unavoidable today. **A mechanical room
walked as 7–8 legs pays it 7–8 times: roughly 45 seconds across the room.** Acceptable; not free.

⚑ **And it is decision one, not a defect.** ARKit and an `AVCaptureSession` cannot share the rear
lens, so every anchor is a handover and every handover is a relocalisation. `HSControlProbe`
(2026-08-28) already established that Text mode is flyable under ARKit — close focus, spot metering
and a 6 ms torch all take and hold. **If ARKit holds the camera for the whole zone, this cost goes
to zero and the traverse could carry a pose per frame.** What remains unmeasured is whether
`captureHighResolutionFrame` honours those device settings, which is the next probe if decision one
is taken.

## Not changed, and why

**The boundary already takes exactly one position**, carried forward as both the end of leg N and
the start of leg N+1 — they are the same place at the same moment. Taking fewer would leave a leg
without an anchor, and the anchors are the route.
