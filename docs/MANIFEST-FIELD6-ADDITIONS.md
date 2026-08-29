# What Field 6 adds to the manifest
2026-08-23. **Additive only — `manifestSchemaVersion` stays 3.**
Example to build against: [`fixtures/manifest-position-example.json`](fixtures/manifest-position-example.json).

⚑ **No version bump, and that is the ruling rather than an oversight.** Every field below is new;
none changes what an existing field means. Under the version policy ratified 2026-08-15 additions
are the emitting side's call alone and a receiver ignores what it does not consume — so bumping to 4
would force the binder to carry two readers to gain nothing. **A version number is a promise that
something old broke.** Nothing old broke.

## 1 · `media[].position` — where a frame was taken

Three states, and the third is the one worth building for.

| | meaning |
|---|---|
| `{ positioned: true, … }` | measured, with `tracking`, a full 4×4 `transform`, and `surface` when a ray-cast hit |
| `{ positioned: false, why }` | ⚑ **a refusal** — the app could take a position here and did not |
| field absent, `owner.kind: "pin"` | this frame inherits from its container, which is the normal case |
| field absent, `frame.role` is not `primary` | a **sibling** — the pose is on the `primary` frame of the same `frame.captureId` |
| field absent, `owner.kind: "zone"`, no `frame` | ⛑ **nobody knows** — there is no container to inherit from |

⛑ **The distinction between the last three is the whole design.** *At least one frame per container
carries a position; everything else inherits it.* So an absent `position` on nine frames of a
ten-frame container is **completeness, not a gap** — the desk reads the container, never the frame.
A `positioned: false` is different: it says the machinery was present and declined, with the reason,
and that is the only one worth investigating.

**Read a container as positioned if ANY of its frames is.** A container with ten frames and no
positioned one is a container the desk cannot place, and it is indistinguishable from a complete one
unless this rule is applied.

### ⚑ Absent means two different things, and `owner` is what separates them

**Read `owner` before reading the absence.** *A capture owned by a **pin** has a container, so absence
is inheritance. A capture owned by a **zone** has no container, so absence is genuinely unknown —
there is no anchor anywhere for it to inherit from.* **Zone-owned captures with no position today:
traverse sibling frames, the floorplan and the mesh.**

⛑ *Stated because an absence that means both "fine" and "unplaceable" is a signal nobody can read —
and this manifest very nearly shipped one.* The disambiguator was already present: `owner` is on
every entry (`MediaFileEntryV3.owner`). It just was not named as load-bearing.

**And `frame.role` is the second disambiguator, for the same reason.** *A sibling — a bracket
exposure, the unlit companion — is absent because the pose belongs to its primary, which the shared
`frame.captureId` names.* **Read `role` and `owner` before reading the absence, in that order.**

### ⚑ The one sibling that refuses instead

**The 120° frame of a sibling pair carries `{positioned: false, why: "wide lens is not offered to
world tracking…"}`.** *The ultra-wide is not offered to `ARWorldTrackingConfiguration` on this iPad
— measured, `HSLensProbe` 2026-08-24 — while the physical lens exists.* ⛑ **That is a hardware fact
no reader can derive from an absence**, and a room shot files to the zone, where absence already
means *nobody knows*. Without the refusal the record would say *nobody knows* about the one frame
whose reason is known exactly.

**Only that frame gets it.** Stamping a refusal on every bracket exposure would make
`positioned: false` the majority case and drown the refusals worth reading — *a signal that speaks
on the majority case is one nobody reads on the minority case that matters.*

### ⛑ And on a room shot the positioned frame is the 120° one — `position.projection` says so

**The room shot frames wide** (owner ruling 2026-08-16, re-confirmed in the field 2026-08-28), so
the **primary is the 120° frame** and the 1× frame is its sibling. *Verified on device:
`lenses: wide,normal`, one press, 328 ms.* ⚑ **So `position` on a `intent: "room-shot"` capture is
stamped on a wide-angle photograph, and the design's earlier premise — *the 1× frame carries the
measured position* — is inverted on this door.**

**The pose is still honest.** It is **where the concierge stood**, and no lens changes that. `x/y/z`
and the translation column of `transform` mean exactly what they mean on any other frame.

⛑ **What does NOT carry across is the camera model.** ARKit's `transform` describes its own 1×
wide-angle camera — the ultra-wide is not offered to world tracking on this device — so **the 120°
image cannot be projected through that matrix.** *Use the pose; do not use it as a camera.* The 1×
sibling of the same `frame.captureId` is the frame whose geometry the matrix does describe.

### ⚑ `position.projection` — required on every positioned frame

**Ruled 2026-08-28.** *A rule that lives only in a document is a rule the reader has to already
know* — and left implicit, a desk pass projects a 120° image through a 1× matrix and **the error
looks like bad measurement rather than a wrong assumption.** So it is a field.

```json
"projection": { "projectable": true }
```
```json
"projection": {
  "projectable": false,
  "why": "taken through the wide lens; transform describes ARKit's normal camera, …",
  "projectableFrame": { "captureId": "2026-08-23T17:38:10Z", "lens": "normal" }
}
```

| | |
|---|---|
| `projectable: true` | `transform` describes the camera that took this image. Ordinary case |
| `projectable: false` | **use the pose, do not use it as a camera.** `why` names the lens; `projectableFrame` names the frame in the **same capture** whose geometry the matrix does describe |
| `projectableFrame: null` | ⛑ **there is no such frame** — the pair was refused. *A real pose and nothing to project at all, which is a different sentence from "look next door"* |

⚑ **Required, not optional**, and that is the point rather than a style choice. An optional field
can be forgotten by a producer *and* skipped by a consumer; a required one is answered every time a
pose is stamped. *The field's own compiler caught the single emission site the moment the field was
added, which is the strongest form of "a reader trips over it".*

**Named by `captureId` + `lens` rather than by mediaId**, deliberately: a sibling's mediaId is
minted **after** the pose is stamped, so carrying it here would couple the position to the order
media rows are written in — a coupling that breaks silently when either moves. Both fields are on
every entry already, so the desk resolves it with one filter.

*Under the version policy this is an addition and stays `manifestSchemaVersion` 3.*
`tests/engine/fixtureTripwire.test.ts` asserts every positioned frame answers the question and that
a non-projectable one points somewhere or says `null`.

**`position.surface` is not `position.x/y/z`.** The pose is **where the concierge stood**; `surface`
is the ray-cast hit **in front of the lens**, with its distance. For a nameplate shot the two are
0.3–1 m apart, which is the difference between placing the water heater and placing the person
photographing it.

## 2 · Two new `intent` values — `floorplan` and `mesh`

Both are ordinary captures: real files, real hashes, listed in `media[]` like any photograph, with
`mime: "application/json"`. ⚑ **The intent is what makes them findable** — without it a room's
geometry arrives as an unlabelled blob among the pictures.

⚑ **And they carry `kind: "geometry"`, added 2026-08-28** (Capture-Kind Contract Note v1.1 §2). *Until
that day `kindOf` derived kind from mime with no final arm, so both filed as **`kind: "voice"`** and
were counted in `totals.voiceNotes`.* **They are counted in `totals.geometry` now, and an unrecognised
mime yields `kind: "unknown"` and `totals.unknown` — which should be zero on every export.**

`pan` is unchanged and stays. *Pan* was retired as a **word**; ids are never renamed, and the native
traverse still files under it.

## 3 · The two payload shapes

Contents of those JSON files. Both in metres, ARKit's right-handed frame — **+X right, +Y up, +Z
toward the viewer**, so a plan view drawn from above has +Z running *down* the page. Getting that
backwards mirrors the room and every length still checks out, which is how it survived a field test.

**Floorplan** — `walls`, `doors`, `windows`, `openings`, each with `width`, `height`, a column-major
4×4 `transform` (`index = column * 4 + row`) and **RoomPlan's own `confidence`**. A surface's local
X axis runs along it, so its ends are the centre ± half its width along that axis.

⛑ **`roomPlanObjects` is RoomPlan's own taxonomy and is NOT an inventory.** It knows sofas, tables
and refrigerators; it has no water heater, no softener, no pressure tank. Treating it as an object
list under-counts precisely the rooms this service exists for. Context only.

**Mesh** — `anchors`, `faces`, and `pieces[]` with per-piece vertex and face counts and transforms.
⚑ `walkedExtent` is the extent of **what was walked**, never the extent of the room: *a mesh hole
reads unknown, never nothing there.*

⛑ **Meshes do NOT accumulate across captures, and the binder must not assume a merged mesh** (owner
ruling, closed 2026-08-27). *Each `finishMesh` files what that walk reconstructed and the next one
starts over.* **What they DO share is a coordinate space** — every mode in a zone runs on one
`ARSession` with no `.resetTracking`, so two meshes of the same zone, and every `position` in it, are
in the same frame and can be overlaid without registration. **Two meshes of one room are two
observations of one space, not one mesh in two files** — the difference matters when counting faces
or judging coverage, because summing them double-counts everything walked twice.

## 4 · Accuracy, stated so nobody has to discover it

**Marker-accurate.** Indoor tracking drifts around a metre over a walk, and RoomPlan's opposite walls
in one bedroom differed by a few inches. ⚑ ***2.3 m from the panel* is defensible; *2,438 mm* is
not.** The field app rounds derived lengths to the inch for that reason and **deliberately does not
square rooms up** — averaging opposite walls would make the drawing look more trustworthy while
destroying the one signal that says how much to trust it.

## 5 · What the plan cannot give

⛑ Said here rather than discovered when somebody asks for a number nobody collected.

- ⚑ **Half walls, islands, peninsulas and counter runs.** Observed in the field 2026-08-23: a
  kitchen's half-wall peninsula — the one the sink is set into, and the thing that closes the room —
  is **absent from the plan entirely**. RoomPlan models full-height walls; a partition that stops at
  counter height is not a wall to it and frequently not anything to it. ⛑ **So `walls` is not "every
  vertical surface", and a plan that looks complete can be missing the feature a kitchen is defined
  by.** The mesh sees it, because geometry needs no category. ⛑ *An earlier cut of this file said
  fitted rooms therefore "get a mesh recommendation" — **withdrawn**: the recommendation helper exists
  and no screen calls it, so the app advises nobody. Whether a room gets a mesh is the concierge's
  decision at the door, and that is the honest description of today.*
- **Flooring type** — not in RoomPlan's output at all.
- **Registers and vents** — likewise.
- **Floor area** — deliberately **not** derived from the perimeter. A rectangle assumption is wrong in
  every L-shaped room, and the mesh is its honest home.

The field app returns these as `null` rather than omitting them: **an absent key reads as *nobody
computed it*, and `null` reads as *the plan does not carry this*.**

## 6 · ⚑ One anomaly, recorded and deliberately not chased

**`cameraYielded {"running": true}`** appears in the zone log. *The handover reads back the
`AVCaptureSession`'s own `isRunning` immediately after `stopRunning()`, on the session queue, and
AVFoundation does not settle that flag synchronously — so the log line reports the state **before**
the stop rather than after it.*

⛑ **It is a defect in the instrument, not in the handover.** *The handover itself is proven by what
follows it: ARKit acquires the lens and returns tracked frames, which it cannot do if AVFoundation
still held the camera.* **Flagged here so nobody reads it later as evidence the yield failed** — and
left alone, because chasing a log line that is contradicted by the behaviour it describes is the
cheapest possible way to spend a day.
