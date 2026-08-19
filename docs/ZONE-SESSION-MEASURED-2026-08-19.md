# The zone-long session, measured on the device — and an argument with the design
2026-08-19. Six probe runs on `iPad13,4`, iPadOS 26.5, via `HSArProbe` (dev-only, read-only,
launch-argument `--hs-ar-probe`). ⚑ **Nothing here is a capture path.** The probe is the instrument;
every number below came off the device rather than out of a document.

*The first run read `insufficientFeatures` throughout — the iPad was face-down on a desk. The owner
flipped it over and every subsequent run tracked. **Two findings below were false on the first pass
and were corrected by re-running with a control**, and both corrections are recorded rather than
quietly replaced.*

## 1 · What the device says

| question | answer |
|---|---|
| ARKit's own shutter | **1/61 s, constant** — held across ISO 93 / 385 / 402 / 1744, a ~19× light range |
| Custom exposure inside the session | permitted, **tracking stays `normal`**, and it changes nothing — ARKit is already there |
| Full-resolution still inside the session | **4032×3024 (12.2 MP) in 61–68 ms** |
| Custom `AVCapturePhotoSettings` | **accepted** (`defaultPhotoSettings` unmodified succeeds) |
| `AVCapturePhotoBracketSettings` | ⚑ **refused** — 0 frames, both formats, with passing controls |
| A bracket assembled by hand | ⚑ **works** — 3 × 12 MP at ISO **193 / 387 / 774**, one stop apart |
| Torch inside the session | ⚑ **lights** — `isTorchActive=true`, level 1.0, tracking stays `normal` |
| Mesh, 6 s, device barely moving | **11 anchors, 39,219 faces** |
| Raycast from the camera pose into the mesh | **hits**, 1.54 m and 4.09 m |
| Step-out to 0.5× and back, input pre-built | ⚑ **86–144 ms of overhead**, mesh byte-identical, **no relocalisation** |
| …with the input built while ARKit holds the camera | **9,008 ms** — avoidable, see §2 |
| Lens ARKit uses | `builtInWideAngleCamera` — **the same glass the plate path uses today** |

**Two corrections, both mine.** (a) A first bracket run showed a hand-rolled plain `AVCapturePhotoSettings`
failing too, which would have proved nothing about brackets; the documented control is
`defaultPhotoSettings` handed straight back, and it **succeeds** — so the refusal is the bracket and
nothing else. (b) The torch first read `isTorchActive=false`, but that was measured *after* another
probe step had forced a custom exposure. Tested first, before anything touches the device, **it
lights.** The owner independently saw it blink for about a second, which is better evidence than the
device reporting on itself.

## 2 · ⚑ The nine seconds is not a cost, it is a mistake waiting to be made

`AVCaptureDeviceInput(device:)` for the ultra-wide takes **9,008 ms** when it is created while ARKit
holds the camera — and **7 ms** when it is created at launch before the session starts. Same object,
same device, three orders of magnitude apart.

Build it once at launch and keep it. A step-out is then:

    pause 0 ms · startRunning 2–23 ms · [the shot] · stopRunning · session.run → normal 0 ms
    total overhead: 86–144 ms, mesh 11/38393 → 11/38393, no relocalisation seen

**A naive implementation would have measured nine seconds, concluded that stepping out is
unaffordable, and designed around a number that was an artifact of when an object was allocated.**

## 3 · The argument — field of view is not the constraint

The proposal, the two owner shapes, and a fourth.

### 3a · The owner's first insight is the one that decides it

**The mesh has no field of view.** LiDAR accumulates into a persistent model as the device moves;
tilt up and ARKit integrates. So **geometry never needed the ultra-wide** — extent, clearance, run
length, which panel a circuit leaves from, are all mesh questions and the mesh is built by walking,
not by framing.

What the ultra-wide buys is *one photograph containing the whole object*. That is an **appearance**
need, not a measurement need. And for appearance the ultra-wide is **worse evidence**: 107.3° against
64.7° is 2.15× the linear width, so **~4.6× fewer pixels on any given square inch of the object.**
Four tilted 1× frames beat one 0.5× frame on every axis except *is it a single picture*.

⚑ **So the thing that actually requires width is a human looking at a binder page.** That is
presentation, and presentation is the one thing that can be deferred.

### 3b · Verdicts on the three shapes

**Stop-snap-relocalise** — pause per wide shot, snap, resume. *Cheaper than anyone thought:* 86 ms,
mesh intact, no relocalisation observed. The word "relocalise" was carrying fear that the
measurement does not support. **But it is still a shot with no pose of its own**, and its cost is
paid in the tight rooms where it is needed most.

**Freeze and shotgun** — mesh, lock, shut ARKit down, tour on the ultra-wide, align afterwards.
⚑ **Argue against this one.** It makes image-to-geometry matching *the mechanism*, and that is the
family that has failed eight times in this project — now with a harder instance (2D photograph to 3D
mesh, across a lens change, with no guaranteed overlap). It also splits the visit into two passes.
"Deferred, not offline, full compute" makes it *possible*; it does not make it *reliable*, and the
eight failures were not failures of compute. **Keep it as the fallback it should always have been.**

**Everything at 1×, step out only for the establishing frame** — much the best of the three, and the
reasoning behind it is right: a nameplate wants 1× (less edge distortion, 4.6× the pixels), and
concerns, angles and details do not want 107° either. Two objections. First, if that shot inherits
its position from the container it **has no pose of its own**, so it cannot be measured from or
projected — its only job is presentation. Second, if presentation is its only job, ⚑ **why capture
it at all?**

### 3c · The fourth shape

**Never leave the session. Buy coverage by tilting, and render the establishing view afterwards.**

1. **Everything at 1×, inside one zone-long session, positioned.** Plates, concerns, angles, details,
   the traverse. The device confirms the pieces: 12 MP stills at 65 ms, a hand-rolled bracket, the
   torch, the same lens as today, and a shutter ARKit already holds at 1/61 s.
2. ⚑ **The app asks for coverage instead of framing.** *"You have two-thirds of this — tilt up."*
   Every ingredient is measured and present: the mesh accumulates 39k faces in six seconds, each
   frame's frustum follows from `camera.transform` plus intrinsics, and a raycast lands on the
   surface in front of the lens. Marking mesh faces as seen by the union of frame frusta is a
   geometric computation.
3. **The establishing view is rendered at the desk**, by projecting posed frames onto the mesh and
   placing a virtual camera anywhere — including where the concierge could not stand. Correct
   geometry, more resolution than the 0.5× shot, arbitrary framing, **zero capture-time cost.**
4. **The ultra-wide stays as a declared-degraded escape hatch** — 86 ms, recorded as unposed. Cheap
   enough to keep, and now known to be cheap.

⚑ **And here is why this matters beyond the lens question. Coverage stops being a correlation between
two photographs and becomes a query against geometry.** That is precisely the family that failed
eight times, replaced by the one kind of measure that structurally cannot fail that way — the same
argument that makes `textureScore` exempt, only stronger: texture has no partner to be fooled about,
and a mesh-coverage query has no photographic comparison in it at all.

**It also answers the question the pinned traverse could never answer.** *Did I miss a bit* becomes
*which faces of this surface has no frame seen* — in the room, while it can still be re-walked.

## 4 · What it costs, honestly

- **The built-in bracket is gone**; the hand-rolled one is three shutter actions tens of milliseconds
  apart rather than one. Fine for a nameplate on a tank. Nothing in a plant room moves.
- **Thermal is the large unknown** and it is now the *only* one. A zone-long session with mesh, across
  a three-hour visit, against the 9.2%/hour baseline. Measured during the build, per the ruling.
- ⚑ **An interruption kills the coordinate space.** A phone call, a lock screen, a backgrounded app —
  and the zone's origin is gone. Apple's recovery is `ARWorldMap` relocalisation with *"return to the
  most recently scanned room"*. **This is a field failure mode with an annoying recovery and it should
  be designed for rather than discovered.** It is the strongest argument for saving a world map per
  zone as a matter of course rather than as an error path.
- **`captureHighResolutionFrame(using:)` and `defaultPhotoSettings` are iOS 26.0+.** One release old.

## 5 · Does the scan's own requirement change?

**Yes, in one way, and it is a requirement that gets *weaker* rather than stronger.**

Today a zone scan is a floorplan: it has to be complete enough to draw a room. As the coordinate
origin it does not have to be complete at all — **it has to be started before anything is
photographed, and never interrupted.** Coverage of the far corner matters for the drawing; it does
not matter for placing an object the concierge is standing in front of, because the mesh under that
object accumulates as they photograph it.

⚑ **So the requirement changes from a coverage target to an ordering rule**, and the ordering rule is
the one that must be enforced: *the session starts when the zone is entered, and every capture in
that zone happens inside it.* A photograph taken before the session began is unpositioned forever,
and nothing downstream can tell.
