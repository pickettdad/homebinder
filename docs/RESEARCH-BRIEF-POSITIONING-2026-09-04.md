# Research brief: accurate per-photograph position over a 2–3 hour iPad capture session

**For external research. Self-contained — no knowledge of our codebase is assumed.**
Written 2026-09-04. All numbers are measured on the target device, not estimated.

---

## 1 · What the product does, in one paragraph

A person walks through a house with an iPad photographing equipment — furnaces, water heaters,
electrical panels, water treatment, plumbing runs. They take **high-resolution photographs** (12 MP)
of each object and of its data plate. A desk team later reads those photographs and produces a
document describing the house: what equipment is where, what condition it is in, where the shutoffs
are. **The photographs are the deliverable.** Everything else exists to make them placeable and
measurable.

A visit is **2–3 hours** and covers **5–15 rooms**. One room can take 45 minutes and produce
400+ photographs.

---

## 2 · What we need, stated as requirements rather than solutions

For each **room** (a bounded capture unit; the app calls it a *zone*):

1. **A floorplan** — walls, doors, windows, openings, with dimensions. Currently via Apple RoomPlan.
2. **A 3D mesh** — vertices and faces, for the things a floorplan misses (a half-wall peninsula, a
   counter run, the shape of a tank). Currently via ARKit scene reconstruction with LiDAR.
3. ⚑ **For each photograph: the pose of the device at the moment of capture**, and a **ray-cast
   from the lens to the first surface in front of it** (so the desk knows both *where the person
   stood* and *what they were aimed at*).

**All three must be in one coordinate frame per room**, or carry a declared transform between them.

⚑ **They do NOT need to share a frame across rooms.** The desk arranges rooms from walk order, door
counts and room shapes — not from coordinates. *Each room having its own origin is the design, not a
limitation.* **Do not spend effort on house-scale registration.**

**Accuracy target: "marker-accurate."** *"2.3 m from the panel"* must be defensible. *"2,438 mm"*
must not. **Metres of error are useless; 10–20 cm is fine.**

⚑ **And it must hold for the whole session. A pose at minute 150 must be as usable as a pose at
minute 2.** *An approach whose accuracy is a function of elapsed time has not solved this*, however
good its first ten minutes are. **This is the requirement, not an aspiration**: downstream, a
machine places every capture on its room's plan with **no human in the loop**, so there is nothing
downstream that can absorb a bad pose.

### What the receiving process actually does with it

*Quoted from the desk process specification, so you can see what the number is for.*

- *"Position and the raycast surface put every capture on its plan."*
- *"Once the container says which, the mesh is the better source of where. A raycast gives a point on
  a surface; a mesh gives the surface … it is the only instrument that gives clearance between two
  things rather than the location of each."*
- ⚑ **Two named gates on using the mesh for position:** *"The mesh has to carry its geometry rather
  than a count of it"* — **now met** — *"and the mesh, the plan and the poses have to be in a
  declared common frame."* **That second gate is the open one and it is per-room.**
- ⚑ **The machine places. A person confirms what the service *says*, never where things *are*.**
  Placement runs in a machine stage **before** any human sees it, and the confirmation stage exists
  for the desk's proposals *about the house* — a missed window, a proposed identity — **not to
  repair the app's measurements.** *If every position needs confirming, the machine cannot place
  anything and the stage collapses.*
- ⛑ **A pose must therefore be right at capture. Not provisional, not refined later, not
  reconciled.** Desk-side correction of *positions* is not a fallback that exists — treating it as
  one would move work onto the desk, which is the opposite of the goal.
- ⛑ **And the degradation signal in that specification is a SYMPTOM, not a permission.** *"A pose
  taken late in a zone is not as good as one taken early"* is documented **because our positioning
  fails**, and the specification itself was written against the very export this brief exists to
  replace. ⚑ **A successful answer makes that sentence unnecessary.** Do not design to it.

### The hard part

⛑ **The photographs and the tracking want the same camera, and on iOS they cannot share it.**
ARKit's world tracking and a still-photography capture session cannot both hold the rear camera.
Every photograph is therefore a handover, or the photograph comes out of ARKit's own stream.

---

## 3 · The hardware and OS

- **iPad Pro 11-inch, 3rd generation** (`iPad13,4`), **iPadOS 26.6**. LiDAR present.
- Rear lenses physically present: wide-angle (`builtInWideAngleCamera`), ultra-wide, dual-wide.
- ⚑ **ARKit world tracking is offered only wide-angle formats on this device** — 13 formats
  enumerated, **zero ultra-wide, zero dual-wide** — while the physical ultra-wide exists. So an
  ultra-wide frame cannot be natively positioned.
- Photographs are 4032×3024, ~2.5–3.6 MB each. A 5-room visit produced **548 media files, 1.4 GB**.

---

## 4 · What we built, and exactly what it costs

**Current architecture:** one ARKit session per room, kept **paused** most of the time. The
photography session owns the camera. At each shutter press:

    stop photo session → ARKit run() → wait for tracking .normal → read pose + ray-cast
    → ARKit pause() → restart photo session → take the photograph

### Measured costs of that handover

| | |
|---|---|
| whole cycle at a capture | **~6.3 s** |
| of which ARKit reaching `.normal` after resume | **4.9 s** |
| the pose read itself | **0.02 s** |
| first tracking acquisition of a session (cold) | **0.85–0.97 s** |
| every later resume | **4.05–5.00 s** |
| battery, 45-minute room | **17%** |

### ⚑ And the measurement that explains everything

Instrumented on a controlled 14-minute test, standing at one fixed mark:

| | |
|---|---|
| `ARFrame.worldMappingStatus` | **`notAvailable`, then `limited` — never `extending`, never `mapped`** |
| `rawFeaturePoints` count at the moment of each pose | **0, then 2–9** |
| time awake before the pose is read (`sinceInitSec`) | **~1.4 s** |
| time asleep between poses | **20–116 s** |
| **duty cycle** | **ARKit awake ~2% of the session** |
| pose drift measured across a 116-second sleep | **0.00024 m** |

⛑ **Diagnosis: ARKit never builds a world map.** It is awake ~1.4 s at a time, finds a handful of
feature points, is granted `.normal` optimistically, and is put back to sleep. With no map there is
**no loop closure and no global correction** — every pose is dead-reckoned from the previous one.

**The consequences, measured:**

- **Standing still, it is excellent**: 10 poses over 5.8 minutes agreed to **5 mm**.
- **Walking, error accumulates**: over a 42-minute room, poses walked **3 m below the floor** in
  **17 discrete steps**, alternating up and down. Large steps carried a mean horizontal movement of
  **0.651 m** against **0.233 m** for small ones — *error tracks travel, not time.*
- **Early excursions recover, later ones do not.** At 14 minutes a 0.66 m excursion returned within
  80 seconds. By 30 minutes they only partly recover.
- **Two RoomPlan floorplans of one room, 10 minutes apart, standing still**: floor moved **16 cm**,
  ceiling **31 cm**, and **RoomPlan's own measurement of the room height changed by 150 mm**
  (2.400 → 2.550). The room did not change.

---

## 5 · What we have ruled out, with the measurement that ruled it out

⛑ **Do not spend effort re-proposing these. Each was believed, tested, and killed.**

| hypothesis | how it died |
|---|---|
| **The pause/resume rebuilds the world or moves the origin** | Origin moved **0.00003 m** across a pause/resume; the mesh came back byte-identical. Pose drift across a 116-second sleep: **0.24 mm** |
| **A configuration or video-format change on resume resets tracking** | Five resumes with a freshly built configuration each time: pose jumps **0.02–0.21 mm**, one run at **0.0000 m** on every transition |
| **The room is visually degenerate (specular metal, repeating pipes)** | The room is feature-rich — exposed joists, shelving, boxes, distinct machinery. And feature counts are **0–9 while standing at a fixed mark**, which no room explains |
| **The subject is degenerate (large smooth surfaces fill the frame)** | Plausible and *not* what the data shows: feature counts are near-zero **regardless of subject**, including at the fixed mark |
| **`trackingState` would warn us** | ⚑ It reports `normal` on **100%** of poses, including one with **zero feature points**. Our own code refuses non-normal frames, so the field is a restatement of the filter |
| **Longer idle time causes drift** | Idle gaps of 510 s, 163 s and 112 s produced +0.18, −0.18 and 0.00 m. **No correlation** |

---

## 6 · What we know about the constraint space

**Facts, not preferences. Some of these may be the wrong constraints — say so if you think they are.**

- ⚑ **We measured that ARKit *can* be given the camera controls a close-up plate photograph needs.**
  With ARKit holding the lens, `configurableCaptureDeviceForPrimaryCamera` allows near-focus
  restriction, focus point, spot metering, continuous auto-exposure and torch — **all six take and
  still hold 2.5 s later**, and the torch reaches full state in **6 ms**.
- ⛑ **What we have NOT tested** is whether `captureHighResolutionFrame(using:)` — taking the
  photograph from ARKit's own session — produces a photograph of acceptable quality *and* honours
  those device settings. **This is the obvious alternative architecture and it is unmeasured.**
- **RoomPlan runs on the same ARKit session** we already own, so floorplan and mesh already share
  the tracking frame. Only the photographs are outside it.
- **A format change on a running ARKit session costs ~700 ms to the new resolution and ~1.5 s to
  `.normal`, and does not scale with resolution** (1452 ms for 720p, 1452 ms for 4K).
- **Thermal and battery are real limits**, but we do not yet know the ceiling: 17% for 45 minutes was
  measured with ARKit awake ~2% of the time. **Continuous ARKit for 2–3 hours is unmeasured.**
- **The iPad runs continuously for the whole visit** — it is not pocketed or backgrounded between
  rooms. **An external battery pack is available if it helps**; note that charging adds heat, so it
  answers battery and not thermal.
- ⚑ **One lever we hold and have not used: the viewfinder does not have to be drawn.** The camera
  preview and the screen are a real share of GPU and power, and **they are separable from tracking**
  — ARKit needs camera frames, not a rendered preview. *A dark or minimal screen between deliberate
  captures, with tracking still running, is available to any proposal that wants it.* We have not
  measured what it saves.

---

## 7 · The questions we want answered

**Ordered by what would change the build. We are not asking you to pick from a menu — if the right
answer is a fourth thing, say so.**

1. ⚑ **Is there an architecture that gives a per-photograph pose accurate to ~10–20 cm across 2–3
   hours, on this hardware, without the photographs degrading?** State what it costs in battery,
   thermal, and concierge time.
2. **If ARKit must hold the camera continuously to stay mapped — what is the real thermal and power
   envelope on an A12Z/M1-class iPad over 2–3 hours, and what mitigations exist?** (Lower frame
   rate? Lower video format? Dropping scene reconstruction between rooms? Thermal-state-driven
   degradation?)
3. **Can `ARWorldMap` serialisation help?** We save one and have never loaded it. Does
   `initialWorldMap` + a genuine relocalisation give a resumed session a real map to correct
   against, or is relocalisation into a sparse map unreliable enough not to bother?
4. **Would a continuously-mapping session make `ARAnchor` worth it?** Anchor transforms update on
   loop closure — but ours is asleep 98% of the time so nothing ever closes a loop. ⛑ *Note this is
   asked as a way to be right **by** capture-time-plus-the-session, not as a way to defer the
   problem:* the export is produced at the end of the visit, so a correction that lands before the
   export is fine. **A correction that requires a person is not.**
5. **Is per-room the right unit?** We reset tracking per room today. Would one continuous session
   across a whole house be better (more map, more loop closure) or worse (more drift, more thermal)?
6. **What should we be measuring that we are not?** We now record world-mapping status, feature
   count, re-initialisation count, time-since-init, and pose jump across sleep. *What else would a
   person debugging this want?*
7. **Is there a non-ARKit or hybrid answer worth considering?** LiDAR depth directly, visual-inertial
   odometry we run ourselves, fiducial markers placed by the concierge, photogrammetry from the
   photographs at the desk, or something we have not thought of.

---

## 8 · What we are NOT asking for, and what would waste your time

- ⛑ **Do not propose "wait longer before reading the pose."** A 5-second wait before every
  photograph is not acceptable — a room is 400 photographs.
- **Do not assume we can change the photographs.** 12 MP stills are the product. If an approach
  costs photograph quality, say so explicitly and let us judge it.
- ⚑ **On what the concierge can be asked to do — do not guess the budget, propose one.** The owner's
  position: *open to reasonable asks that will achieve the goal.* **Propose the act and its cost in
  seconds and attention, and it will be judged on whether it works** — a perimeter walk, a still
  moment, a touched reference point, a deliberate re-anchor between rooms. What is not affordable is
  a per-photograph ritual: **a room is 400 photographs.**
- **Do not optimise for one room.** The failure appears at 20–40 minutes and the target is 2–3 hours.
  ⚑ *An approach that is excellent for five minutes and unmeasured at two hours is the thing we
  already have.*
- **We are not committed to ARKit.** It is what we built on, not a requirement.

---

## 8b · Appendix: the controlled test, verbatim

*Ten poses, one fixed mark, 5.8 minutes, iPad stationary and rested. This is the whole of the
decisive run — nothing selected, nothing omitted.*

    min      y       dy     mapping        featurePoints  resumeJumpM  sleepSec  sinceInit
    0.00   +0.013  +0.000   notAvailable        0           0.00024      116.4      1.41
    0.59   +0.016  +0.002   limited             7           0.00758       35.2      ~1.4
    1.06   +0.013  -0.002   limited             2           0.00247       28.4      ~1.4
    1.39   +0.016  +0.002   limited             4           0.00547       19.8      ~1.4
    1.73   +0.014  -0.002   limited             9           0.00160       20.6      ~1.4
    2.21   +0.017  +0.003   limited             2           0.01213       28.5      ~1.4
    2.54   +0.014  -0.002   limited             4           0.00239       19.8      ~1.4
    2.99   +0.013  -0.001   limited             5           0.00304       27.2      ~1.4
    3.48   +0.012  -0.002   limited             4           0.00190       29.5      ~1.4
    5.80   +0.016  +0.004   limited             5           0.00218       26.1      ~1.4

⚑ **Read the `mapping` and `featurePoints` columns together.** Never past `limited`; never more than
nine tracked points; and `trackingState` reported `normal` on all ten, including the row with zero.

*The 42-minute walk's 77-pose table is deliberately not reproduced.* It describes one room on one
day, and its shape — 17 discrete steps, error tracking travel rather than time — is stated in §4.
**We would rather you reason from the mechanism than fit a curve to that room.**

## 9 · Summary in five lines

**We can get a pose per photograph today, cheaply, and it is accurate standing still and useless
after half an hour of walking — because the tracking system is only awake 2% of the time and never
builds a map. Waking it more costs battery, thermal and 5 seconds a shot. We need per-photograph
position good to ~15 cm, holding for a 2–3 hour session, on an iPad Pro with LiDAR, alongside a
RoomPlan floorplan and a scene mesh, without degrading 12 MP photographs — and it has to be right
when it is written, because a machine places every capture with no human in the loop. Tell us how —
including if the answer is that our architecture is wrong.**

⛑ **One framing that matters.** Everything downstream of this is automated up to a single human
confirmation, and that confirmation is for what the service *concludes about a house*, not for
repairing measurements. **Every metre of error here becomes minutes of human work per room, in a
process whose whole point is not to need them.** *Aim at not needing the desk to think about
position at all.*
