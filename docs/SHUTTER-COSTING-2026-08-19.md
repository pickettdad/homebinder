# The traverse shutter — costed from banked frames, no build
2026-08-19. Owner ruling: *unlock the shutter, keep ISO, white balance and focus locked.* Cost the
cheaper version first — set the lock from a walking-speed assumption rather than a standing one,
1/60 or faster, ISO allowed to float within a band — and **report what the rooms actually allow
before choosing between the two**.

⚑ **Nothing was built and nothing was walked for this.** Every figure below is read from EXIF on
frames already banked from five walks, because the exposure lock means each frame carries the
setting the auto-exposure had settled on when its leg began.

## 1 · What the rooms actually allow

Every traverse frame ever captured, across all five walks, is **1/15 s at f/2.4** on the ultra-wide.
Shutter and aperture never move, so **ISO alone is a direct measurement of how dark each room is.**

| walk | room and condition | ISO at 1/15 s | relative light |
|---|---|---|---|
| `B_lightson_torchon` 02:23:55Z | mechanical, lights on, **torch on** | **400** | 1.25× |
| this walk 11:49:45Z | living room · gym · office, lights on | **500** | 1.00× |
| `A_lightson_torchoff` 02:22:21Z | mechanical, lights on, torch off | **640** | 0.78× |
| `C_dark_torchon` 02:26:06Z | mechanical, **dark**, torch on | **2000** | 0.25× |

What each shutter would cost, holding brightness constant:

| condition | 1/15 s (today) | 1/30 s | 1/60 s |
|---|---|---|---|
| mechanical, lights on + torch | 400 | 800 | **1600** |
| living room · gym · office | 500 | 1000 | **2000** |
| mechanical, lights on | 640 | 1280 | **2560** |
| mechanical, dark + torch | 2000 | 4000 | **8000** |

**The highest ISO ever observed on this device is 2000** (walk C, and those frames are usable). So
1/60 s is *demonstrably affordable* in the living room and in the lit mechanical room with the torch
on; 1/60 s in the lit mechanical room without the torch needs a third more than anything yet seen;
and the dark room at 1/60 s is four times beyond it.

**1/30 s is affordable everywhere except the dark room.**

## 2 · The torch buys almost nothing here, and that is measured rather than assumed

Mechanical room, lights on: **640 → 400** with the torch. That is **0.68 of a stop.**

On the *normal* lens at plate distance the same torch was worth about 3.5 stops (1/15 s ISO 1600 →
1/30 s ISO 250). ⚑ The difference is geometry, not tuning: the torch lights a narrow cone and the
ultra-wide sees 107°, so most of the frame is never lit. **The torch cannot substitute for the two
stops** — it contributes about a third of one of them.

## 3 · The shutter is already at its ceiling, so the two stops must come entirely from ISO

1/15 s appears in **every traverse frame of every walk** — five walks, 200+ frames, four different
light levels. ISO ranges 400–2000 across them while the shutter never moves once. The auto-exposure
is holding the shutter at its longest and doing all its work with gain.

**There is no shutter slack to reclaim.** Asking for 1/60 s costs a full two stops of ISO with
nothing given back.

## 4 · ⚑ The two options collapse into one, because AVFoundation will not separate them

`AVCaptureDevice.exposureMode` governs duration **and** ISO jointly. There is no mode that locks ISO
while freeing the shutter:

| mode | shutter | ISO |
|---|---|---|
| `.locked` — what `startTraverse` does today | frozen at whatever auto chose | frozen at whatever auto chose |
| `.custom` via `setExposureModeCustom(duration:iso:)` | **set explicitly** | **set explicitly** |
| `.continuousAutoExposure` + `activeMaxExposureDuration` | capped, still varies | floats continuously |

So the ruling *as stated* — unlock the shutter, keep ISO locked — is delivered by
`setExposureModeCustom(duration: 1/60, iso: chosen)`, **which is also the cheaper version**: one API
call replacing one API call, at the same point in `startTraverse`, with white balance and focus
untouched. Frames stay exactly as colour-matched as they are today, because both terms remain
frozen for the leg. The "band" the ruling describes is a band the *chosen* ISO is picked from, not a
band it drifts through during the walk.

The third row is the expensive one and it costs the thing the lock exists for: ISO moving during a
leg means frames no longer match, which is precisely the failure the design note warns about — *a
concierge looking at the result cannot tell that from a lighting change in the room.*

## 5 · The lock is honoured, which is worth stating because it very nearly would not have been

`AVCapturePhotoOutput` is documented to **override a locked exposure and fuse several frames** when
`photoQualityPrioritization` is `.balanced` or `.quality` and the scene is dark. Fusing several
frames of a moving camera is itself a blur source, and it would have been invisible.

The traverse already sets `.speed` (`HSCameraPlugin.swift` ~L2225, with the reason recorded), and
EXIF confirms it: one exposure, unchanged for 70 frames. **The plate path uses `.quality` and is
right to** — but the two must never be conflated, and the traverse's choice is what makes §1's
figures readable at all.

## 6 · What cannot be costed without a walk, and it is one number

**Whether the ultra-wide delivers a *usable* frame at ISO 1600–2560.** The plugin reports
`isoMax: 1824` (wide) / `1728` (normal) — but walk C's EXIF reads ISO 2000, so the reported ceiling
and the EXIF figure are on different scales and the reported one cannot carry this arithmetic. Noise
at the top of the range is not predictable from below it either.

**The one walk that settles it:** mechanical room, lights on, `setExposureModeCustom` at 1/60 s,
carrying the iPad at the side exactly as before. Two questions answered at once — whether the frames
are noisy, and, for the first time, **what every traverse measure does when the carry is sharp.**

## 7 · Why that second question is the larger one

Every measure in the traverse was fitted against input that was **71% smear**: 20 of 70 frames on a
wall (mean texture 14.5), 50 in the carry (mean 6.4), 15 below the `traverseMinimumTexture = 5.0`
floor outright.

`traverseMinimumTexture`, `traverseMinimumOverlap`, `stillThreshold`, `flowStill`, `crossCheck`,
`implausibleShift` — all of them, and `placeDistance`'s apparent success at the segment boundaries
(see [TRAVERSE-PLACEDISTANCE-FINDINGS-2026-08-19.md](TRAVERSE-PLACEDISTANCE-FINDINGS-2026-08-19.md)
§0a) — were tuned or judged on frames a desk could not use. **Sharp frames have never been put in
front of any of them.** Until one walk exists where the carry is as sharp as the sweep, no constant
in the traverse should be trusted in either direction.
