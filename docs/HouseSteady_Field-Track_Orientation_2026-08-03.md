# Field Track — What Changed Since the Walk

**Date:** 2026-08-03
**For:** Field Code, and any field session that arrives after this.
**Why this exists:** the last thing the field track heard was *"still just the walk."* The walk happened on 2026-07-31 and **the service redesigned around what it found.** Reading the Capture Mode spec without this would mean judging it against a model of the project that is a fortnight stale — and the pushback that gets asked for is the pushback that would then be miscalibrated.

**Read before:** `HouseSteady_Field-App_Capture-Mode_BuildSpec_2026-08-03.md`.

---

## 1. What the walk found

**The owner walked five zones — eight, in the end — of his own house on the current build.** It produced 163 media files, config v1.11 exercised for the first time, a `measure` with a value, a `choice`, four videos, six `fine` flags, and the first export anyone has ever taken at real scale.

**And it produced a finding that changed the service:**

> **Capture and inspection do not fit in one visit, and attempting both turns the concierge into a home inspector.**

Capture alone consumed the visit. **Pinning stopped almost immediately** — because pinning is classification, and classification wants a screen, a keyboard and no homeowner standing in the room. The natural motion was *walk in, floorplan the room, move around it in one direction, photograph everything.* Single-shot beat sweep. Every capture wanted a note explaining why it was taken.

**The app pushed the other way.** Every zone screen leads with checklist debt — *35 core open* — and puts the photographs at the bottom.

**None of this came from a design session deciding things.** It came from one person using the app in a real house for three hours, and it is why the pushback invitation in the spec is sincere rather than polite.

---

## 2. The baseline is now three visits

| | |
|---|---|
| **Discovery Visit** | The discovery conversation, then **capture only.** No tests, no measurements, no checklist. Air monitors and water samples deployed — those start clocks rather than assess anything |
| ↓ **the desk pass** | The captures become a house. §4 |
| **Inspection Visit** | Targeted, from a list the desk produced. Every test, measurement and operation lands here |
| **Handover Visit** | The Binder, and **building the ongoing plan with the client** — which items HouseSteady covers, which they keep |

**Between the first two, the client gets a new deliverable: the Home Profile.** The floorplan, the inventory, the maintenance calendar, and what we are looking at next visit. It also answers the thing the owner was worried about — a stranger photographing a family's belongings is strange without context and ordinary with it.

---

## 3. Why capture is now the primary act, not preparation

**This is the part that most changes how the capture spec should be read.**

The binder is building an **engine**: recognise a thing → know what that kind of thing needs → generate work. A class frame declares object classes and the *categories* of care each needs; AI supplies the model-specific detail within them.

**One object captured produces four streams:** maintenance on a rhythm · what to inspect on visit two · opportunities to coordinate or improve · and a replacement horizon against the unit's age.

**So a photograph is no longer evidence for a checklist. It is the input to everything downstream.** The inspection is one consumer of capture, not the thing capture serves.

That is why the spec is so insistent that nothing competes with the camera, and why *"there are four places to put a photograph"* is treated as the failure rather than a minor annoyance.

---

## 4. The desk pass, and why position data decides its cost

Between the visits, someone sits down and: assembles the house from the RoomPlan rooms · places the captures on the plan · confirms what AI proposes each thing is · confirms the work the engine generated.

**Every stage is confirmation of a proposal, never authorship.** That rule is what keeps it a working session rather than a day of data entry.

**And one thing decides whether stage two is confirmation or data entry: position on capture.**

ARKit is already tracking the iPad while RoomPlan runs, and **the tracking does not stop when a photograph is taken.** Record where the concierge stood and which way they pointed and every photograph lands on the plan by itself — the desk fixes what drifted. Without it, somebody places several hundred photographs by hand, and the redesign's economics change.

**This is the single highest-value item in the capture spec**, and it is blocked on hardware rather than design — the owner's current Mac cannot run current Xcode. A new one arrives this week.

---

## 5. What has not changed

**Stated explicitly, because a redesign invites the belief that everything is open.**

**The manifest contract. The pin model. The Object/Concern Model. The Checklist Master's structure. The event log. Offline-first. The export as the completion gate.** All unchanged.

**Pins are not going away** — they move to the Inspection Visit, where a pin is a known object being checked rather than an act of naming. **The checklist is not going away** — it splits into capture items and inspection items, which is one new value in `scope[]` and a content pass, not a new mechanism.

**And the app does not become two apps.** Same data model, same manifest, one mode switch that changes what is foreground.

---

## 6. Governance changed on 2026-08-02

**The two field design sessions were retired and merged into the binder design session.** There is now **one design session across both tracks, and two Code sessions.**

**Why:** of six questions routed to the field design sessions in the preceding week, four were forwarded to you unanswered. **Every substantive correction in that period came from a Code session holding evidence** — you overturning a binder ruling with the measured fact that `has_mechanicals` arrived at v1.6.1; Builder Code refusing to guess `evidence.value`'s wire shape and being right to. **The productive tension is design versus Code, not design versus design**, and a second design session was adding relays with the owner carrying each one.

**What replaces the lost check, explicitly:** *a cross-repo change request is reviewed by the other repo's Code, from the code, before it is built.* **That is stronger than a design session's opinion because it is evidence-based**, and it is already what has been happening.

**The risk worth naming:** one design session that grew up on the binder side may under-weight field constraints without noticing. **You are the check.** Full reasoning is in the Build Roadmap §0.

---

## 7. Where the binder track stands

**Increment 4 closed** — the gap report, the session plan v0 emitter, the editor, the branded render, the house-style lint in the render path, and a signature that is the render gate by shape rather than by flag. 730 tests, 84 doctrine scans.

**Increment 5 is building the engine** — the class frame, identification, research, a property-level pass, and the desk surface that confirms all of it.

**And your walk export is the primary test material for all of it.** A redacted fixture of the manifest lives in the binder repo. It found a four-increment-old bug on first contact: the zone-audit oracle had agreed on every run since Increment 3 and was wrong the whole time, because the old reference export had nothing to fold. **That produced verification rule 11: a check whose distinguishing input is never present has not been passing — it has been idle.**

---

## 8. What is coming to the field track, in order

| | |
|---|---|
| **Now** | The Capture Mode spec. **§7's four defects are independent of everything and can ship first** |
| **Blocked on the Mac** | RoomPlan, and with it position data and the floorplan deliverable |
| **Owner-authored** | **F-4** — splitting the checklist into capture items and inspection items. One new `scope[]` value plus a content pass. **The largest single piece of the redesign** |
| **Waiting on the master reopening** | Table F as machine-readable data (F-9) · shutoff candidates as a capture class (F-18) · register airflow as a measure item (F-19) · the concierge-facing label layer (spec §8) |
| **Later** | The session plan import · manifest v4 with concerns as entities, `activeItems[]` and `status` |

**The full list is `HouseSteady_Field-Change-Request-Register_2026-08-03.md`** — 24 items, maintained by the design session, with what is ready, what is held and why, and what is closed.

---

## 9. How to read the capture spec

**Three things it is explicitly asking you to push back on**, and the invitation is real:

**Mode follows the visit kind and is never a toggle.** If the session model makes that expensive — if visit kind can change mid-session — say so before building.

**The concierge-facing label belongs in the Checklist Master.** The reasoning is that `componentAliases` point *inward*, mapping what a concierge says to a type, and a label points *outward* — same table, opposite direction. **If the master's structure fights that, or the generator would rather carry it, that is your call to make.**

**And position on capture.** If it needs a different capture path than a plain photograph, that changes the loop in §3 and it is much cheaper to know now.

---

**Status:** orientation. Not a specification and nothing is built from it.
