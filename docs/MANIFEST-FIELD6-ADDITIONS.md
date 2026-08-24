# What Field 6 adds to the manifest
2026-08-23. **Additive only — `manifestSchemaVersion` stays 3.**
Example to build against: [`fixtures/manifest-position-example.json`](fixtures/manifest-position-example.json).

⚑ **No version bump, and that is the ruling rather than an oversight.** Every field below is new;
none changes what an existing field means. Under the version policy ratified 2026-08-15 additions
are the emitting side's call alone and a receiver ignores what it does not consume — so bumping to 4
would force the binder to carry two readers to gain nothing. **A version number is a promise that
something old broke.** Nothing old broke.

## 1 · `files[].position` — where a frame was taken

Three states, and the third is the one worth building for.

| | meaning |
|---|---|
| `{ positioned: true, … }` | measured, with `tracking`, a full 4×4 `transform`, and `surface` when a ray-cast hit |
| `{ positioned: false, why }` | ⚑ **a refusal** — the app could take a position here and did not |
| field absent | this frame inherits from its container, which is the normal case |

⛑ **The distinction between the last two is the whole design.** *At least one frame per container
carries a position; everything else inherits it.* So an absent `position` on nine frames of a
ten-frame container is **completeness, not a gap** — the desk reads the container, never the frame.
A `positioned: false` is different: it says the machinery was present and declined, with the reason,
and that is the only one worth investigating.

**Read a container as positioned if ANY of its frames is.** A container with ten frames and no
positioned one is a container the desk cannot place, and it is indistinguishable from a complete one
unless this rule is applied.

**`position.surface` is not `position.x/y/z`.** The pose is **where the concierge stood**; `surface`
is the ray-cast hit **in front of the lens**, with its distance. For a nameplate shot the two are
0.3–1 m apart, which is the difference between placing the water heater and placing the person
photographing it.

## 2 · Two new `intent` values — `floorplan` and `mesh`

Both are ordinary captures: real files, real hashes, listed in `files[]` like any photograph, with
`mime: "application/json"`. ⚑ **The intent is what makes them findable** — without it a room's
geometry arrives as an unlabelled blob among the pictures.

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
  by.** The mesh sees it, because geometry needs no category — which is why fitted rooms now get a
  mesh recommendation alongside the equipment rooms.
- **Flooring type** — not in RoomPlan's output at all.
- **Registers and vents** — likewise.
- **Floor area** — deliberately **not** derived from the perimeter. A rectangle assumption is wrong in
  every L-shaped room, and the mesh is its honest home.

The field app returns these as `null` rather than omitting them: **an absent key reads as *nobody
computed it*, and `null` reads as *the plan does not carry this*.**
