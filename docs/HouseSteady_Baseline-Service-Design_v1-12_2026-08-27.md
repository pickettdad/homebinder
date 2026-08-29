# HouseSteady — Baseline Service Design (v1.12)

**Version:** v1.12 · **Date:** 2026-08-27 · **Supersedes:** v1.11 (2026-08-20)
**Authored from v1.11 with the current file in hand**, edited surgically — **every replacement asserted individually, and the result verified by reading the written file rather than the report of it.**

**What changed in v1.12. ⛑ The baseline has two desk passes and this document described one.**

⚑ **§3's stage table showed *the desk pass* once, between visit 1 and visit 2, and §5's four stages are all that pass's work.** ⛑ **Nothing described what happens between the Inspection Visit and the Handover — which is where the Binder is actually made.** *Owner-identified 2026-08-27.*

**New §5a carries it: fold in · resolve · generate · draft.** *The parallel to §5 is deliberate, and every stage is still confirmation of a proposal rather than authorship.*

⚑ **And it carries a ruling: the Handover is not gated on completeness.** **Anything unresolved at desk pass two takes one of three routes — a follow-up inspection, a task on a monthly visit, or named as undetermined.** ⛑ **The retainer begins after Handover, so a baseline that waits for the last outstanding item delays its own revenue for the least valuable thing in the house.**

**§8's Binder builder item 3 gains desk pass two's surfaces**, because Binder stage 10 is unstarted and a specification written against half the passes builds half a screen. **§9 loses the `scope[]` row, which is being decided.** ⚑ **And no third `scope` value is added** — *desk pass two attaches and assembles rather than resolving checklist items, so `baseline:desk` and `baseline:inspection` still cover the vocabulary.*

⛑ **The status line read *Status: v1.9* through three cuts.** *Corrected.*

---

**What changed in v1.11. ⛑ The capture architecture was wrong in the way that matters, and the owner caught it.**

⚑ **v1.10 said a world-tracking session starts on zone entry and stays alive. It does not, it never did, and nobody would design that** — *a Discovery Visit runs two to three hours, and no iPad holds world tracking with mesh across it.* **The design has always been three separate ARKit modes, each started for a bounded job and closed when it is done.**

> **1 · RoomPlan** — runs for the floorplan, closes. **One per zone.**
> **2 · Mesh** — runs where the room earns it, closes. **A couple per house, not per zone.**
> **3 · Positioning** — world tracking stripped of the heavy work, awake for the instant a position is taken and **paused between containers.**

⚑ **Everything after the plan and the mesh happens in mode 3, taking solid breaks.** *The measured pause result is what makes it work: mesh byte-identical, origin 0.00003 m, resume 0 ms.*

⛑ **Coverage-as-query is struck by owner ruling.** ***The app shouldn't be comparing pictures any more.*** *Capturing an object already takes several photographs because that is what capturing a thing is, and if the desk wants a different angle it goes on the next visit's list.* ⚑ **The service already solves it, and a live coverage check was a feature nobody asked for** — *it was a banked idea promoted to a design fork by this desk, which is how a note becomes a blocker.*

⚑ **The room shot and the escape hatch become sibling pairs** — *one tap, two frames: a 1× sibling carrying the measured position and the 0.5× wide frame that is the shot.* **That deletes *a position from one side of the step-out or the other* entirely: there is no side, there is a sibling.** *The field session had asked for a sentence reconciling the anchor rule with the hatch rule; the pair removes the conflict instead of explaining it.*

⛑ **The run trace's medium is open — video, traverse, or mesh — and v1.10 implied video was settled. It is not.**

⚑ **And the thermal test is cancelled by owner ruling.** *Three bounded modes are not a continuous hold, so the four-run comparative study measured a load this service does not produce.* **The device bench exists and stands as a standing instrument for whenever something actually misbehaves.**

---

**What changed in v1.10. Cut the same day as v1.9, because `MODES-AND-THERMAL-2026-08-20.md` was read after v1.9 was written and it carried three things v1.9 needed.** ⛑ *The register listed that document ○ — listed, not opened — and v1.9 was authored from a summary of it. The owner supplied it.*

⛑ **§4.1a-i quoted the step-out cost and dropped the condition that makes it true.** **86–607 ms holds with the ultra-wide input pre-built at launch; built while ARKit holds the camera, the same operation measures 9,008 ms.** ⚑ **A specification carrying the number without the condition can be built the slow way, and the escape hatch would be unusable for a reason nobody could see in the document.** *Corrected in §4.1a-i and §4.1a-iii.*

⚑ **Mid-session reconfiguration is half-measured and v1.9 called it unmeasured.** **Re-running with a lighter configuration without `.resetTracking` keeps the session — measured.** *So the mechanism works going lighter; what is open is whether enabling reconstruction mid-session backfills geometry or only accumulates forward from that moment.* **Sharpened in §4.1a step 2.**

⚑ **World-map persistence is added as a resilience requirement** — *an app that dies from heat must not take the zone's coordinate space with it, and every capture in that zone inherits its position from that space.*

⛑ **And a false fact is removed rather than propagated: the torch was NOT on for the 98-minute thermal run — owner-attested 2026-08-20, and he is the one who walked it.** ⚑ **The closed session log records it as measured *with the torch stuck on*, and that is wrong.** *The likely mechanism is that both facts were true of the same period — the torch bug was real and the run was real — and a session merged them into one sentence. Two facts sharing a cell, which §4.1b already names about the two frame-exit counts.* **So 9.2%/hour is a clean reference and the control run's check stands.** ⛑ **The closed log is archived and is not edited by rule, so this note and the register's row are the correction of record.**

⚑ **Re-cut in place rather than superseded, because v1.10 never left the desk** — *no save, no send, no reader.* **Replace any copy you hold.**

---

**What changed in v1.9. This is the re-read v1.8 asked for.** ⚑ *§4.1a-i opened with **this section describes a viewfinder that does not exist… nothing here is a concierge instruction until the camera lands and this section is re-read.** The camera landed between 2026-08-15 and 2026-08-20.* **So the provisional banner comes off what was built and moves onto what was not.**

**The capture sequence is reordered to the owner's capture architecture, and the traverse leaves it.** ⚑ **New §4.1a-iii carries the architecture: enter the zone → floorplan → the mesh decision → room shot → object containers, each with at least one frame carrying a position → zone concerns → access.**

⛑ ***Pan* is retired as a word; the capture is the **traverse**.** **And the traverse is no longer part of the standard zone routine** — *it was built to give the desk enough context to place objects and stop it double-counting, and that is a visual-matching job the container and the position have taken over.* **It remains a tool that works, with no settled purpose. §4.1a-iv records that honestly rather than inventing one for it.**

⚑ **The frame bracket is measured and the answer was not a bracket width.** *§4.1b named it the one measurement that comes before its own build and called the +16%-to-+42% spread the whole question.* **The camera settles 1.6–2.8 seconds on anything that is a thing, so the dwell is the signal and the timestamp is only a pointer into it.** **§4.1b's rule changes accordingly and the footer's open item closes.**

**`#124` is closed by owner ruling 2026-08-20: the traverse does not replace the room shot.** *§4.1a step 3 and the footer both carried **do not rule it closed**; both are corrected.*

**§4.3 is replaced rather than amended** — *it was titled `RoomPlan moves from parked to load-bearing` and closed with **none of this is built, because RoomPlan is parked on the Mac**. `roomPlan.ts` and its card are deleted, and the deliverable is the capture architecture, of which RoomPlan is one component.*

**The exposure ruling is amended, the torch rule is stated as built, 0.5× is retained as an escape hatch, and the vocabulary the camera shipped with — frame-siblings, evidence and insurance marking, pause and resume — is defined here for the first time.**

---

**What changed in v1.8. §4.1a-ii described a container with no way out of it, one line after promising that ungrouped capture stays free.**

⛑ **The exit was missing.** *"Tap new object again and it starts over"* was the only transition given, **so after the first tap a concierge was permanently inside some container** — while the section's own first rule says ungrouped capture must stay free. **Two sentences contradicting each other after the first use, and neither noticed, because the section was written from the grouping side.**

⚑ **And container state is a silent failure of the same shape as the mode colour.** **Twenty shots filed into the wrong object look exactly like twenty filed correctly.** *The mode's answer was to colour the whole frame rather than a small icon; a side strip you must look away from to read is the small icon again.*

**The owner's capture flow is written in as the specification it always implied** — the object strip, the `+`, the folder thumbnail, re-entry, and the establishing shot.

**The run trace is given its container rule**, because it is the one capture whose two ends are not in the same place.

**And §4.1a-i's ACTIONS list omitted the room shot**, which the Build Roadmap has carried since 08-13. Corrected.

---

**What changed in v1.7. §4.1a-i described a camera the owner ruled against three days before this document was cut, and the camera is about to be built from it.**

⛑ **The mode was named `Nameplate`. It is `Text`.** *`nameplate` was retired by ruling because it collided with the per-label surface enum — one word meaning a photograph on one side of the manifest and a label on the other.* **The word survives everywhere it means the physical plate, which is correct; only the mode name changes.**

⛑ **The mode forced a torch and shot three exposures for every plate.** **Owner ruling 2026-08-12: a mode declares a *goal* and the camera finds the settings — torch only when the scene is genuinely under-lit, extra exposures only when the live read comes back marginal.** *Most utility rooms built in the last twenty-five years are fully lit, and a forced torch on a glossy plate lays a specular hotspot across the characters.*

⛑ **And *a mode is the camera's configuration* is the pre-ruling form of the same sentence.** A mode is a goal; the configuration is what the camera works out to reach it.

⚑ **All three were corrected in the Build Roadmap on 2026-08-13 and not swept here** — the same class that document caught in itself a day earlier, arriving in this one. **v1.6 carried the pre-ruling camera into the week the camera gets built.**

---

**What changed in v1.6: two ratified corrections and a footer. Nothing new is introduced and nothing unruled is written in.**

**§4.1a-ii is corrected on two counts, both Builder Code's** — register #150. **The object container does not fix cross-object plate bleed**; it makes the bleed *sayable*. **And a group is a count, and a count is an assertion.** The duplicates case is restated at its true size, because sixteen duplicated labels fell to one on a prompt change alone. ⚑ **§0 carries the same qualifier, because the measurement §0 cites is the measurement that moved** — a correction is swept across the class, not scoped to the section it was found in.

**§4.2 is rewritten to say what it means** — register #152. **No naming, no placement**, rather than *no pinning*, which the field implementation contradicts while doing exactly what this document asks. **A cross-repo contract note is added**, because a Discovery export can now ship a non-empty `pins[]`.

**And the footer said v1.4 in a v1.5 document.** Corrected.

⚑ **Unchanged: §4.1a-i and §4.1a-ii remain SPECIFICATION, PROVISIONAL — what to build, not what a concierge does. The concierge-facing capture rules are unchanged until the camera exists.**

## §0 · The three-way trade

**Concierge, field app and binder each help where the others struggle. Stated here because it has decided every major redesign in this project and has never been written down.**

**Twice already, in this order:**

**The concierge could not run a blind inspection on visit one** — a person being watched while not knowing what they are looking at. ⚑ **So the service split into three visits and the app got a capture-only screen.** *The service and the software absorbed a human problem.*

**The binder struggles to identify, place and de-duplicate** — sixteen duplicated labels across eighty proposals, none sharing a photograph, and a tripled ventilator. ⚑ **So the concierge and the app take on two seconds of work per object that saves the desk minutes.**

⚑ **v1.6: that figure has since moved, and the qualifier belongs here as well as in §4.1a-ii.** *A prompt change alone took sixteen duplicated labels to one and false positives to zero — and took missed key objects from two to four, proposing fifty where the first run proposed eighty.* **The trade stands and its strongest evidence changed shape: the binder's difficulty is not that it duplicates, it is that the settings which stop it duplicating cost coverage.** **What the concierge contributes is a count and a boundary, and neither of those is a setting** — which is exactly why it belongs on the side of the trade it is on.

> **The test: is this act cheap where it happens and impossible to reconstruct later?**
>
> ⚑ **If yes, it belongs where it is cheap, regardless of which track it lands on.** *Grouping five photographs costs a tap in the room and cannot be recovered at any price at the desk. Deciding what the object is costs a specialist in the room and costs almost nothing at a desk with a lookup.*

**And the corollary governs what a capture decision is allowed to be.** ⚑ **What the concierge contributes must never require knowing what a thing is.** *The rule is not that the field does less. It is that the field does the things a camera and a person present can do, and nothing that needs a name.*

**The evidence for most of it is one room.** The owner's mechanical room was captured as four canvases plus a wide shot, then reconciled against seventeen household answers. **The consolidated record carries twenty frame-exit rows: twelve open, eight partial, zero closed.** Every capture ruling below exists because of a row in that table.

> **The one-line version, in the owner's words:** *we are taking the guesswork out of the inspection checklist and removing generalities to make it specific.*
**What this is:** how a house enters the service. Three visits, the desk work between them, and the engine that turns captured objects into work. **This is the governing document for the process**; the Baseline Inspection Process v1 is rewritten under it, and change requests flow downhill from here to the field and binder tracks.
**Cause:** the first five-zone walk on a real house, 2026-07-31. The finding is in §1.
**Status:** design decisions, owner-authored. Sections marked *recorded, not specced* are reasoning written down without becoming requirements.

---

## 1. What the walk found

**The capture and the inspection do not fit in one visit, and trying to do both makes the concierge into an inspector.**

The owner walked five zones of his own house. What happened, in his words: capture alone took the whole visit · pinning stopped almost immediately · the natural motion was *walk into a zone, get its floorplan, move around the room clockwise, capture everything* · single-shot beat sweep capture · and every capture wanted a note attached explaining its significance.

**Pinning stopped because pinning is classification, and classification is desk work.** The fridge is obviously the fridge. Naming it as a component with a type and a checklist wants a screen, a keyboard, and no homeowner standing in the room.

**The named failure this design exists to prevent:** *a concierge in an unfamiliar house, on visit one, running tests and working a checklist while also trying to see the property — produces a worse inspection than a targeted one, a thinner record than a dedicated capture, and looks like a home inspector doing both badly.* That is the opposite of a relationship professional who knows the house.

**This is not a change of direction.** The four-pass room sequence already put capture first. The session plan round trip already existed as the mechanism for carrying one visit's findings into the next. What changed is the time boundary: **pass one is a visit; passes two to four are a different day** — and they are only possible on a different day because the desk work in between turns a pile of captures into a targeted list.

---

## 2. What does not change

Stated plainly, because a redesign invites people to reopen settled things.

**Identification, never assessment.** Unchanged, and it gets harder rather than easier — see §6.5. Better evidence makes overclaiming easier.

**The manifest contract · the Binder Schema · the audit engine · the four streams · overlays as the storage model · nothing renders unsigned · AI proposes and a human signs.** All unchanged.

**Everything Increment 4 built.** The gap report and the session plan v0 emitter are not wasted — **their order flips** (§4.4), which is a sequencing change rather than a rebuild.

**The concierge is not an inspector, and the software carries the expertise.** This design makes that more true, not less.

---

## 3. The shape of the baseline

| Stage | What happens | What the client gets |
|---|---|---|
| **Discovery conversation** | Needs, priorities, who else is authorised, what they already worry about. Sample Home Profile and sample Binder shown | Understanding of what the capture is for |
| **Visit 1 — Discovery Visit** | The conversation, then capture. Simple leave-behinds: air test canisters, water sample collection | Nothing on the day |
| ⚑ **Desk pass one** | **§5. The captures become a house.** *Assemble · place · identify · confirm* | — |
| **Between** | Home Profile delivered — emailed ahead of visit 2, or handed over on arrival | **The Home Profile** (§7) |
| **Visit 2 — Inspection Visit** | The targeted inspection, from a list the desk produced. Tests, measurements, operation checks | An inspection of named things rather than a general look |
| ⚑ **Desk pass two** | **§5a. The inspection becomes a record.** *Fold in · resolve · generate · draft* | — |
| **Visit 3 — Handover** | The Binder, and **building the ongoing plan together** — what HouseSteady does, what the homeowner does, what gets coordinated | **The Home Binder** and the plan |

### ⚑ The homeowner walks the Discovery Visit — owner-ruled 2026-08-12

**Not merely permitted. Wanted, and asked for.** *The concierge captures; the homeowner narrates their own house.*

**The objection this reverses is recorded, because it was a good objection and it was dissolved by a design change rather than overruled.** **The original concern was that a concierge conducting a blind inspection on visit one would expose their own uncertainty to the client** — a person being watched while not knowing what they are looking at. ⚑ **Discovery is capture-only. There is nothing to be uncertain about.** *Photographing a thing whether or not you know what it is has no wrong answer in the room, which is the whole reason the governing filter is written that way.*

**What the walk produces that no photograph can.** *"We replaced that in 2019 after the old one leaked — that's why the floor's stained."* ⚑ **One sentence: an install date, a replacement event, a condition already explained, and a role.** **Four facts, none of which a camera can produce and none of which a desk pass can recover.**

**And it is the only instrument that reaches the connectives.** *A household cannot confirm a pipe as an object — nine of nine unconfirmed objects in the first real room were connectives.* **But it can say *that line goes out to the barn*, which is the edge, stated.** **The narration is not commentary on the capture. It is the topology.**

**It also changes what the visit is to buy.** *Being interviewed about your own house is a service. Watching someone photograph your basement is an inspection.*

**The homeowner is invited to every visit and expected at none of them.** The offer is standing and it is made at the discovery conversation, along with how sensitive spaces are handled — bedrooms, offices, anywhere they would rather accompany the concierge. **Transparency is the offer, not the requirement.** Most people will not want to follow someone around their house for three hours; the ones who do should never have to ask.

**Visit 3 is not a delivery, it is a working session.** The Binder is handed over and then the two of you build the ongoing plan from it — which items are HouseSteady's, which are the homeowner's, what gets scheduled, what gets quoted. That conversation is where the retainer stops being an abstraction.

**Naming.** *Discovery Visit* and *Inspection Visit* are the client-facing names. Internal shorthand leaks into client copy, so there is no separate internal vocabulary for them.

**The creepy problem is answered before a photograph is taken.** A concierge photographing a family's belongings is strange without context and ordinary with it. The sample Home Profile at the discovery conversation — and on the website — is what supplies the context. *This is what your home's record looks like; today is how we build yours.* **This is a service-design answer, not a software one**, and it is why the discovery conversation is a named stage rather than a courtesy.

---

## 4. Visit 1 — the Discovery Visit

### 4.1 · The capture loop

**The room stays the concierge's. The app asks for nothing that requires a decision.**

The loop: **walk in · capture the space · move around the room in one direction · capture everything.** Objects, concerns, the dirty and the unmaintained, windows, ductwork, surfaces, things that need fixing.

**What the app records at the moment of capture — three things, none of them a decision:**

1. **Position**, if RoomPlan is running. Where the concierge stood and which way they pointed. **Zero taps.** See §4.3 — this single thing decides whether the desk pass is confirmation or data entry.
2. **A note, on roughly one capture in ten.** The capture screen's third button becomes **"Use Photo and add Note"**, alongside Use Photo and Retake. Voice or text. **It is the exception rather than the habit** — most captures are self-explanatory at the desk — which is an argument for the button being available and unobtrusive rather than prominent.
3. **Walking commentary**, on its own — a voice note with no photograph attached. *"Basement, going clockwise, this wall is the mechanical side."* The concierge is already talking; the transcript is orientation the desk cannot otherwise get.

**Access is its own capture category, and it is easy to miss.** An attic hatch, a crawlspace entrance, a panel behind stored boxes, a shutoff behind an appliance — photograph the *access*, not just the thing. A pole-camera shot through a hatch is worth the ninety seconds. **This is what lets the Inspection Visit arrive knowing whether a space is reachable and what tool it needs**, rather than discovering it on a ladder.

**Every note is internal by default.** The desk decides what surfaces. A concierge observing *significant mould*, *very unmaintained*, or *filthy* is recording an observation that is useful internally and is not a sentence that belongs in a client's document — and any judgement in it must be adjudicated at the desk regardless. **Making notes internal by default is what keeps them honest.** No second button, no decision in the room.

### 4.1a · The capture sequence

**Derived from one real mechanical room** — 58 photographs, two independent structured reads, an identification run that got eight things confidently wrong, and seventeen household answers. **Every rule below exists because something failed without it.**

> **The filter every rule must pass: can it be executed correctly by someone who does not know what they are looking at?**
>
> **A capture rule that needs expertise fails in the worst available way — the photograph looks fine, and only the desk discovers the decision was wrong.** *Photograph the manufacturer's plate* fails on a cabinet carrying a dealer decal beside the data plate. *Photograph the pressure tank* failed on that room twice. **Every rule below says where to stand, what to include, or what to ask. None asks what anything is.**

**The capture kinds, and the vocabulary is ruled 2026-08-20.**

⛑ ***Pan* is retired as a word. The capture is the **traverse**, and that is the name everywhere downstream of this document** — the Checklist Master, the capture prompt, and any concierge-facing copy. *Same treatment **sweep** got and for the same reason: the retirement is about instructions, not about ids. A manifest string is renamed by the field side or not at all, and renaming one to fix a word that was never there is the failure that treatment exists to prevent.*

**Two kinds are part of the standard zone routine: the room shot and the run trace.** ⚑ **The traverse is a third capture the app can perform and it is not routine — see §4.1a-iv.**

⚑ ***Sweep* is retired from this document and from everything downstream of it — the Checklist Master, the capture prompt, and any concierge-facing copy.** The field app already has a button called Sweep and it fires a rapid burst of **discrete stills**. **A burst has a frame exit between every pair of frames, which is precisely the structure the rule below rules insufficient.** *A concierge told to sweep would press the button that exists, execute it correctly, get forty disconnected photographs, and destroy the only property the capture was for — and nothing downstream could tell, because they arrive as ordinary zone photos.* **That is the governing filter's own failure mode, found in the governing document.** The app keeps its keyword; ours changes.

**The order, per zone. This is the owner's capture architecture and §4.1a-iii specifies it.**

**1 · The floorplan.** **Walk into the zone and build its plan before anything else is captured.** *The zone comes from zone entry, which already exists and is orientation rather than classification.* ⚑ **The floorplan stops being a separate act and becomes a by-product of being in the room** — a world-tracking session starts on entry, RoomPlan builds the plan as the concierge moves, and every capture in that zone lands in one coordinate space. **It is also a real client deliverable: every home needs one and most do not have one, and window and door measurement comes free with it.**

**2 · The mesh decision, and it is taken here rather than at zone entry.** ⚑ **The concierge picks; the app recommends.** *By this point the floorplan step has walked the room, so the concierge has seen what is in it — and the whole object-capture phase is still ahead for mesh to accumulate over.*

> ⛑ **Why this is not keyed to the kind of room, which is the rule that was proposed and rejected.** **A water heater turns up in a random closet; a mechanical room is not the only room with equipment in it.** *Keying the mesh to mechanical, laundry and utility is **pan the important rooms** one layer down — it names room types, and a room type does not predict its contents.* **Deciding after looking needs no expertise at all: the concierge is answering *is there equipment here*, not *what is it*.**
>
> **What the app recommends on is open and is a field-side question, not a service one.** *A recommendation that is wrong is cheap — the concierge overrules it in one tap either way.*
>
> ⚑ **One device question rides this, and it is half-answered already.** **Re-running with a lighter configuration *without* `.resetTracking` keeps the session — measured.** *So the mechanism for changing configuration mid-session exists and does not cost the world.*
>
> ⛑ **What is open is the other direction: whether enabling reconstruction mid-session backfills geometry for surfaces already passed, or only accumulates forward from that moment.** ⚑ **If it only accumulates forward, the mesh covers the object phase and not the floorplan sweep — which is correct behaviour and must be said out loud, because a mesh that starts late looks exactly like a mesh with holes.** *Mac Field measures it.*

**3 · The room shot — orienting context, and it is not the floor plan.** **One or two per zone.** **RoomPlan produces the floor plan** (§4.3), which is why the room shot does not help with placement. **What it does is ride every identification call as context** — establishing that a thing is *there* without naming it, which is Amendment 10 §B1's *the finest read is authoritative* seen from the coarse end.

⛑ **`#124` — whether the traverse replaces the room shot — is CLOSED by owner ruling 2026-08-20. It does not.** *The question was live while the traverse was the thing carrying object context to the desk. It is not that any more, and the room shot's three jobs are unaffected by anything the traverse does or stops doing.* ⚑ **The room shot keeps 0.5× outright** — it is the one capture whose whole job is *is it one picture*, and §4.1a-iii's escape hatch exists for everything else.

> **⚑ One artifact, three phases — and this replaces v1.2's implied split between a capture and a pin surface.**
>
> **At Discovery it is evidence and the pin surface is not offered.** **At the desk, objects and concerns are placed onto it** — by the operator, confirming proposals, which is where classification belongs. **At the Inspection Visit it returns to the field carrying those pins, as a map to find things by** — the concierge opens the zone, sees the marked image, and taps a pin to get that object's list for this visit.
>
> **That is a phase rule, not two concepts sharing a word.** It is already what §4.2 says — *a pin is a known object being checked rather than an act of naming* — and it gates on visit kind, which exists. **One name for one image; whether it carries pins is what changes.**
>
> ⚑ **And the pin surface for a dense room is an open question with a new candidate.** *The argument was that thirty-four objects marked on one continuous image beats four separate photographs where the thing you are looking for is in the one you are not looking at — which was an argument for the traverse.* **With per-container positions and a floorplan, the plan itself becomes a pin surface that no photograph can match, and the room shot stays the surface a person recognises.** *Not ruled. Recorded so the traverse's departure does not silently take the question with it.*

**4 · Then, per object, in this order — each inside its own container (§4.1a-ii), and at least one frame per container carries a position (§4.1a-iii):**

- **The whole object, head-on — whether or not the concierge knows what it is.** ⚑ **This is the rule that failed.** In the worked room the pattern held for everything the concierge recognised as equipment and broke for the one vessel he did not — **which is precisely where the desk most needs the photograph.** *I don't know what this is* is the best possible reason to take one.
- **Each nameplate square-on, one plate per frame.** *A single photograph holding two pump plates at an angle produced two different part-number readings across two careful reads.* **Where two labels sit adjacent — a data plate and a dealer decal on one cabinet — take a third frame showing which is which**, because the desk cannot audit a surface choice from a file list.
- **Any other text**, wherever it sits, including a reference card near a housing rather than on it.
- **The fittings, connections and pipework** — and **frame the join, not the connective.** *A bare length of pipe is uninformative in principle; a bare pipe with a valve, a tank shoulder and a wall penetration in frame is a fact.*
- **Any indicator, close enough to read.** Gauge, meter, sight glass, reservoir level. ⚑ **This is the only capture that makes the longitudinal claim real** — *pass, pass, pass, fail* is the story a checklist tells, and it cannot be told from a gauge shot at four feet.
- **Concerns tied to that object**, described and never diagnosed.

**5 · Zone-level concerns** when they appear, or at the end of the object string. **Outside any container, and the desk attaches them.**

**6 · Access — its own category and easy to miss.** Retained from §4.1 and reinforced by the room record: **what cannot be recovered later is the ground-level access set** — gate widths, whether a side route is passable, where a vehicle parks, whether a ladder can stand, which openings operate. *An overhead image shows the gap; it does not show whether anyone can get through it.*

### 4.1a-i · The capture screen — BUILT

⛑ **The provisional banner comes off. This section described a viewfinder that did not exist and said it must be re-read when the camera landed; the camera landed 2026-08-15 to 2026-08-20 and this is that re-read.** ⚑ **It is now what a concierge does, not what to build** — every rule below is checked against what shipped, and where the device settled something differently from what this section assumed, the device wins and the difference is marked.

**Proven on the owner's own equipment: a ClimateMaster nameplate reads at 1:1 in portrait, in landscape and flat.**

**One viewfinder, always open.** *Not six doors launching six separate camera sessions — which is what a file-input camera forces, and what produced six interactions to photograph one object.*

**Two kinds of control, and they must not look alike.**

**MODES — tap once, stays until changed, the shutter fires repeatedly.** ⚑ **A mode is not a label.** ⛑ **And it is not a fixed set of settings either — owner ruling 2026-08-12: a mode declares a *goal*, and the camera measures the scene and finds the settings that reach it.** *v1.6 read "it is the camera's configuration", which is the pre-ruling form and would build a mode that forces a torch into a lit room.*

| mode | what the camera does |
|---|---|
| **Object** | Normal focus, room metering, no torch |
| **Concern** | As object. **The concierge saying *look here*** — the one classification-adjacent act needing no expertise, because *something looks wrong* is not a diagnosis |
| **Text** | **Fixed regardless of lighting: close-focus lock · spot metering on the plate rather than the bright tank beside it · level bubble · live text boxes · auto-capture when the read is stable.** ⚑ **Conditional and measured by the device — and the device made it sharper than the ruling did: the torch arms only when the plate cannot already be read, and when it fires it pairs itself with an unlit frame.** *So the decision is not **is the room dark** but **can I read this**, and the unlit companion is what decides whether the torch arms next time.* **Torch on in dark utility spaces holds texture at 9.5–16.9, where the blank guard would otherwise fail.** |
| **Document** | ⚑ **A different camera, not a photograph with a label** — flat, high contrast, edge detection, de-skew, multi-page. *Built as "a photo we named document" it produces a curled invoice at an angle that reads badly* |

**ACTIONS — tap to start a thing that happens.** **Floorplan** · **mesh** · **room shot** · **run trace** · **traverse** · **note.** ⚑ **A mode configures the sensor; an action is a workflow prompt that uses one.** *The room shot is Object mode framed wide — not a fifth camera configuration.* ⛑ **Floorplan and mesh are new to this list and they are not photographs at all** — *they start and configure the zone session, which is why §4.1a-iii specifies them rather than this section.* ⚑ **And the traverse sits in this list as a tool, not as a step in the routine** — §4.1a-iv.

**Rules that ride the design:**

- ⛑ **Exposure is metered per leg, floored at 1/30 and capped at 1/125 — amended 2026-08-19.** ⚑ ***Lock it and let the window blow* reasoned about brightness alone and froze the shutter at 1/15 s**, which is a shutter for someone standing still. *A value read once at the start of a run and applied to the whole run is a snapshot being quoted as an observation.* **The metered shutter is the single best result of the fortnight: 37 of 38 frames at 1/55 s @ ISO 1600 metered from 1/15 s @ ISO 400, median texture 6.2 → 18.1, blank-texture verdicts 22 → 0, and Vision reading brand names at 1.00 confidence.**
- ⚑ **0.5× is retained as a concierge-invoked escape hatch, against the field session's recommendation.** *Presentation is the product, and **is it one picture** is what an identification call wants.* **Everything else stays at 1×, because world tracking is 1×-only** — §4.1a-iii. ⚑ **A hatch capture is a sibling pair: one tap produces a 1× frame carrying the measured position and the 0.5× wide frame beside it.** *No stepping out for a position, no side to choose. The wide frame inherits from its own sibling.* ⚑ **Measured: stepping out and back costs 86–607 ms and the world survives it — *and that number holds only because the ultra-wide input is pre-built at launch.*** ⛑ **Built while ARKit holds the camera, the same operation measures 9,008 ms and the hatch is unusable.** *Pre-building at launch is therefore a requirement of the hatch and not an optimisation of it.*
- ⚑ **Frame-siblings — vocabulary this document did not have.** **A capture can produce more than one photograph, and the extra frames are siblings of the capture rather than photographs in their own right.** *A torch pair is two siblings, lit and unlit. A bracket is three.* **Evidence and insurance are marked at write time, never worked out later** — *the sibling the read came from is evidence; the others are insurance, and a reader that cannot tell them apart will quote the wrong one.*
- **Pause and resume, with the break declared.** *The concierge can stop and start without the record pretending the gap was not there.* ⚑ **And the wall that rides it is in §4.1a-iii, because it is a positioning rule rather than a screen rule.**
- ⚑ **The selected mode colours the whole viewfinder frame, not a small icon.** *The failure is silent: twenty plates shot in object mode have no torch, no close focus and no text read, and every photograph looks fine.*
- **Icons, not words.** Muscle memory arrives in a shift; reading does not.
- ⚑ **Assume Use, never Retake.** *There is no confirm sheet because there is no OS camera finishing its own job first — that was only ever true of the file-input door.* **The filmstrip is the confirmation.** A concierge who wants another shot takes another shot.
- **The note binds to the previous capture by default, and the filmstrip shows which one it landed on, tappable to move it.** ⚑ *Press-and-talk works without looking at the screen, which matters holding an iPad one-handed — and the default is right almost always.*
- **A zone note and a house note both exist.** Some things are true of the room and some of the house.
- **The zone comes from zone entry, not from a decision.** Already true today.
- **Position rides each capture wherever the sensors supply it** — ⚑ **enough to drop a marker on a floorplan, never to measure with.** *Indoor drift is around a metre: this object is in that corner, not 2.3 m from that wall.*
- ⚑ **A concern does not attach itself, and a concern shot inside a container is not an exception to that.** *A stain photographed near a water heater is the heater's, the floor's, or nobody's — and deciding in the room is naming.* ⛑ **A container proposes; it never asserts** — so a concern captured inside one arrives with that proposal attached and the desk still decides, exactly as a plate does. *Written because §4.1a-ii puts concerns inside containers and the two sections read as a contradiction otherwise.* **It stays free-floating and the desk attaches it; capture order proposes the attachment, exactly as it does for plates.**

**What it is worth, stated once so the cost conversation has a number to argue with.** **Six interactions become one: point, the bubble squares you up, the box goes green, it fires.** ⚑ **In a thirty-four-object mechanical room that is roughly two hundred taps against thirty-four.**

### 4.1a-ii · The object container — BUILT

⚑ **The single highest-value thing the field can give the binder, and it costs one tap.** ⛑ **Built and shipped 2026-08-16; the provisional banner comes off.** **The flow below is what the app does.**

**Discovery Visit only.** *Visit two onward is desk-pushed and targeted — a different screen, a different process, and not this.*

**How it works — owner-specified 2026-08-15, and this replaces the two-sentence version that had no way out of a container.**

**A strip down one side of the viewfinder holds the objects made in this zone. At the top of it sits a `+`.**

- **Tap `+`** — a new container opens and you are in it. **Everything captured next is tagged to that object: the whole unit, the text on it, other angles, the concerns.**
- **While you are in a container the strip shows that container's captures.** Out of it, the strip shows the zone's objects, **stacked, each wearing its own first photograph as its icon.** ⚑ **The furnace one, without anybody typing *furnace*** — the governing filter satisfied by a picture rather than a word.
- **Tap `+` again** — the current container closes and a new one opens.
- **Tap an object in the strip** — you re-enter it and add a shot, over the viewfinder rather than on another screen.
- ⛑ **Tap the container you are currently in — you leave it, and capture returns to ungrouped.** **This is the exit that v1.7 did not have.** *Same gesture as entering, no new control, discoverable by accident.*
- **Leaving the zone closes the open container automatically.** *A container spanning two zones is always wrong, and zone comes from zone entry rather than a decision.*

⚑ **The state must be visible in the frame, not only in the strip.** **Being inside a container without realising it is silent — twenty shots filed into the wrong object look exactly like twenty filed correctly.** *This is the mode-colour failure wearing different clothes, and it takes the same answer: the active container is marked where the concierge is already looking.* **A strip you have to look away from to read is the small icon that rule already rejected.**

**And the first capture in a container is the establishing shot.** ⚑ **It is the folder's icon and it is the frame that should ride that object's identification call as context** — free, because it is the shot a concierge takes first anyway.

**What it declares, and it is not what it looks like.** ⚑ ***This is a thing, and I am now photographing it.*** **Not what the thing is.** *A concierge can group five photographs of something they cannot identify — and the one act the governing filter forbids never happens.* **It is the shutter with a boundary around it.**

**What it fixes, and each is a measured failure rather than a predicted one:**

- ⚑ **The duplicates — and this is the bullet that weakened, so it is stated at its true size.** *Sixteen duplicated labels across eighty proposals, and **zero** of the duplicate pairs share a photograph* — the same equipment shot from different angles, landing in different read batches, each proposing independently. **Evidence-based de-duplication catches none of them, and a declared group catches all of them, because it does not infer identity, it is told.** ⚑ **But sixteen fell to one on a prompt change alone, at the cost of doubling the missed objects.** **So the container's duplicate case is not *this is the only fix available* — it is *this is the fix that costs no coverage*.** *Say what a thing does, and not what it is adjacent to.*
- ⚑ **The count.** **Four pressure tanks from two vessels becomes structurally impossible: one group is one object.** *The model stops being asked how many things are in the room and is handed the number.*
- ⚑ **The plate join.** **Pass 3 currently infers which plate belongs to which object.** *A plate shot inside a group is joined by the person who took both photographs* — **the most reliable lane getting the most reliable evidence.**
- **The question the model is asked gets easier.** *Today: what things are in this photograph — where every vessel in the background is a candidate.* **Grouped: these five photographs are all of one thing; what is it.** ⚑ **Background clutter stops being candidates and becomes context** — which is the plate scaffold's move applied to the frame: enumeration converted into matching.
- ⚑ **The plate bleed becomes sayable, which is not the same as fixed.** **The container does not stop a foreign plate appearing in the frame — the foreign plate is in the frame either way.** *What changes is that a grouped object can be told a plate in its frame is not its own. Ungrouped, it cannot be told, because nothing has declared where the boundary is.* **An instruction the model can be held to requires a boundary somebody drew.**
- ⚑ **And the media join stops being a claim.** **`mediaIds` becomes *given* rather than *worked out*** — register rule 31 applied at the moment of capture: *to stop a model asserting something, give it nowhere to write it.* **The group is handed the list; nothing downstream has to reconstruct it.**

**Five rules that ride it.**

⚑ **Ungrouped capture must stay free.** **A concierge who walks in and simply shoots must still get a complete, valid visit.** *The container is a container, not a gate — otherwise the first thing that happens under pressure is that people stop using it.*

⚑ **A group is triage scaffolding, never identity.** **The desk splits a group that turns out to be two things, merges two that turn out to be one, and assigns the missing captures as visit-two tasks.** *Owner ruling 2026-08-13.* **A declared group that the desk cannot overturn would be a wrong answer that is hard to argue with because a human made it.**

⚑ **A group is a count, and a count is an assertion.** **Five photographs declared as one object assert that the two vessels behind it are not part of it** — right almost always, and wrong for a flow centre with two circulators. *The split-and-merge rule above is what covers it, and it is written here rather than left to be inferred, because the container says more than it looks like it says.* **The concierge is not asked to be right about the boundary. They are asked to draw one.**

⚑ **A run trace starts inside a container and ends outside it.** **It is the one capture whose two ends are not in the same place.** *File it in the furnace's container and you have asserted the pipe is the furnace's; leave it out and you have lost that it started there.* **So the container it starts in is recorded as one endpoint — captured for free, because the concierge is already standing there — and the trace is not a member of that container.**

⛑ **That rule was written, documented, tested — and never once invoked.** ⚑ **The rule is right and it was unreachable**, which is a different defect from a wrong rule and it is the one this project keeps meeting: *a value being computed is not the same as a reader being able to reach it.* **A rule with no path to it passes every test it has, because the tests check the rule and not the path.** **It is carried here unchanged and the build owes it a route.**

**A photograph will contain other objects and that is fine.** *The group says what the photograph is **of**, not what is in it.*

### 4.1a-iii · The capture architecture — SPECIFICATION, UNBUILT

⚑ **This is the section the provisional banner moved onto. It describes a capture path that does not exist yet.** *Field 6 builds it, and it is gated on this document existing — which is why this section is the reason v1.9 was cut.*

**The owner's words, and they are the design:** ⚑ ***enter a zone → floorplan → room shot → object containers, each with at least one frame carrying a location → zone concerns outside any container. Mesh only where the room earns it.*** **His reason, recorded because it is the whole justification: *the more queryable data we can collect on discovery visit, the better. We may not yet know when or why we need it, but we might.***

⛑ **THREE MODES, EACH BOUNDED. This section said *a world-tracking session starts and stays alive* until v1.11 and that was never the design.** **RoomPlan runs for the plan and closes. Mesh runs where the room earns it and closes. Positioning runs stripped down, awake for the instant a position is taken and paused between containers.** ⚑ **A Discovery Visit is two to three hours; nothing holds world tracking across it and nothing needs to.**

**What each mode does.** RoomPlan builds the floorplan as the concierge moves, mesh accumulates if it was asked for, **and every capture in that zone lands in one coordinate space.** *ARKit owns the camera while it runs, which is what makes the lens rule below binding rather than a preference.*

> ⚑ **The load-bearing sentence of the whole architecture, and it is the owner's:**
>
> **At least one frame per container carries a position. Everything else inherits it.**
>
> **That single rule turns a continuous, battery-eating tracking session into a duty cycle** — *the session only has to be alive at the instant the one positioned frame is taken.* **It is measured rather than assumed: a pause holds the world, the mesh comes back byte-identical, the origin moves 0.00003 m and resume costs 0 ms.**
>
> **The natural anchor is the nameplate frame, because it is the closest the concierge ever stands to the object** — not the establishing thumbnail, which together with the room shot is the likely 0.5× case.

⛑ **The wall that rides it, and it is enforced rather than documented.** ⚑ **A container whose anchor frame was taken while the session was paused is unpositioned forever, and nothing downstream can tell.** *It does not arrive wrong, it arrives absent — and an absence looks exactly like a container nobody positioned on purpose.* **So a paused session cannot supply a container's anchor. This is a wall, not a warning: an instruction is a request and a missing field is a wall.**

**Everything at 1×, inside the session.** ⚑ **World tracking is 1×-only — all twelve formats enumerated on the device.** *So the lens trade that used to apply to one capture kind now applies to every capture in the zone*, and §4.1a-i's escape hatch is the answer: step out, take the wide frame, step back, and carry a position from one side or the other.

⚑ **And the video format is chosen for the still, not for the tracking.** *Still resolution follows the video format — 4032×3024 on the hi-res format and 2016×1512 on a low-power one, from the same call.* ⛑ **The name misleads and the Build Roadmap §4a.3 records why: the sensor has one operating configuration and a still is pulled from that same configured stream, so frame rate and photograph size are one setting rather than two.** **So *drop to 30 fps to halve the load* can *quarter the photographs*, and a plate is the thing being photographed.**

**What the architecture buys, and it is more than placement.**

⛑ **STRUCK by owner ruling — coverage-as-query is not built.** ***The app shouldn't be comparing pictures any more.*** **Capturing an object already means several photographs, and a better angle is the next visit's list.** *Retained below only as the record of what was considered, because the reasoning about correlation still stands and the conclusion is that the service solves this and the app should not.*

~~Coverage becomes a query against geometry rather than a correlation between photographs.~~ **If the mesh knows an object's extent and every frame knows its pose, the app can say *you have photographed two-thirds of this, tilt up* — in the room, while it can still be re-walked.** ⚑ **There is no photographic comparison in it at all, which is the entire point:** *eight measures were built to answer **did the concierge miss part of this room** by correlating two photographs, and all eight failed identically, because a correlation with nothing to correlate returns a confident number.* **A blank wall read 100% overlap; a covered lens read 1.000.** **The escape is not a better correlation. It is a different question.**

⚑ **And measurement stops being a decision made in the room.** **Distance between two containers is one subtraction; clearance in front of the furnace is a ray-cast from the pose into the mesh; ceiling height is straight up; run length is a trace's first and last frame positions.** **Nobody decides in the room what is worth measuring, and the questions can be asked years later** — *a 2029 quote needing clearance in front of a water heater is answered from geometry filed in 2026.* ⚑ **This is the Measured House thesis with its missing piece supplied: until now *measured* meant what a plate says and what a household reports.**

⛑ **And the coordinate space is persisted, periodically, for the length of the zone.** ⚑ **An app that dies from heat must not take the zone's coordinate space with it** — *every capture in that zone inherits its position from that space, so losing it retro-actively unpositions work that was correctly captured.* **A crash costs the frames since the last save; it must not cost the zone.**

**Three limits carried with it, none of them optional.**

- ⚑ **A container's position is its anchor frame's pose, which is where the concierge stood rather than where the object is.** **Ray-cast; do not treat the pose as the object's location.**
- ⚑ **The mesh only exists where somebody walked and looked, so a hole reads *unknown* and never *nothing there*.** *Same failure as an empty list read as a completed one.*
- ⚑ **The marker-accurate ruling needs revisiting carefully rather than quietly dropping.** ***2.3 m from the panel* is defensible; *2,438 mm* is not.** *Indoor drift is around a metre, and a number carried to the millimetre is a claim the sensor cannot support.*
- ⚑ **9.2%/hour is a clean reference and the control run is checked against it.** *98 minutes, 100% → 85%, `nominal` throughout, camera and screen live and **the torch off** — owner-attested 2026-08-20.* ⛑ **The closed session log records it as measured with the torch stuck on; that is wrong, and the log is archived rather than edited, so the correction lives here and in the register.**

### 4.1a-iv · The traverse — a tool with no settled purpose

⛑ **Recorded honestly rather than given a job it no longer has.**

**What it was built for.** **The desk was finding multiple hot water tanks and four pressure tanks from two vessels.** *Separate photographs of separate objects gave it no way to tell that two frames were of one thing, so it matched visually and matched wrong.* **The traverse was the answer: one continuous image of a whole wall of equipment, so the desk could see the objects in relation to each other and place them.**

⚑ **That job is gone, and the container took it.** **A container declares the boundary and the count — one group is one object — and the positioned frame declares where it is.** **The desk is handed the number rather than asked for it, and it no longer has to match anything visually.**

**What may remain, and neither is settled.** **The run trace** — following a line from where it starts to where it ends is still a continuous act, and the traverse is a continuous capture. **Or the mesh may take that too**, since a run's geometry is a query against geometry like everything else in §4.1a-iii.

⚑ **So: the traverse exists, it works, and its frames are good for the first time.** *The metered shutter took median texture from 6.2 to 18.1 and Vision reads brand names off traverse frames at 1.00 confidence.* **What it is for is open, and this document does not invent an answer.**

⛑ **Its verdict is demoted; its frames are the deliverable.** **The gap detector built on top of it is abandoned by owner ruling** — *eight measures, two weeks, one failure family.* **`docs/TRAVERSE-STATE-AT-THE-PIN.md` in the field repo carries all eight and the seven constants nobody should trust in either direction.**

**Two rules survive it and they are worth more than the capture.**

- ⚑ **Test a new measure against a blank input before a good walk.** *All eight were tested the other way round and all eight passed. The first tested blank-first was rejected in an afternoon.*
- ⚑ **Transit captures: do not filter them, stop taking them.** **They exist because the traverse is never told the concierge stopped sweeping.** *Under deliberate open-and-close there is no transit, and a filter for them discarded nothing — because the careful walk that proved the filter necessary was the walk that removed its evidence.*

⚑ **And the frame-exit problem the traverse was once also aimed at has not gone away — it belongs to the run trace.** *Twenty frame-exit rows from one room: twelve open, eight partial, not one closed.* **§4.1b owns it.**

⛑ **Stitching, for the record: there is still no stitcher, and blending is the wrong instrument.** *Blending averages away the seams, and the seam is where the measurement was uncertain.* **What is wanted is frames laid out at their recorded offsets with gaps left as gaps** — *a coverage view for the desk, not a panorama, and the pairwise offsets are already computed.*

### 4.1b · The narrated run trace — video, and the narration is the point

**Walk a line from where it starts to where it ends, on video, talking the whole way.** **One of the two capture kinds in the standard routine, alongside the room shot.**

⛑ **The lens: normal by default, override available — ruled 2026-08-19.** *A fixed-normal rule was argued and withdrawn. The owner's own trace followed the supply line **through** the water treatment system, so a trace covers a run **and** its equipment, and in a tight room you cannot step back.*

⚑ ***Run* means a run of pipe.** A water line, a duct, a wire, a drain, a gas line. **The per-object sequence in §4.1a step 3 is not a run trace** — object, then plate, then parts, then concerns is ordinary capture and it is already the rule. **A run trace is a separate act with a separate medium, and it follows a line rather than covering a thing.**

> **Who decides which runs get traced, and the answer is not the concierge guessing.**
>
> **The desk prescribes them, because the desk is the thing that knows.** A frame-exit list is a desk output — twenty rows from one room — **and the open rows are exactly the traces worth shooting.** They ride the session plan into the Inspection Visit alongside everything else the desk prescribes. *A room where nothing goes anywhere generates no open exits and therefore no traces, which is why no rule about living rooms is needed.*
>
> **And at Discovery the obvious ones are shot by habit.** A concierge working utility spaces learns which lines are worth following and gets them on the first visit without being told. **The prescription is what catches what habit missed or left incomplete** — the same refinement ladder the rest of this document runs on: *a capture is safe the instant it is taken, and no later step is mandatory.*

⚑ **Video is the right medium here and photographs are the substitute, not the reverse.** Following a pipe is a continuous act. **A run has no frame exits inside a single take** — and frame exits are the whole problem. ⚑ **Two counts exist for that room and both carry their source rather than being reconciled: thirty in the confirmed room record, twenty in the consolidated four-canvas record.** *A figure states where it was derived or it is two facts sharing a cell. Neither count has closed rows to speak of — the consolidated one closed none of its twenty.* **Twelve deliberate photographs of a pipe are slow, tedious, and individually uninformative**, which is exactly what *frame the join, not the connective* already says.

**But the frames are not what the desk can read today, and this decides the rule.** **The API takes no video natively** — image blocks only, and an animated GIF is read as its first frame.

⚑ **The arithmetic is re-derived at source and both of v1.2's numbers were three times too high — and the conclusion survived unchanged, because the error sat on both sides of the ratio.** *Measured: 1,591 image tokens per photograph, against the 4,828 that had been estimated. The room is ~92,000 image tokens, not ~280,000.*

| | frames | image tokens | against the room |
|---|---:|---:|---:|
| the room's stills | 58 | 92,278 | 1.0× |
| **blind extraction, 1 fps over 2 min** | 120 | 190,920 | **2.07×** |
| **directed, 10 waypoints** | 10 | 15,910 | **0.17×** |
| **directed, 10 × a 3-frame bracket** | 30 | 47,730 | **0.52×** |

**On a baseline carrying eight narrated runs, blind extraction adds 161% — the video outweighs the house, which is what *prohibitive* correctly described. Directed adds 16%.**

> **The honest word is *affordable*, not *cheap*.** A sixth again on a baseline is a defensible line item, not a rounding error. **What it stops being is the thing that outweighs the house.**

**Two conditions ride under that number and both are stated here rather than left implicit.**

**⚑ First, the transcript has to carry timestamps, and until now that was a dependency in nobody's requirements.** *The cheap-video argument rested on a property of a step that is not built.* **The requirement, ruled here: word-level timestamps where the transcription provider offers them, segment-level as the floor. Transcription does not ship without them.**

⛑ **Second — MEASURED, and the answer was not a bracket width.** *The question was the spread between +16% and +42%, on the reasoning that narration lags pointing: a person says "and here it goes behind the tank" a beat after the camera gets there, so the frame at the spoken second may be the wrong frame.*

⚑ **The measurement: the camera settles 1.6–2.8 seconds on anything that is a thing.** **So the dwell is the signal and the timestamp is only a pointer into it.**

**The rule that follows, and it is better than the rule it replaces.** **Extract across the dwell segment containing the spoken second, rather than a fixed window either side of it.** ⚑ **That fixes the asymmetry without needing to know which side the narration lags on** — *a window has to be centred somewhere and a dwell has edges of its own* — **and across a two-second dwell some frames are hand-free.** **Frame differencing, local, free, and testable on footage that already exists.**

> **The rule that follows: narrate, or do not take it.**
>
> *"This is the cold line off the well, comes in here, through the sediment filter, along the wall behind the softener, and out to the house."* **The transcript is a spoken topology — it says what connects to what, which is precisely the thing no photograph can produce and the frame-exit table has no other source for.** **Transcription is the only step that reads a video at all today.**

⚑ **And the transcript is not only the output — it is the index into the frames.** Extracting 120 frames blind is what costs ~190,900 image tokens, twice the whole room. **Extracting the frame at the moment the narration says something worth seeing costs one frame.** *"…and here it goes behind the tank"* is simultaneously the topology **and** a timestamp pointing at the image that proves it. **Five or ten directed frames per trace, not a hundred and twenty undirected ones** — which turns video from prohibitive into cheaper than photographing the same run.

**So the narration earns its place twice: it says what connects to what, and it says which second of footage to look at.**

⚑ **The run trace's medium is undetermined — video, traverse, or mesh — and nothing here settles it.** *Two candidates have appeared: the traverse, which is a continuous capture looking for a purpose (§4.1a-iv), and the mesh, which answers a run's geometry as a query rather than a recording.* **The video is retained and marked superseded-in-principle — it goes when something traces a run end to end better, and not before.** ⛑ **The single-shot button is removed from the run-trace action: a trace is continuous by definition, and a button that takes one photograph of a run is a button that produces a frame exit.**

**Keep the video regardless.** The manifest is immutable evidence held forever, and **the doctrine that made the record honest also makes it re-mineable** — if reading a sequence as a sequence becomes cheap, the footage is already there.

⚑ **And the line map follows from the topology rather than from the pixels.** *Cold line from the well → sediment filter → softener → house distribution* is a graph. **Drawing it as a floorplan layer or a standalone mechanical map is a rendering job on a graph the narration already produced** — not something an engine has to see to derive.

### 4.1c · The household's sentence, spoken at the object

⚑ **The single highest-value capture, and it is not an image.**

**Every fact the desk could not derive came from the household, and none of it came through the capture.** The water heater whose breaker is off on purpose. The chlorine pump wired to the pressure switch by design. The floor stain that is old and explained. **Two of the confirmed room record's 34 objects still carry no role — not because the answer was unavailable, but because nobody asked while standing in front of them.**

**The mechanism exists: notes ride captures, and voice is already supported. The habit is missing, not the schema.**

**Three chances at the same fact, in descending order of value:**

1. **At the object, during Discovery** — best, because the thing is in front of both of them and the answer costs ten seconds.
2. **Soft questions accompanying the Home Profile**, before the Inspection Visit. *The Profile already carries the questions only the household can answer; these are those questions with a photograph attached.*
3. **At the Inspection Visit**, in person.

**Each is cheaper than the last chance being the only one** — and this is the same A/B the Inspection already runs: **it proceeds either way, and an answer makes it targeted rather than possible.**

⚑ **And it does not reopen §4.2's rule that Discovery stays light.** *Recording a sentence is not entering a conversation.* **The concierge asks, records, and moves on — they do not need to understand the answer, and not understanding it is not visible when nothing is being discussed.** The homeowner is invited to every visit and expected at none, so this happens when they are present and not otherwise.

**⚑ Also worth one tap where the session plan already names an object: same unit, or replaced?** **It is the only capture that can write house history** — *a furnace present until 2027* requires somebody to have recorded the moment, and no photograph carries it.

#### 4.1c-i · Operating state — the fourth attested field

**The record already separates `product` from `role`. It needs a third attested field beside them, and the record has been asking for one in prose.**

| field | source | honesty label |
|---|---|---|
| **product** | the nameplate | `Documented` |
| **role** | the household | `Reported by homeowner` |
| **state** | **the household** | **`Reported by homeowner`** |
| condition | observation | `Observed`, validated by recurrence |

**Values: *in service · deliberately off · seasonal or standby · abandoned in place · decommissioned but present · unknown*.**

⚑ **State is not condition, and the distinction is what earns it a field rather than a note.** **A condition cannot be attested** — *"I have not noticed this"* about split insulation is the category failing, not the person. **A state is an intention, and an intention has an authority: the household knows why the breaker is off.** *So state sits on the attestable side of the line, with product and role.*

**What it prevents.** The first water heater's breaker is **deliberately off** — it is a geothermal preheat store, and the panel is marked to keep it off. **With no state field the engine proposes a water heater with the full care package for a tank that heats nothing, and a well-meaning technician switches it on.** **State rides the trades brief as a do-not-operate line.**

**And the room proves the field is needed more than once.** *Legacy coax distribution* and *legacy telephone wiring* were both recorded as full systems whose entire content is **household says legacy** — filed under *still unresolved*, because there was nowhere structured to put it. **They are `abandoned in place`, and they are both runs rather than objects**, which is the first evidence that state is an edge property as well as an object one. *Most of what an older house has abandoned is connective: dead coax, a capped chimney, an abandoned oil line, a disconnected pool feed.*

**A condition needs the same treatment from the other end.** The floor staining beneath the water heaters is old, dry and **explained** — residue from the failure that caused the tank replacement. **Without an *explained* resolution state it is raised as new on every visit forever.** *It may re-flag, one click closes it, and the click is remembered — so the third concierge does not re-ask what the first one settled.*

### 4.1d · The paper

⚑ **The cheapest source of `Documented` facts in the service, and until this version no visit gathered any.**

**The gap was structural rather than an oversight.** Intake Tier 3 lists eighteen document types and says *tick what exists, don't gather yet.* The Binder Master Spec declares a document vault. Amendment 11 declares `document` as one of pass 1's five reading surfaces. **Three declarations and no producer** — the declared-and-consumed-by-nothing class running backwards.

**What it is: a capture step at Discovery.** Photograph the pile. Manuals, invoices, the last inspection report, the survey, warranty cards, the septic permit, the well record. **No expertise required and no decision asked — it is the §4.1a rule applied to paper: photograph it whether or not you know what it is.**

**Why it beats a photograph of the equipment.** *An invoice carries an install date, a model, and the name of the trade who did the work.* **A camera pointed at a water heater cannot produce any of the three.** ⚑ **And an install date is worth more than a lifespan band** — the replacement horizon for a roof is currently unproducible because no lifespan reference exists, and a roofing invoice answers it exactly rather than approximately.

**And it does not break the no-homework rule, because the line is precise.** *A monthly self-report form asks the homeowner to produce something.* **Photographing a drawer asks them to open it.** **Forwarding an email they already received asks them to redirect something that already exists.** **Neither is homework; a form is.**

**Two collection routes, and the second is the one that keeps working.**

1. **The drawer, at Discovery.** Catches what exists on day one.
2. **⚑ A dedicated forwarding address per household.** Anything sent to it lands in that household's record as `Documented`, with a source and a date. **This is the only mechanism in the service that catches work done between visits by somebody else** — the furnace service confirmation, the warranty registration, the roofer's invoice — which is otherwise invisible until a concierge notices a new water heater. **It is offered, never required.** *A household that wants a complete accounting of its house will use it; one that does not is no worse off than today.*

**⚑ And it seeds the trade scorecard from the client's own filing cabinet.** Every invoice names a local trade, a date and a price. **Twenty households in, that is the regional supply map, harvested rather than assembled.**

**⚑ One obligation attaches and it is named here so it is not discovered later.** An inbox holding clients' documents is a retention and privacy surface of the same class as the manifest. **It goes into the lawyer pass, not after it**, and the service agreement is where the consent for it lives.

### 4.1e · The same frame twice

**The Inspection Visit and every visit after it re-shoot the Discovery frame rather than composing a new one.** The app shows the previous capture of this object and asks for the same shot.

**What it buys, and every item is something the service currently cannot do:**

- **Consistency across concierges stops being training and becomes mechanical.** The third hire matches a picture. **This is the governing filter satisfied completely — the reference image is right there, and matching it requires knowing nothing.**
- **A condition gets its validator.** *Present in month one and month two is real; present once is noise* requires the same frame twice, and nothing currently produces the same frame twice.
- **§4.1a's indicator rule finally pays.** *Pass, pass, pass, fail* is a claim about one gauge photographed the same way four times. Shot freehand each month it is four unrelated pictures.
- **Object identity is asserted by the person in the room** — looking at last month's photograph of this object — rather than reconstructed at the desk from a fresh identifier.
- **And the thin month gets a client-facing artifact.** Same shot, same angle, twelve months. *Nothing changed, and here is the proof.*

**Two dependencies, both named and neither blocking.** It needs **the session-plan import to carry a reference frame per object**, which is a small addition to a thing being designed now and an expensive one to add later. **And the alignment aid is a rendering question for the field track** — an edge outline over the live view is preferred to a translucent ghost, *because aligning lines against lines is faster and more accurate than judging a blend, and this happens thirty-four times in one mechanical room.*

### 4.1g · The outcome log

⚑ **The record captures what the house *is*. Nothing captures what *happens* to it — and two sections of the Home Binder have no other producer.**

**Every coordinated job lands as structure: object · symptom · diagnosis · what fixed it · what it cost · which trade · when.**

**It is free, because the information already passes through the business on every job.** *It is lost only because nothing is shaped to catch it.*

**How it is captured depends on who does the work, and the harder case is first.** **With a contracted trade, the concierge attends and asks, or follows up by call** — *a job whose outcome nobody recorded is a job that taught us nothing.* **Once trades are in-house, the capture is a step in the trade visit rather than a chase.**

**What it turns on, each currently blocked by its absence:**

- ⚑ **Replacement horizons that are ours rather than published.** *Twenty water-heater failures with install dates is a replacement curve for houses like these, with this water, in this region* — **better than any lifespan table, and there is no lifespan reference file at all.**
- **The trade scorecard, from outcomes rather than impressions.**
- ⚑ **The unit rate correcting itself.** *Measured attributes × unit rate → a quote · the job is done · the real time is recorded → the rate adjusts.* **That loop is the compounding asset made concrete, and the outcome log is the only place it closes.**

**Owner ruling 2026-08-12: secure the capture first; work out the consumers afterwards.** *Data not captured cannot be consumed later; data captured badly can be re-derived.*

### 4.2 · What is deliberately NOT captured in the room

**No naming. No placement. No tagging. No checklist.**

⚑ **The words changed in v1.6 and the rule did not.** *This section said **no pinning**, and the field implementation contradicts that sentence while doing exactly what this section asks.* **A pin in the field app is three separate events — `PinCreated`, `PinTyped`, `AnchorPlaced` — and `pinType` is optional**, so an untyped, unanchored pin is structurally what §4.1a-ii's object container already describes. **The concierge-facing word stays *object*. Pin identity is the implementation, and the implementation is not the promise.** *A document that forbids the mechanism its own specification requires is a document a builder has to choose to ignore — and the sentences people choose to ignore are chosen inconsistently.*

*Equipment / plumbing / electrical / aesthetics* tagging was considered and rejected. It makes the concierge think in the app's categories while looking at a real thing, it is wrong often enough to need correcting anyway, and **AI reads it from the photograph better than a person deciding under time pressure.** Doing work in the room to produce a worse answer than the desk gets free is the failure.

**Naming and placement move to the desk entirely** for the Discovery Visit. They return in the field for the Inspection Visit, where a pin is a known object being checked rather than an act of naming.

⚑ **Stated as the phase rule, because §4.1a now depends on it and an implication is not a rule.** **Discovery: the pin surface is not offered.** **Desk: objects and concerns are placed onto the room shot.** ⛑ *This read **or the pan** until v1.9; the traverse is no longer part of the routine, and the floorplan is the new candidate surface — §4.1a step 3.* **Inspection: the pinned image goes back to the field, the concierge opens the zone and sees it, and tapping a pin gives that object's list for this visit.** *One artifact through all three; what changes is whether the surface is offered, and the gate is visit kind.*

⚑ **And this is a cross-repo contract change, written here so it is a note rather than a discovery at import.** **A Discovery export can now carry a non-empty `pins[]`** — untyped, unanchored, one per declared object. **Any binder-side assumption that a Discovery visit ships no pins breaks on the first real export.** *The risk in the other direction was checked and is clean: `deriveComponentItems` skips untyped pins, so a group cannot smuggle checklist debt back into a capture-only visit.* **This is the class where one side assumes about the other, and the only cheap moment to catch it is before either side ships.**

### 4.3 · Position, and what it decides

⛑ **This section was titled *RoomPlan moves from parked to load-bearing* and closed with *none of this is built, because RoomPlan is parked on the Mac*. Replaced rather than amended.** ⚑ **`roomPlan.ts` and its card are deleted, and the deliverable is not RoomPlan — it is the capture architecture, of which RoomPlan is one component.** *§4.1a-iii specifies it; this section says what it is worth.*

**Four things at once, and every one of them is a reason on its own:**

- **The floorplan is a real client deliverable.** Every home needs one and most do not have one.
- **Window and door measurement comes free** — no tape measure, and it feeds the Measured House thesis directly.
- **Room dimensions and areas** feed quoting, and unit rates against measured attributes are what make a quote instant and drive-out-free.
- ⚑ **Position is what makes the desk pass forty minutes rather than four hours** (§5.2) — **it is the single thing that decides whether the desk pass is confirmation or data entry.**

**What position data is.** **The tracking does not stop when a photograph is taken**, so each capture can record where the concierge stood and which way they pointed, in the same coordinate space as the plan. **Not *somewhere in the kitchen* — *stood here, faced that wall*.**

**Which means the room shot does not help with placement — the floorplan already knows.** It keeps three narrower jobs: **orienting context riding every identification call** (§4.1a) · **the pin surface from the desk pass onward** (§4.2) · and **a wide shot sent with a trades request** so a contractor arrives familiar with the workspace. Real uses, none of them placement.

**Two honest caveats, both unchanged and both now sharper.** **Drift over a long walk is real — usually good to about a metre indoors, occasionally worse — so placement is a proposal to confirm, not a fact.** ⚑ **And none of it is built.** *The Mac exists, the camera is built and the plugin ships; the architecture in §4.1a-iii is specified and has not been written.* **Field 6 is that build, and it is gated on this document.**

### 4.4 · The gap report moves to visit 2

**The named failure:** *after a capture-only visit, nearly every checklist item is unresolved. A client document saying "we did not cover 380 things" is not a document.*

So: **the Discovery Visit produces a session plan, not a gap report.** The gap report belongs to the Inspection Visit, where it says what could not be reached or completed on a visit that was genuinely trying to complete things.

**The session plan does more work than it was built for.** It was specified as the recurring-visit mechanism. It is now also the visit-one-to-visit-two mechanism, and it carries the targeted inspection list. Increment 4 built the emitter; what it emits grows.

---

## 5. Desk pass one

**Four stages. Every one is confirmation of a proposal, never authorship.** That is the design rule, and it is what makes the difference between forty minutes and four hours.

### 5.1 · Assemble the house

RoomPlan produces rooms; the concierge says how they connect and which floor. **Done once, and it produces the floorplan deliverable.**

### 5.2 · Place the captures

**With position data this is confirmation** — the photographs are already on the plan, each one sitting where it was taken and pointing where it pointed, and the concierge is fixing the ones that drifted. **Without it, this is manual placement of several hundred photographs**, and it is where the desk pass becomes unaffordable.

**That is the whole argument for the Mac.** The difference between confirming three hundred placements and making three hundred placements is the difference between a desk pass that works and one that does not.

*Recorded, not specced:* the fallback without RoomPlan is click-to-place against a room outline, in capture order, which the clockwise walk makes roughly sequential. Usable, not good.

### 5.3 · Identify

**AI reads the photographs and proposes what things are** — *that is a fridge · that is a pod coffee maker · that is an American Standard water heater and the serial reads this.* The concierge accepts, corrects, or rejects.

**This machinery exists.** Increment 2b built it for nameplates: the assist screen, quarantine until signed, one signature per plate, unanimity, abstention as a valid output, the golden set. **It generalises from nameplates to objects**; what changes is the breadth of what is proposed, not the mechanism.

### 5.4 · Confirm what the engine generated

**§6. This is the stage that should feel like reward**, because it is where a pile of photographs becomes a plan for a house. The concierge is reviewing generated work — maintenance items, inspection targets, opportunities, replacement horizons — not creating it.

---

## 5a. Desk pass two

⚑ **New in v1.12, and it was missing rather than wrong.** *Owner-identified. §5 is complete about the pass it describes; a document is not audited against what it omits.*

**Four stages, and the parallel to §5 is deliberate. Every one is still confirmation of a proposal rather than authorship.**

### 5a.1 · Fold in the inspection

**Measurements, test results, operation checks and the concierge's own observations attach to the objects they belong to.** *The objects already exist and are already placed — desk pass one did that. This is attachment, not creation.*

### 5a.2 · Resolve the escalations

⚑ **This is the stage that only exists because of the escalation model, and it is why the two passes are not the same pass twice.**

**Desk pass one attempts every `baseline:desk` item and sends what it cannot resolve to the Inspection Visit's list. Those items now have answers.** ⛑ **And the ones that still do not are named rather than dropped** — *§7 row 9's rule applied to the Binder: a record that silently omits what it does not know is indistinguishable from a complete one.*

### 5a.3 · Generate the Binder

**§6's engine runs against a record that is now as complete as it is going to get.** *The Binder is a render, not an authoring surface.*

### 5a.4 · Draft the plan

⚑ **A draft, and the distinction is load-bearing.** **§3 already rules that visit 3 is a working session rather than a delivery** — *what HouseSteady does, what the homeowner does, what gets scheduled, what gets quoted.* ⛑ **Desk pass two produces the proposal that conversation starts from. It does not decide it.** *§9 rules that coverage is a per-client conversation and not decided in advance; this stage must not quietly become the place it gets decided.*

### ⚑ 5a.5 · The Handover is not gated on completeness — owner-ruled 2026-08-27

**A lingering item does not hold up the Handover.** **Anything unresolved at desk pass two takes one of three routes, decided at this pass and confirmed with the client at visit 3:**

1. **A follow-up inspection**, where enough is outstanding to justify a return.
2. ⚑ **A task on a monthly visit**, with the Binder updated when it lands.
3. **Named as undetermined**, where nobody is going to resolve it and pretending otherwise is worse.

⛑ **Why this is a ruling rather than an operational detail: the retainer begins after Handover.** **A baseline that waits for completeness before handing over delays its own revenue for the least valuable outstanding item in the house.** *And the Binder is a living document by design — an item closed in month two is the record working, not the baseline having failed.*

**Two things this deliberately does not decide.** *Whether desk pass two is one sitting or several, which depends on how long test results take to come back. And who drafts the plan when the concierge and the desk operator are the same person* — ⚑ **they are, at launch; the stage still exists and the handoff is to yourself.**

---

## 6. The engine

**Recognise a thing → know what that kind of thing needs → generate work.**

This is the centre of the design. Everything else serves it.

### 6.1 · The class frame

**A maintenance schedule that lists products grows with the number of products in the world, goes stale silently, and is wrong in the same ways a model would be.** That is the named failure.

**So the schedule declares classes of object and the kinds of care they need — never specific products and intervals.**

Not *Keurig K-Elite → descale every 3 months.* Instead: **pod coffee maker → descaling · water filter · cleaning cycle** — the *categories of maintenance that exist for this class.* AI supplies the model-specific interval, procedure, and detail.

**The list stops growing with the world and starts growing with the number of kinds of thing**, which is small, stable, and ours.

**This is the third instance of a move this project already makes twice:** the Binder Schema is the Master Spec as data — the frame, not the content. The checklist config declares what a visit asks — the frame, not the answers. Same shape, new surface.

**Granularity: roughly that of a trade call.** *Pod coffee maker · fridge · dishwasher · gas water heater · forced-air furnace · sump pump.* Specific enough that maintenance categories are genuinely shared; coarse enough that the list stays in the low hundreds.

**It sits on top of the component types the field config already declares**, rather than being a second vocabulary. Two taxonomies drifting apart is a failure this project has met repeatedly.

### 6.2 · Three things the frame buys that raw AI cannot

**It constrains the question.** *"What maintenance does this Keurig need?"* is open-ended and invites invention. *"This is a pod coffee maker. Descaling: what interval and procedure for a Keurig K-Elite?"* is bounded — a specific question about a known category, which is where a model is strongest and where abstention is cleanest.

**It makes absence visible.** If the class says a gas water heater needs an anode-rod check and the research returns nothing, that is **a gap in the record** rather than a silent nothing. Without the frame there is no way to know a question went unanswered.

**It is where the business judgement lives.** Whether a category is worth raising with a client at all is a decision about what the service covers, and it belongs in a file the owner controls rather than in a model's opinion.

### 6.2a · But a bounded question alone would calcify the frame

**The named failure, and it is one the frame itself creates:** *the class declares descaling, filter and cleaning cycle. A newer model needs a fifth thing. Asking only the declared categories means that fifth thing can never surface — and the frame that stops invention also stops discovery.*

**So every object gets two questions in one call, not one:**

- **Bounded** — for each category this class declares, what is the interval and procedure for this model? Structured, comparable, and a category with no answer is a visible gap.
- **Open** — what else does this specific model need that this list does not cover?

**Anything the open question returns is a proposal against the class, never a fact about the house.** It lands in a review queue: *three water heaters this quarter returned "expansion tank inspection" and the class does not declare it.* The category gets added once, and every future house has it.

**That is the §6.6 feedback loop pointed at the frame instead of the vocabulary** — and it is what makes the class list improve from real houses rather than from someone guessing in advance. Without it, the frame is correct on the day it is written and quietly wrong for years afterwards.

### 6.3 · Four outputs from one lookup

**This is what makes it an engine rather than a maintenance feature.**

| Output | Goes to | Example — gas water heater |
|---|---|---|
| **Maintenance** | The house's maintenance list — **one list, unsplit** | Anode rod interval; sediment flush |
| **Inspection** | The session plan for visit 2 | TPR valve, expansion tank, drain pan |
| **Opportunity** | Concerns, quotes, the trades network | Twelve windows means a cleaning quote; a sump with no backup means a conversation |
| **Replacement horizon** | §19 reserve figure and replacement windows | *Made 2011, these run 8–12 years — a conversation for next year rather than an emergency at 2am* |

**The fourth has the longest reach and is the sentence a homeowner remembers.** It is also why serial decoding is a dependency of a promised deliverable rather than enrichment.

**The maintenance list is one list and it is the client's.** It is not split into homeowner tasks and HouseSteady tasks by the software, because **that split is the conversation at visit three** — item by item, which they want covered and which they will do themselves. Arriving with the division pre-made presumes the answer, and it turns a working session into a presentation. It also risks the wrong impression: a long list already assigned to HouseSteady reads as an invoice rather than as a plan.

### 6.4 · What the schedule declares and what AI supplies

| | Declared in the schedule | Supplied by AI |
|---|---|---|
| **What** | The class · the categories of care that exist for it · whether a category reaches a client at all | Model-specific intervals, procedures, common failure modes, typical lifespan · **and anything the class does not declare** (§6.2a) |
| **Why** | Business judgement, stable, ours | Open-ended, improves as models improve, and gets better without us doing anything |
| **When wrong** | Visible — a category with no answer is a gap | **Abstention is a valid output.** *I do not know* is a correct answer |

**The existing 190 maintenance items are not wasted — they are a content pass in the wrong shape.** They are instances; they want to be classes. The rewrite is smaller than what is there.

### 6.5 · Honesty labels, and the line that gets harder

**Everything AI returns about a specific model is `Inferred`, never `Observed`**, and it renders labelled.

*"Common failure modes include a failed thermocouple"* is research about a product line. It is **not** a statement about this household's water heater. The distinction is identification-versus-assessment wearing new clothes, and **the frame has to hold it, because better research makes overclaiming easier rather than harder** — the same point the Exterior Capture note makes about aerial photographs.

*"This water heater was manufactured in 2011"* — `Documented`, from the nameplate.
*"Units of this type typically last 8–12 years"* — `Inferred`, from research.
*"This water heater is near the end of its life"* — **not ours to say.** The two labelled facts sit next to each other and the homeowner draws the conclusion, or a licensed specialist does.

### 6.6 · The feedback loop — half built, and the missing half named

**When no class fits, the concierge types what the thing is, and the capture proceeds normally.** Fail open on vocabulary is already doctrine: an unclassed object is still captured, still researched, still generates work — it simply does not get the frame's structure until a class exists.

**The first half of the loop exists.** Manifest Contract §7 requires freeform types to export with their verbatim text, flagged distinctly and never collapsed to a bare string, and nicknames to export as their own field — explicitly so that *recurring freeform labels are the signal a new class is warranted.*

**The second half does not exist and this document is the first place to say so.** Nothing aggregates that telemetry across visits. The equipment registry that would do the grouping is named in Manifest Contract §7b as a future product and has never been built. **So the data is preserved and nobody is counting it.**

**Build it from the first house, not from the second concierge.** An earlier draft placed it at the point a second person is capturing, on the reasoning that one person's memory is a substitute until then. **That is wrong, and it is the same mistake in both directions.** The class list has to grow from the first ten houses — that is precisely when the frame is emptiest and the freeform entries most numerous — and memory is exactly what fails: the concierge who typed *wine fridge* in house three will not recall it in house nine, and nothing will have counted it.

**It is also cheap.** Group verbatim freeform labels across imports, count, rank. No new capture, no new field, no client-facing surface — the data already travels by contract. It is a query and a screen.

**Same queue, same shape as §6.2a.** Unclassed objects and open-question returns are both proposals against the frame, they both want the same review, and they both make the class list improve from real houses rather than from guessing.

### 6.7 · What this costs, and where the guardrail goes

**The named failure:** *one unnoticed loop eats the whole house's budget, and then legitimate work is refused while nobody knows why.* **A single aggregate ceiling fails late and fails by punishing the wrong thing.** So the primary guard is per-unit and the house budget is a backstop.

**Batching decides the cost, more than any ceiling does.**

| Work | Batch by | Calls on a five-zone house |
|---|---|---|
| **Identify what things are** | **The room**, not the photograph | ~5–10 |
| **Read a nameplate** | The plate | one per plate |
| **Research an object** | **The object** — bounded and open questions in one call | one per identified object |

**Batching identification by room is the significant one.** Three hundred photographs asked one at a time is three hundred calls; one call per room is five, and it is *more* accurate, because the model sees the room rather than a series of disconnected frames.

**Where loops actually come from.** Not from the schedule questions — those are a fixed list derived from the class, and a fixed list cannot loop. Loops come from retrying: an unparseable response re-asked, an abstention re-prompted, a chain that re-checks its own work. **So the guard belongs on the retry, not on the total.**

- **One retry, then abstain.** An unparseable answer is an abstention, not a reason to ask again. Abstention is already a valid output everywhere else here.
- **A hard call ceiling per object and per room**, so a runaway is contained to one object rather than one house.
- **A per-house budget as the backstop**, reported when hit rather than silently enforced.

**The numbers come from measurement, not from guessing** — and the walk export is the first chance to take it. The structure has to exist before the first real run; the thresholds can be tuned after it. **What cannot be added afterwards is the shape.**

*Recorded, not specced:* tiered models. Identification is cheap-model work; research and nameplate reading want the better one. Already the pattern in the AI Assist Plan.

---

## 7. The Home Profile

**A new client-facing deliverable, between the Discovery Visit and the Inspection Visit.** Emailed ahead, or handed over on arrival at visit 2.

**It is not the Binder and it is not the gap report.** It is *what your home has* — **nine sections:**

| # | Section | What is in it | Fed by |
|---|---|---|---|
| 1 | **The house** | Address, year built, type, heating, water, sewage, key structural facts | Intake + Discovery |
| 2 | **The floorplan** | Room layout, zone names | RoomPlan |
| 3 | **The inventory** | Every object, room by room, with a photograph, make, model, age | Identification passes |
| 4 | **How we know** | Plain-English key to `Documented` · `Reported` · `Observed` · `Inferred` | Doctrine |
| 5 | **The maintenance calendar** | What this house needs and on what rhythm. **One list** — who does what is the visit-three conversation, not something the Profile decides in advance | Class frame care |
| 6 | **Next visit** | What we will look at, and why | Desk pass |
| 7 | **Your questions** | The questions only the household can answer, **with a photograph attached** | The frame's owner questions |
| 8 | **Test results** | Water, radon — whatever is back | Lab |
| 9 | ⚑ **What we could not determine** | **Named gaps, and the heading appears even when the list is empty** | Desk pass |

⚑ **Row 4 is not an afterthought: a homeowner has never heard the word `Inferred`, and a document that labels its own confidence without explaining the labels is worse than one that does not label at all.**

⚑ **Row 9 is the one to protect.** *A Profile that silently omits what it does not know is indistinguishable from a complete one* — **which is this project's signature failure appearing in the client-facing deliverable.** **It also invites the correction that makes the record better for free.**

**Three things it does at once.** It makes the capture visibly *for* something. It invites correction — the client tells you what you got wrong, free. And it means the Inspection Visit begins with a client who already knows what is happening and why.

**A sample version is what the discovery conversation shows** — and it belongs on the website. *This is what you will get.*

**It costs almost nothing to produce if the desk pass is built properly**, because every element is already assembled by §5. That is the test of whether the desk pass is right.

---

## 8. What each track has to change

### Field

⚑ **The per-track build sequence is Build Roadmap §2 and is not restated here.** *It was reported by each Code session, it changes weekly, and a second copy is how two documents disagree.* **What follows is what this document requires of each track, which is a different question from what order it gets built in.**

**And the palette is ruled, 2026-08-12.** **The app is light and on brand — ivory `#FBF8F2` ground, navy `#15223B` text, brass `#BE8A3D` accent.** ⚑ **The reasoning is worth keeping because it is not the argument that was first made:** *capture mode is a viewfinder, and a viewfinder is dark because the picture is the content — that was never a palette question.* **Everywhere else — navigating, the zone picker, showing a homeowner their own house on the screen — is where the brand lives, and those are the moments a client sees the display.** *It lands with the camera rebuild, when the capture screen is being redesigned anyway.*

1. ⛑ **The capture architecture — §4.1a-iii, and it replaces what this line called *RoomPlan*.** **The zone-long session, the floorplan, the mesh decision, and at least one positioned frame per container.** *The native viewfinder is built; this is what remains.*
2. ⛑ **The capture flow is now specified rather than sketched — §4.1a's order and §4.1a-iii.** **Floorplan, then the mesh decision, then the room shot, then containers.** *Standalone voice notes for walking commentary, and the note binds to the previous capture with the filmstrip showing which one it landed on.*
3. **A capture-intent marker** — built. ⚑ **`room-shot` correctly kept its own value rather than being folded into *ordinary*, and that is what made `#124` scoreable at all.** ⛑ ***Pan* is retired as a concierge-facing word (§4.1a); whether the manifest string follows is the field side's call and a rename is not a meaning change.**
4. **One camera per screen.** Capture mode currently renders underneath a floating camera, so there are two photo doors and two video doors on one screen before anything new is added. **When capture mode is active, capture mode owns the camera.**
5. **The zone grid in capture order, oldest first, grouped where the time gaps are large.** ⚑ *Object, plate, plate then arrives as a visual group with nobody naming anything* — which answers *did I get that plate?* without classification, and it is the screen §4.1a stresses hardest.
6. ⚑ **Position on capture — and the rule is inheritance, not per-frame.** **At least one frame per container carries a position; everything else inherits it.** ⛑ **And a paused session cannot supply a container's anchor — enforced, not documented.**
7. **A second visit kind in `scope[]`** — capture items and inspection items are different sets. The mechanism exists and is used; it needs a second value and **a content pass deciding which items sit where.** This is Checklist Master content and therefore owner-authored. **It is the largest single piece of work in this redesign.** ⚑ *And `item.scope` is currently read by no derivation, no screen and no filter, so a perfectly authored monthly list would render identically to the full baseline until something consumes it.*
8. **The session plan import** — already scoped at `PLAN-STAGE-1` §7a and §7a-ii, and now carrying the targeted inspection list rather than a handful of carried gaps. ⚑ **It gains two passengers from this version: the pinned room shot per zone (§4.2), and a reference frame per object (§4.1e).** *Both are cheap while it is being designed and expensive afterwards.*

### Binder builder

1. **The class frame as versioned data**, in `/schema` beside the others.
2. **The research step** — bounded by the class, provenance-tagged, abstention valid, labelled `Inferred`, quarantined until signed.
3. **The desk pass surfaces.** ⚑ **Two passes, not one — assemble, place, identify, confirm for §5, and attachment, escalation-resolution and plan-draft surfaces for §5a.** The Triage surface in Design v1 is the nearest existing thing and it was designed for a different job. ⛑ **This matters now rather than later: Binder stage 10 is unstarted and the 2026-08-26 audit's Band 4 is being treated as its specification — a specification written against half the passes builds half a screen.**
4. **The Home Profile as a render**, alongside the gap report and the Binder.
5. **The session plan grows** to carry the inspection list.
6. **The frame review queue** — freeform labels (§6.6) and open-question returns (§6.2a) in one place, counted and ranked. **From the first house.** Small, and it is the mechanism by which the class list stops being a guess.

---

## 9. What this does not decide

- **Economics.** Three visits before a Binder changes the inputs to a session that was already outstanding. Deliberately not addressed here.
- **Whether the Discovery Visit is separately priced**, or the baseline is one fee across three visits.
- **What HouseSteady covers versus what the homeowner keeps** — a per-client conversation at visit three, informed by the retainer's scope. Not a software decision and not decided in advance.
- **The class list itself** — a content pass, and the largest piece of new content this creates.
- ⛑ ***Which checklist items are capture and which are inspection* leaves this list — it is being decided.** *The F-4 sample ran 2026-08-27 against `mechanical-base` and the split is `baseline:desk` / `baseline:inspection`, on the desk-facing reading ruled 2026-08-08.* ⚑ **v1.12 adds no third value: desk pass two attaches and assembles rather than resolving checklist items.**
- **Concern lifecycle**, which the ratified Object/Concern Model already governs.
- **Anything about monthly visits**, which are unchanged and remain fast and targeted.

---

## 10. Sequencing

⛑ **The binder side led when this was written. It does not now — the native track is the live track and the binder is parked.**

**Done, and it was the standing item here:** the Mac. **Arrived 2026-08-11 and set up 2026-08-13.** ⚑ **What it bought in eight days: `#71` diagnosed and closed after fifteen, the plugin skeleton, the camera in four modes with the object container and document mode, and the device facts that no amount of argument could have produced.** *The floorplan and position remain unbuilt and are Field 6.*

**Start now, because this document settles what capture must record:** the field capture flow. §4.1 names what is recorded — position, an occasional note, standalone commentary, and access as its own category — and nothing downstream changes them. Screens can be built against that.

**Wait for design:** the `scope[]` split, the class frame, the desk pass surfaces, the Home Profile render. These need the class frame designed first, because it decides what the desk pass confirms and what the Profile contains.

**And import the walk export regardless.** It is the first real multi-zone export with media, video, audio and AI interaction, it exercises enormous amounts of code that has never run, and none of its findings depend on any decision in this document. ⚑ **Done 2026-08-09** — 163 files, four calls, zero failures, $0.16 — **and it repaid the exercise immediately by finding that the primary entry point could not insert a job, behind 984 green tests and a clean typecheck.**

**⚑ And one measurement came before its own build, which was unusual enough to name — and it paid.** ⛑ **DONE. The frame bracket (§4.1b) was measured and the answer was not a bracket width: the camera settles 1.6–2.8 seconds on anything that is a thing, so the dwell is the signal.** *Extraction is dwell-anchored rather than window-anchored, and nobody had to guess which side the narration lags on.* ⚑ **The lesson generalises and it is the one the whole fortnight taught: the cheap measurement taken before the build changed the design rather than confirming it.**

---

**Status:** v1.12, service design, owner-ruled. ⛑ *This line read `v1.9` through three cuts — a stale string nobody quoted, corrected 2026-08-27.* ⚑ **§4.1a-i and §4.1a-ii are built and are now instruction. §4.1a-iii is provisional specification and must be re-read when Field 6 lands** — *the banner moved rather than being removed, and it will move again.* The Baseline Inspection Process v1 is rewritten under this.

**Closed since v1.11:** ⚑ **the second desk pass, owner-identified 2026-08-27 and now §5a** · **the Handover-completeness question, ruled at §5a.5**.

**Closed since v1.8:** `#124`, whether the traverse replaces the room shot — **it does not**, owner ruling 2026-08-20 · the frame bracket, **measured, and the answer was the dwell rather than a width**.

**What is open and deliberately not closed here:**
- ⚑ **What the traverse is for** (§4.1a-iv). *It works, its frames are good, and its original job was taken by the container. The run trace is a candidate and so is the mesh. Do not invent a purpose for it.*
- **What the app recommends the mesh on** (§4.1a step 2) — *field-side, and a wrong recommendation costs one tap.*
- **Whether enabling scene reconstruction mid-session costs a reconfiguration** (§4.1a step 2) — *a measurement for Mac Field, not an argument.*
- **The pin surface for a dense room** (§4.1a step 3) — *the floorplan is a new candidate and the room shot is the incumbent.*
- **The marker-accurate ruling** (§4.1a-iii) — *per-container positions make measurement a query, and the millimetre claim is still not supportable.*
