# Item 2's two probes — measured on device

**2026-08-28 · `iPad13,4`, iPadOS 26.5 · `HSControlProbe`, tethered, three runs.**
Running list item 2: *"Either could kill decision one, and both are cheaper than finding out inside
a big run."* ⚑ **Neither kills it. One of them prices it.**

---

## Probe A · Can Text mode be flown while ARKit holds the lens? — **yes, all six controls**

`ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera` returns
`AVCaptureDeviceTypeBuiltInWideAngleCamera`; `lockForConfiguration()` succeeds.

| control | supported | took | **still held 2.5 s later** |
|---|---|---|---|
| `autoFocusRangeRestriction = .near` (close focus) | ✓ | ✓ | ✓ |
| `focusMode = .continuousAutoFocus` | ✓ | ✓ | ✓ |
| `focusPointOfInterest` | ✓ | ✓ | ✓ |
| `exposurePointOfInterest` (spot metering) | ✓ | ✓ | ✓ |
| `exposureMode = .continuousAutoExposure` | ✓ | ✓ | ✓ |
| torch on / off (the pair) | ✓ | **6 ms on, 6 ms off** | ✓ |

⚑ **The question was never whether the capabilities are supported** — those are facts about the
hardware and every one of them was always going to say yes. It was whether a setting **sticks**,
because ARKit drives auto-exposure and auto-focus on that same device every frame for its own
purposes. **A value that is accepted and quietly reasserted a second later tests green and fails in
the field.** So each control was asked three times: supported, took, and still-holding after 2.5 s.

*The focus and metering points were written to (0.4, 0.6) rather than centre on purpose: centre is
also the default, so writing it would prove nothing about whether it took.*

⛑ **The torch is 6 ms in both directions**, against a `torchPairSettleSeconds` budget of 450 ms.
The pair has seventy times the headroom it needs.

### ⚑ What was not measured, stated rather than implied

**This does not prove a photograph can be taken through those settings while ARKit holds the lens.**
ARKit and an `AVCaptureSession` cannot share the rear camera, so decision one's shape would capture
stills via `captureHighResolutionFrame(using:)` — and **whether that path honours
`exposurePointOfInterest` and the near-focus restriction is a separate question this probe does not
answer.** It is the next thing to measure if decision one is taken.

---

## Probe B · What does a format change cost in **time**? — **~700 ms to the new frame, ~1.5 s to a usable world**

Five real transitions (a sixth was correctly skipped as already-live):

| from → to | new resolution live | **tracking `.normal`** | pose jump |
|---|---|---|---|
| 1920×1440 → 1920×1080 | 677 ms | 1496 ms | 0.08 mm |
| 1920×1080 → 1280×720 | 599 ms | 1452 ms | 0.09 mm |
| 1280×720 → **3840×2160** | 817 ms | 1452 ms | 0.07 mm |
| 3840×2160 → 1920×1440 | 718 ms | 1556 ms | 0.21 mm |
| 1920×1440 → 1920×1080 | 657 ms | 1505 ms | 0.02 mm |

⚑ **The world survives — `HSLensProbe`'s finding holds and is now tighter.** Sub-millimetre jumps
with the iPad stationary; the 15 mm previously measured was a hand moving.

⛑ **But the wait is real and it is ~1.5 s.** Between the switch and `.normal`, `position()` refuses
(`waitForTrackedFrame` requires `.normal`), so **a position taken immediately after a mode change
either waits 1.5 s or comes back a refusal.**

⚑ **And the 1.5 s does not scale with resolution.** 1452 ms for 720p and 1452 ms for 4K, across a
16× pixel difference — with the *first frame* time varying sensibly (599–817 ms) while tracking
recovery does not. **That is a fixed settling window, not a cost of moving more pixels**, which
means a cheaper format buys nothing.

### What this prices for decision one

**Decision one — ARKit holds the camera for a whole zone — is not killed and is not free.** If it
swaps format per capture mode it pays **~1.5 s of unusable tracking per mode change**, and no choice
of resolution reduces it. That is affordable at a handful of mode changes per zone and is not
affordable per capture.

---

## And a finding about the instrument, recorded because it nearly shipped a wrong number

**The first cut of probe B reported 13 ms twice and 1566 ms once.** Three numbers, one instrument —
and ⚑ **the disagreement was the instrument**, twice over:

1. It waited for a frame whose **timestamp** was newer than the pre-switch one. `session.run(config)`
   is asynchronous, so **the very next frame off the old format satisfied that.** 13 ms is the poll
   interval, not a switch.
2. Its first trip switched to the format **already running** — a no-op, timed at 13 ms and read as a
   fast switch.

Both are the same defect this repo keeps naming: *the thing consulted was not the thing that
governs.* A frame is evidence of the new format only when **its resolution is the new format's**, so
that is what is waited for now, and an already-live target is skipped and **says it was skipped**.

⛑ **The torch is the same lesson in the other direction.** Asked as a boolean it answered `true` in
run 1 and `false` in run 2 — same device, same code, same room. **A control whose answer changes
between runs is one nobody has measured.** Asked as a latency it is 6 ms, every time. *The
variability was in when it was read, not in the torch.*

**And one about the tooling, which cost the first two runs entirely.** `NSLog` goes to the unified
log and **not** to the stream `devicectl … --console` captures, so a probe that ran correctly
produced zero lines. `print` reaches stdout, which the console does capture. *Same class as the
`idevicesyslog` afternoon.* The probe now prints, `NSLog`s, **and** flushes every line to
`Documents/hs-control-probe.txt` — written after each line rather than at the end, because a probe
that only writes on completion has nothing to show for the run that hung, which is the run you most
want to read.
