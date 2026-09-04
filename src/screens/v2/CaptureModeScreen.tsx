/**
 * Capture mode (Capture Mode spec §2 and §3) — the Discovery Visit's whole screen.
 *
 * WHY THIS IS A SEPARATE FILE rather than a flag on ZoneV2Screen. §2.1 says the checklist,
 * tests, open counts, pins and the canvas concept are **absent** — "not hidden behind a tab,
 * not collapsed". A conditional inside the zone screen would leave every count one boolean
 * away from reappearing, and the counts are woven through that screen. Absent is structural:
 * this file simply never imports ChecklistPanel, auditSnapshot, or anything that can produce
 * an open-item number. That is the refactor, and it is the whole point.
 *
 * The named failure it exists to prevent, from the 2026-07-31 walk: every zone screen led
 * with "35 core open" and put the photographs at the bottom, so the concierge worked the debt
 * instead of seeing the house, and pinning stopped within the hour. On a Discovery Visit that
 * number is meaningless — nothing was supposed to be resolved.
 *
 * ONE DESTINATION (§3). A capture here goes to the current zone and nowhere else: no pin
 * evidence, no canvas, no inbox. The deciding is the cost, not the tapping.
 */
import { useMemo, useState } from "react";
import { useApp } from "../../store/sessionStore";
import { PhotoInput, VideoInput } from "../../capture/PhotoInput";
import { useVoiceRecorder } from "../../capture/useVoiceRecorder";
import { BigButton, Sheet } from "../../ui/bits";
import { MediaThumb, MediaViewer, ZONE_LEVELS } from "./shared";
import { cameraAvailable } from "../../native/hsCamera";
import { zoneGaps } from "../../native/zone";
import type { ChecklistConfig } from "../../engine/schema/checklistConfig";
import type { CaptureIntent } from "../../engine/v2/events";

/** Door styling. The primary reads as dominant (§2); the declared kinds sit under it. */
const PRIMARY_DOOR =
  "min-h-16 rounded-xl bg-brass-500 px-5 text-lg font-semibold text-slate-950 transition-colors active:bg-brass-400";
const SECONDARY_DOOR = "min-h-14 rounded-xl bg-slate-700 px-3 text-base text-slate-100 transition-colors active:bg-slate-600";

// Dismissal is UI state, not inspection data — localStorage, never the event log, exactly as
// ChatPanel's per-pin collapse. Keyed by session so dismissing it on one visit says nothing
// about the next, and so it survives switching between zones (the screen remounts on every
// zone change, and a prompt that reappeared each time would be the nagging this must not be).
const promptKey = (sessionId: string) => `hs-intake-prompt-dismissed:${sessionId}`;
const readDismissed = (sessionId: string): boolean => {
  try {
    return localStorage.getItem(promptKey(sessionId)) === "1";
  } catch {
    return false;
  }
};
const writeDismissed = (sessionId: string): void => {
  try {
    localStorage.setItem(promptKey(sessionId), "1");
  } catch {
    /* private mode — it just won't stay dismissed */
  }
};

/**
 * Which intake flags are worth pointing a camera at.
 *
 * Once Table A declares `consumers` the answer is data: show the ones read in the field.
 * Until then show them all — an honest superset, and deliberately NOT a list of
 * capture-worthy ids written into this screen. A hardcoded subset here would be a second
 * vocabulary beside the config, which is the drift the config-is-data discipline exists to
 * prevent; the same rule that makes the zone-close picker read `naReasons`.
 *
 * The "once declared, it is closed" shape is already used by Table H's unit check.
 */
export function capturePromptFlags(
  config: Pick<ChecklistConfig, "propertyFlags">,
  sessionFlags: readonly string[],
): { id: string; label: string }[] {
  const selected = config.propertyFlags.filter((f) => sessionFlags.includes(f.id));
  const declared = config.propertyFlags.some((f) => f.consumers?.length);
  return (declared ? selected.filter((f) => f.consumers?.includes("field")) : selected).map((f) => ({
    id: f.id,
    label: f.label,
  }));
}

/**
 * The intake capture prompt (State of Understanding v3 §2; owner 2026-08-08).
 *
 * *The household mentioned a pool, an EV charger.* This is the attention-directing function
 * the checklist used to perform and nothing has replaced — the walk's failure was not that
 * the concierge lacked a list, it was that the list was **debt**.
 *
 * So: INFORMATION, NEVER DEBT. No count, no resolvable state, nothing to tick, and it gates
 * nothing. It cannot tell whether the pool was photographed and deliberately does not try —
 * **completeness is proposed by the desk** (owner ruling). Tracking it here would rebuild the
 * open-count that ended the walk, with a friendlier label.
 *
 * Walk-top and dismissible, not per-zone: a fixed list repeated on every screen reads as a
 * list to clear, which is the same failure arriving through a different door.
 */
function IntakePrompt({ flags, onDismiss }: { flags: { id: string; label: string }[]; onDismiss: () => void }) {
  if (!flags.length) return null;
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-200">The household mentioned</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 ring-1 ring-slate-600"
        >
          Dismiss
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {flags.map((f) => (
          <span key={f.id} className="rounded-full bg-slate-900 px-3 py-1 text-sm text-slate-200 ring-1 ring-slate-600">
            {f.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-500">Nothing to tick. Worth a photograph if you pass one.</p>
    </section>
  );
}

/**
 * How long a pause has to be before the grid treats it as the end of one object's string.
 *
 * The §4.1a sequence — whole object, plate, plate, fittings, indicator — is a burst of
 * seconds; walking to the next object takes longer. So a gap is where a string probably
 * ended, and drawing the break makes *object, plate, plate* read as a group **with nobody
 * naming anything**. Grouping without classification is the whole point.
 *
 * A guessed constant is acceptable here precisely because nothing depends on it: this is
 * rendering only. It is never exported, never counted, and gates nothing — the manifest
 * carries capture order and the desk proposes the grouping (register #109). Wrong threshold,
 * slightly different screen, identical record.
 */
export const RUN_GAP_MS = 60_000;

/**
 * Split captures into visual runs at large time gaps, oldest first (owner ruling 2026-08-11).
 *
 * Sorts rather than trusting array order: `MediaReassigned` re-appends a ref at the tail, so
 * a re-filed capture would otherwise render at the end of the room instead of where it was
 * taken. uuidv7 mediaIds are lexicographically time-ordered, which settles same-instant ties
 * — one storage transaction stamps `at` once for every event in it, so ties are real.
 */
export function groupIntoRuns<T extends { at: string; mediaId: string }>(
  media: readonly T[],
  gapMs: number = RUN_GAP_MS,
): [T, ...T[]][] {
  const sorted = [...media].sort((a, b) =>
    a.at === b.at ? a.mediaId.localeCompare(b.mediaId) : a.at < b.at ? -1 : 1,
  );
  // Non-empty by construction — every run is opened as `[m]` — and typed that way so callers
  // can key on run[0] without a guard that could never fire.
  const runs: [T, ...T[]][] = [];
  for (const m of sorted) {
    const run = runs[runs.length - 1];
    const prev = run?.[run.length - 1];
    // An unparseable timestamp yields NaN, and NaN > gapMs is false — so it joins the current
    // run rather than starting a spurious one. Degrading into the neighbouring group is the
    // harmless direction.
    if (!run || !prev || new Date(m.at).getTime() - new Date(prev.at).getTime() > gapMs) runs.push([m]);
    else run.push(m);
  }
  return runs;
}

/** The three-button post-capture step (§3). The third fires on roughly one capture in ten,
 *  so it is present and unobtrusive rather than prominent. */
function PostCapture({
  file,
  durationMs,
  onUse,
  onRetake,
}: {
  file: File | Blob;
  durationMs?: number;
  onUse: (note?: string) => void;
  onRetake: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const [noteMode, setNoteMode] = useState(false);
  const [note, setNote] = useState("");
  const isVideo = (file as File).type?.startsWith("video");

  return (
    <Sheet open title="Keep this?" onClose={onRetake}>
      <div className="flex flex-col gap-3">
        {isVideo ? (
          <video src={url} controls playsInline className="max-h-[45vh] w-full rounded-xl bg-black" />
        ) : (
          <img src={url} alt="just captured" className="max-h-[45vh] w-full rounded-xl object-contain" />
        )}
        {noteMode ? (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoFocus
              rows={3}
              placeholder="Why this photo — type or dictate"
              className="rounded-xl bg-slate-900 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-brass-500"
            />
            <BigButton onClick={() => onUse(note.trim() || undefined)}>Save photo and note</BigButton>
            <BigButton variant="ghost" onClick={() => setNoteMode(false)}>
              Back
            </BigButton>
          </>
        ) : (
          <>
            <BigButton onClick={() => onUse()}>Use {isVideo ? "video" : "photo"}</BigButton>
            <div className="flex gap-2">
              <BigButton variant="secondary" className="flex-1" onClick={onRetake}>
                Retake
              </BigButton>
              <BigButton variant="secondary" className="flex-1" onClick={() => setNoteMode(true)}>
                Use and add note
              </BigButton>
            </div>
          </>
        )}
        {durationMs ? <p className="text-xs text-slate-500">{Math.round(durationMs / 1000)}s</p> : null}
      </div>
    </Sheet>
  );
}

export function CaptureModeScreen({ zoneId }: { zoneId?: string }) {
  const { v2Session, v2Config, navigate, capturePhotoV2, captionMedia, createZone, showToast } = useApp();
  const [pending, setPending] = useState<{ file: File | Blob; durationMs?: number; intent?: CaptureIntent } | null>(
    null,
  );
  const [switching, setSwitching] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [newType, setNewType] = useState<string | null>(null);
  const [newLevel, setNewLevel] = useState<string>("main");
  const [promptDismissed, setPromptDismissed] = useState(() =>
    v2Session ? readDismissed(v2Session.sessionId) : false,
  );
  const recorder = useVoiceRecorder();

  if (!v2Session || !v2Config) return null;

  const promptFlags = promptDismissed
    ? []
    : capturePromptFlags(v2Config, v2Session.propertyFlags);
  const dismissPrompt = () => {
    writeDismissed(v2Session.sessionId);
    setPromptDismissed(true);
  };

  const zones = v2Session.zones;
  const zone = zones.find((z) => z.zoneId === zoneId) ?? zones[zones.length - 1];

  /** §2: a count that means something on THIS VISIT — photographs taken, zones walked.
   *  Never open items. This is the one number capture mode is allowed to show. */
  const shotsThisVisit =
    zones.reduce((n, z) => n + z.photos.length, 0) + v2Session.pins.reduce((n, p) => n + p.photos.length, 0);

  /**
   * The note travels ON the photograph, not beside it (Amendment 10 §D).
   *
   * This first wrote the note as a zone-scoped NoteAdded, which was wrong in a way that
   * defeated the point: a dozen photographs in a mechanical room and a dozen zone notes with
   * no correspondence between them. The failure it exists to prevent is exactly that — a
   * shot the owner framed deliberately to show a chlorine injection point, read downstream as
   * a corner of a room, because the intent lived in his head and nowhere in the file. Putting
   * it in the file *near* the photograph does not fix it; whoever identifies the object is
   * looking at one image.
   *
   * `MediaCaptioned` is the mechanism built for this and it rides through to
   * `manifest.media[].caption`, so the caption reaches the identification call attached to
   * the frame it explains.
   *
   * "The capture moment is the only time intent is free" — after it, intent is reconstructed.
   */
  const save = (note?: string) => {
    if (!pending || !zone) return;
    const { file, durationMs, intent } = pending;
    setPending(null);
    void capturePhotoV2({ kind: "zone", id: zone.zoneId }, file, undefined, durationMs, intent)
      .then((mediaId) => (note ? captionMedia(mediaId, note) : undefined))
      .catch((e) => showToast(e instanceof Error ? e.message : "Could not save"));
  };

  // No zone yet: the one thing to do is start where you're standing (§6).
  if (!zone) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold text-slate-100">Start where you're standing</h1>
        <p className="text-sm text-slate-400">Name the room you're in and start photographing it.</p>
        {/* Walk-top, and this IS the top of the walk — the first screen of a Discovery Visit,
            before any zone exists. */}
        <IntakePrompt flags={promptFlags} onDismiss={dismissPrompt} />
        <BigButton onClick={() => setSwitching(true)}>Add a zone</BigButton>
        {switching && (
          <ZoneSheet
            zoneTypes={v2Config.zoneTypes}
            level={newLevel}
            setLevel={setNewLevel}
            typeId={newType}
            setTypeId={setNewType}
            onClose={() => setSwitching(false)}
            onCreate={(typeId, label, level) =>
              createZone(typeId, label, {}, level).then((id) => {
                setSwitching(false);
                navigate({ name: "zone2", zoneId: id });
              })
            }
          />
        )}
      </div>
    );
  }

  const media = zone.photos;
  const runs = groupIntoRuns(media);

  /*
    ⛑ **What this room is missing, said in the room** (design ruling 2026-09-01).

    The full bath left the house with four objects, 34 photographs, six plate reads and **nothing to
    place any of it on** — its floorplan was lost to a sensor failure mid-stop and the room looked
    finished from inside the app. *Nobody knew until the desk opened the file two days later.*

    ⚑ A gap discovered at the desk costs a second visit; the same gap named in the room costs a
    minute. **It reports and never blocks** — a garage that genuinely needs no floorplan is a
    legitimate zone and the concierge must be able to walk away from it.

    ⚑ *This is also the reader `containerAnchorState` has been waiting for.* It has been computed,
    exported and tested since Field 6 and called by no screen — rule 43, named by the owner and by
    the design session's own §8 audit. **The question it answers is exactly the one this banner
    asks**, so it is wired here rather than reimplemented.
  */
  const gaps = zoneGaps({
    photos: zone.photos.length + v2Session.pins.filter((p) => p.zoneId === zone.zoneId).reduce((n, p) => n + p.photos.length, 0),
    hasFloorplan: zone.photos.some((m) => m.intent === "floorplan"),
    containers: v2Session.pins
      .filter((p) => p.zoneId === zone.zoneId)
      .map((p) => ({ frames: p.photos.map((m) => ({ position: m.position as never })) })),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      {/* The current zone, named and large. No open count, no checklist, no pins. */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold text-slate-100">{zone.label}</h1>
          <p className="text-sm text-slate-400">
            {zone.photos.length} here · {shotsThisVisit} this visit · {zones.length} zone
            {zones.length === 1 ? "" : "s"} walked
          </p>
        </div>
        {/*
          §0.4: the export is the completion gate — a visit is not done until it is out of the app,
          so `Finish` leads where the visit actually ends.

          ⚑ **But it was the ONLY exit, and that made leaving a room indistinguishable from ending
          the visit** (owner report, 2026-08-16 evening). The reasoning was that capture mode has
          no walk list to go back to — true, and it does not follow that there is nowhere to go.
          Home is a real place and the viewfinder has always had a button to it; the screen between
          them did not. A concierge who wanted to put the iPad down for a minute had one control
          and it exported the visit.

          Leaving does not end anything: the events are already on disk and the zone is still open
          when they come back. That is exactly why this is a `ghost` beside `Finish` rather than a
          confirm — there is nothing to confirm.
        */}
        <div className="flex shrink-0 items-center gap-2">
          <BigButton variant="ghost" onClick={() => navigate({ name: "home" })}>
            Home
          </BigButton>
          <BigButton variant="ghost" onClick={() => navigate({ name: "export2" })}>
            Finish
          </BigButton>
        </div>
      </header>

      {/* Above the zone switcher and the camera, so it reads before the walk starts and is
          out of the way once dismissed. Dismissal persists for the visit. */}
      <IntakePrompt flags={promptFlags} onDismiss={dismissPrompt} />

      {/* Fast switcher to any other zone, and a fast way to add one (§2). */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {zones.map((z) => (
          <button
            key={z.zoneId}
            type="button"
            onClick={() => navigate({ name: "zone2", zoneId: z.zoneId })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
              z.zoneId === zone.zoneId
                ? "bg-brass-600 text-white ring-brass-500"
                : "bg-slate-800 text-slate-300 ring-slate-600"
            }`}
          >
            {z.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSwitching(true)}
          className="shrink-0 rounded-full bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 ring-1 ring-slate-600"
        >
          + zone
        </button>
      </div>

      {/*
        The camera, as the dominant and obvious action (§2). Ordinary capture — no intent.

        ⚑ ONE DOOR, TWO FRAME SOURCES. In the native shell it opens the stay-open viewfinder,
        which is where the modes, the live read and the object containers live; in the browser it
        is `<input capture>` and always will be. That split is CLAUDE.md's rule — *do not spend
        effort on browser-side capture parity* — and it is why the difference is one branch at
        the door rather than two implementations of the act.
      */}
      {cameraAvailable() ? (
        <BigButton className={PRIMARY_DOOR} onClick={() => navigate({ name: "camera2", zoneId: zone.zoneId })}>
          📷 Photograph this room
        </BigButton>
      ) : (
        <PhotoInput onPhoto={(file) => setPending({ file })} className={PRIMARY_DOOR}>
          📷 Photograph this room
        </PhotoInput>
      )}

      {/*
        The three declared capture kinds (§4.1a, §4.1b), one door each.

        INTENT LIVES ON THE DOOR, never on the confirm sheet. A post-capture "what was that?"
        is a decision per capture, and §3 says the deciding is the cost — not the tapping. And
        choosing a door is not classification: it says what the concierge is about to do, not
        what the thing in front of them is. Nothing here asks what anything IS.

        Room shot vs traverse needs no expertise, and the labels are the rule: one frame if the
        room fits, a continuous sweep if it does not.

        ⛑ **The word was *Pan* and *pan* is retired — owner ruling 2026-08-20.** The capture is the
        **traverse**. ⚑ **The id is untouched**: `intent: "pan"` is what the native traverse already
        files under, and retirements are about instructions, never ids. Renaming the id would break
        every capture already exported under it to fix a word on a button.
      */}
      {!gaps.complete && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300 ring-1 ring-amber-500/40">
          <span className="font-medium">Before you leave this room:</span> {gaps.missing.join(" · ")}.
          {" "}
          <span className="text-amber-400/70">Fixable here; costs a visit later.</span>
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {/* ⚑ **A zone-entry act, and it fires where the camera is.** The room shot happens once, at
            the start of a zone — so its door belongs here rather than in the row the concierge hits
            forty times. It opens the viewfinder already framed wide, because it is a sibling pair
            whose 1× frame carries a measured position and that can only happen where the session
            is. The door moved; the act did not. */}
        {cameraAvailable() ? (
          <BigButton
            variant="secondary"
            className={SECONDARY_DOOR}
            onClick={() => navigate({ name: "camera2", zoneId: zone.zoneId, startAction: "room-shot" })}
          >
            🖼 Room shot
          </BigButton>
        ) : (
          <PhotoInput onPhoto={(file) => setPending({ file, intent: "room-shot" })} className={SECONDARY_DOOR}>
            🖼 Room shot
          </PhotoInput>
        )}
        {/* ⛑ **This was a photo-LIBRARY picker** (field report 2026-08-29: *"the traverse button
            does nothing when pressed"*). It was `<PhotoInput fromLibrary>` filing `intent: "pan"` —
            it never touched `startTraverse`, never locked exposure, never registered a pair. ⚑ *The
            native traverse has existed and shipped for a fortnight, in the viewfinder, behind a
            button this door did not lead to.*

            Same defect as Paper below and the same cause: a browser-path control left standing on
            the native shell where a native door belongs. Room shot got its native door; these two
            did not. The browser arm stays — it is the control, not the shipping surface. */}
        {cameraAvailable() ? (
          <BigButton
            variant="secondary"
            className={SECONDARY_DOOR}
            onClick={() => navigate({ name: "camera2", zoneId: zone.zoneId, startAction: "traverse" })}
          >
            ↔ Traverse
          </BigButton>
        ) : (
          <PhotoInput
            onPhoto={(file) => setPending({ file, intent: "pan" })}
            fromLibrary
            className={SECONDARY_DOOR}
          >
            ↔ Traverse
          </PhotoInput>
        )}
        {/* §4.1d. Manuals, invoices, permits, the well record — photographed whether or not
            anyone knows what they are, which is §4.1a's rule applied to paper. It files to the
            current zone like everything else, which records the drawer it came out of.

            ⛑ **One capability, two front doors, and this was the one that could not read**
            (design ruling 2026-08-29). The viewfinder's Document mode finds the page, flattens it
            and runs accurate text recognition on the result; this button took a flat photograph of
            a curled invoice at an angle and filed it as a document. **The door that reads wins**,
            which is the design session's own test. Native goes to the viewfinder in Document mode;
            the browser arm keeps the plain capture, because there is no page-finder there either. */}
        {cameraAvailable() ? (
          <BigButton
            variant="secondary"
            className={SECONDARY_DOOR}
            onClick={() => navigate({ name: "camera2", zoneId: zone.zoneId, startAction: "document" })}
          >
            📄 Paper
          </BigButton>
        ) : (
          <PhotoInput onPhoto={(file) => setPending({ file, intent: "document" })} className={SECONDARY_DOOR}>
            📄 Paper
          </PhotoInput>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <VideoInput onVideo={(file, ms) => setPending({ file, durationMs: ms })} className={SECONDARY_DOOR}>
          🎥 Video
        </VideoInput>
        {/* ⛑ **The run-trace VIDEO door is retired** (owner ruling 2026-08-29). *A video that
            measures nothing, carries no position and nobody watches is the worst of all three —
            expensive to store, expensive to send, and it answers nothing the stills do not.*

            ⚑ The **traverse** takes the job: it registers frame to frame, it will carry world
            anchors at each leg boundary, and its frames are stills a desk can actually read. The
            `run-trace` **intent value stays valid** — ids are never retired or reused, and captures
            already filed under it keep their meaning. Only the door goes. `captureTargetFor`'s
            run-trace branch stays for the same reason: *a trace starts inside a container and ends
            outside it*, and that rule outlives the video that first needed it. */}
        {/* Standalone voice note, from anywhere in capture mode (§3). The concierge is
            already talking; the transcript is orientation the desk cannot otherwise get. */}
        <BigButton variant="secondary" className={SECONDARY_DOOR} onClick={() => setVoiceOpen(true)}>
          🎙 Voice
        </BigButton>
      </div>

      {/*
        ⚑ **Floorplan and mesh are ACTIONS of this zone, and they belong here** — beside room shot
        and run trace — because this screen is where the concierge already declares which room they
        are in. The viewfinder is where the camera is, so the door is here and the act happens
        there; that is the same split `Photograph this room` already uses.

        ⛑ **And there is no *enter the zone* anywhere.** The zone was entered by tapping its chip on
        this screen. A second entry gesture in the viewfinder asked the concierge to declare
        something the app already knew, and put a second meaning on a word this product had already
        spent. Two things sharing one word is what retired *pan* and renamed the Text mode.

        Native only: both are ARKit, and the browser path has no session to start. Absent rather
        than disabled — a door that cannot open is not a door.
      */}
      {cameraAvailable() && (
        <div className="grid grid-cols-2 gap-2">
          <BigButton
            variant="secondary"
            className={SECONDARY_DOOR}
            onClick={() => navigate({ name: "camera2", zoneId: zone.zoneId, startAction: "floorplan" })}
          >
            📐 Floorplan
          </BigButton>
          <BigButton
            variant="secondary"
            className={SECONDARY_DOOR}
            onClick={() => navigate({ name: "camera2", zoneId: zone.zoneId, startAction: "mesh" })}
          >
            🧊 Mesh
          </BigButton>
        </div>
      )}

      {runs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-400">
          Nothing photographed here yet.
        </p>
      ) : (
        /*
         * Capture order, oldest first, broken into runs at large gaps (owner ruling
         * 2026-08-11). No labels and no counts — the break IS the whole signal, so *object,
         * plate, plate* arrives as a visual group without anybody having named a thing.
         */
        <div className="flex flex-col gap-3">
          {runs.map((run) => (
            <div key={run[0].mediaId} className="grid grid-cols-3 gap-2">
              {run.map((m) => (
                <button key={m.mediaId} type="button" onClick={() => setViewing(m.mediaId)}>
                  <MediaThumb mediaId={m.mediaId} mime={m.mime} durationMs={m.durationMs} className="h-24 w-full" />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {pending && (
        <PostCapture
          file={pending.file}
          durationMs={pending.durationMs}
          onUse={save}
          onRetake={() => setPending(null)}
        />
      )}

      {viewing &&
        (() => {
          const m = media.find((x) => x.mediaId === viewing);
          return m ? (
            <Sheet open title="Capture" onClose={() => setViewing(null)}>
              <MediaViewer mediaId={m.mediaId} mime={m.mime} />
            </Sheet>
          ) : null;
        })()}

      {voiceOpen && (
        <Sheet open title="Voice note" onClose={() => setVoiceOpen(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-400">
              Spoken orientation for the desk — “basement, going clockwise, this wall is the mechanical side.”
            </p>
            {recorder.state === "recording" ? (
              <BigButton
                variant="danger"
                onClick={() =>
                  void recorder.stop().then((rec) => {
                    setVoiceOpen(false);
                    if (rec)
                      void capturePhotoV2({ kind: "zone", id: zone.zoneId }, rec.blob, rec.mime, rec.durationMs);
                  })
                }
              >
                Stop ({Math.round(recorder.elapsedMs / 1000)}s)
              </BigButton>
            ) : (
              <BigButton onClick={() => void recorder.start()}>Record</BigButton>
            )}
          </div>
        </Sheet>
      )}

      {switching && (
        <ZoneSheet
          zoneTypes={v2Config.zoneTypes}
          level={newLevel}
          setLevel={setNewLevel}
          typeId={newType}
          setTypeId={setNewType}
          onClose={() => setSwitching(false)}
          onCreate={(typeId, label, level) =>
            createZone(typeId, label, {}, level).then((id) => {
              setSwitching(false);
              navigate({ name: "zone2", zoneId: id });
            })
          }
        />
      )}
    </div>
  );
}

/**
 * Zone creation, kept fast (§6). Attributes are deliberately NOT asked here: they are
 * classification, classification wants a screen and a keyboard, and asking four toggles per
 * room is the friction capture mode exists to remove. They are set at the desk or in
 * inspection mode, and an unset attribute is honestly absent rather than a false `false`
 * (F-20 — the walk's bedroom recorded `finished: false, sleeping: false` from untouched
 * toggles, and the binder can never read those as decisions).
 */
function ZoneSheet({
  zoneTypes,
  level,
  setLevel,
  typeId,
  setTypeId,
  onClose,
  onCreate,
}: {
  zoneTypes: { id: string; typicalLabels: string[] }[];
  level: string;
  setLevel: (l: string) => void;
  typeId: string | null;
  setTypeId: (t: string | null) => void;
  onClose: () => void;
  onCreate: (typeId: string, label: string, level: string) => Promise<unknown>;
}) {
  const [label, setLabel] = useState("");
  const selected = zoneTypes.find((t) => t.id === typeId);
  return (
    <Sheet open title="Start where you're standing" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {zoneTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTypeId(t.id)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ring-1 ${
                typeId === t.id
                  ? "bg-brass-600 text-white ring-brass-500"
                  : "bg-slate-800 text-slate-300 ring-slate-600"
              }`}
            >
              {t.typicalLabels[0] ?? t.id}
            </button>
          ))}
        </div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={selected?.typicalLabels[0] ?? "Name this room"}
          className="rounded-xl bg-slate-900 p-3 text-lg text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-brass-500"
        />
        <div className="flex flex-wrap gap-2">
          {[...ZONE_LEVELS].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              className={`rounded-lg px-3 py-1.5 text-sm ring-1 ${
                level === l ? "bg-slate-700 text-slate-100 ring-slate-500" : "bg-slate-800 text-slate-400 ring-slate-700"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <BigButton
          disabled={!typeId}
          onClick={() => {
            if (!typeId) return;
            void onCreate(typeId, label.trim() || selected?.typicalLabels[0] || typeId, level);
          }}
        >
          Start here
        </BigButton>
      </div>
    </Sheet>
  );
}
