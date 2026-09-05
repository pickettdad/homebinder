# Gate 1 — result

**2026-09-04 · `iPad13,4`, iPadOS 26.6.1 · 46 minutes, 5,520 trajectory samples, 179 high-resolution
captures, one living room.** Production load: scene reconstruction on, a high-res-capable format,
planes on, depth on, and a 12 MP-class still taken **through the tracking session** every 15 seconds.
No viewfinder drawn.

## ⚑ PASS — 6.0 cm maximum, against a 10 cm go/no-go

Nine rests on one rigid reference, spread across the session by the operator.

| return at | closure error | vertical |
|---|---|---|
| 7.76 min | 3.0 cm | −2.2 cm |
| 13.54 min | 4.3 cm | −1.7 cm |
| 19.17 min | 4.9 cm | −4.0 cm |
| 24.77 min | 5.3 cm | −3.4 cm |
| 30.57 min | 5.2 cm | −2.7 cm |
| 36.17 min | 4.5 cm | −3.0 cm |
| 41.12 min | 4.5 cm | −2.9 cm |
| **45.16 min** | **6.0 cm** | **−3.8 cm** |

⚑ **And it does not grow — it plateaus around 5 cm and wanders.** 3.0 → 4.3 → 4.9 → 5.3 → 5.2 →
4.5 → 4.5 → 6.0. **That is bounded error, not drift**, and the distinction is the whole point: *the
production build's error was a function of elapsed travel and this one is not.*

**Vertical, the axis that failed catastrophically before: −1.7 to −4.0 cm, against 3 m.**

## The three predicted risks did not materialise

| the response's prediction | measured |
|---|---|
| thermal `.fair` by 10–20 min, `.serious` plausible at 30–60 | ⚑ **`nominal` for all 5,520 samples across 46 minutes** |
| silent thermal throttling shows first in delivered frame rate | **24.0 fps in the first five minutes, 24.0 fps in the last five.** No throttling at all |
| continuous ARKit costs battery | ⛑ **9% for 46 minutes — against the current build's 17% for 45.** *Continuous tracking with no viewfinder is little more than half the power of the sleep/wake build with one* |

**Extrapolated: ~12% per hour, so a three-hour visit is ~35% of a charge.** Gate 2 still owes the
real number; the direction is not in doubt.

## Capture

| | |
|---|---|
| captures | **179, zero errors** |
| latency | **p50 78 ms · p95 187 ms · max 470 ms** — against **6.3 s** per photograph today |
| tracking at capture | `normal` on 178 of 179 |
| mapping at capture | `mapped` 129 · `limited` 42 · `extending` 8 |
| ray-cast hit rate | **172 of 179 — 96%**, distances 0.14–5.72 m, median 1.72 m |
| image | sharp, well exposed, 1.8–3.1 MB |

**Session health:** feature points median **229**, max 592 — against **0–9** in production. Mapping
`mapped` for 68% of the session. ⚑ **The origin anchor was revised by ARKit 71 times** — loop
closure, continuously, which the production build achieved zero times in its life.

## ⛑ One genuine failure, and it is ours not the platform's

**Every capture came back 4224×2376 — 10.0 MP, 16:9 — not 4032×3024, 12.2 MP, 4:3.**

The response's Gate 1 says *"kill if not 12 MP"*, and on that sub-check **this run fails.** ⚑ **The
cause is a configuration choice I made:** "lowest frame rate among the high-res-capable formats"
selected **3840×2160@24**, a 16:9 streaming format — **and the high-resolution still inherits the
stream's aspect ratio.**

*Corrected in the probe: prefer a 4:3 high-res-capable format, then the lowest frame rate within it
— 1920×1440@30 on this device.*

### ✓ Re-run, same evening, 11.6 minutes — **fixed**

**41 captures, every one 4032×3024.** Latency p50 80 ms / p95 278 ms / max 347 ms. Ray-cast hit 40
of 41. Thermal `nominal` throughout, 30.0 fps flat, mapping `mapped` for 66% of the run, feature
points median 203. **Images 2.8–3.8 MB.**

⚑ **The stream format determines the still's aspect ratio, and that is the transferable finding.**
Choose the streaming format for the photograph you want, not for the frame rate you like.

## ⛑ Three things these runs do NOT establish, said before the good numbers harden

**1 · Photograph quality is unverified.** The probe fires on a 15-second timer regardless of motion,
so a third of these frames were taken mid-stride and are motion-blurred. *That is the timer, not the
capture path* — but it means **legibility has not been tested.** The response's own Gate 1 minutes
55–60 — the same plate in the worst light in the building, one frame each way, judged by the desk —
**is still owed and nothing here substitutes for it.**

**2 · The battery figures are approximate, and the owner caught this.** He observed 92% at the start
of the second run where the probe logged 90%. `UIDevice.batteryLevel` is coarse and
`isBatteryMonitoringEnabled` is set *inside* `run()`, so the first reads can be stale or rounded.
⚑ **The 46-minute figure (100 → 91) is the trustworthy one** — a longer window and a bigger delta.
*The 11.6-minute "0%" should not be quoted at all.*

**3 · The load is incomplete and the owner named it.** These runs had **no viewfinder drawn, no
RoomPlan, no mesh harvest, no traverse.** ⛑ **9% per 46 minutes is a floor, not the number** — the
current build's 17% per 45 may well survive once everything is on. *What the runs do establish is
narrower and still worth having: continuous tracking is not the budget-buster everyone assumed, and
is cheaper than waking it four hundred times.*

⚑ **And the viewfinder is a lever nobody has measured.** It cannot be dark while the concierge is
composing — *"we need to see what we are capturing"* — but **preview resolution and capture
resolution are independent.** A small, low-rate preview while composing and nothing between shots is
available and unquantified.

## What Gate 1 still did not test

**No RoomPlan** — deliberately excluded as a second integration; Gate 1b. **One room, not seven** —
heat and battery from rooms one through six do not reset at a door, and that is Gate 2. **A living
room, not a mechanical room** — chosen first because a failure in an easy room would have been the
cheaper kill. ⚑ *The mechanical room is now a sharp second question — does that particular room
break it? — rather than a muddled first one.*
