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
  const [pending, setPending] = useState<{ file: File | Blob; durationMs?: number } | null>(null);
  const [switching, setSwitching] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [newType, setNewType] = useState<string | null>(null);
  const [newLevel, setNewLevel] = useState<string>("main");
  const recorder = useVoiceRecorder();

  if (!v2Session || !v2Config) return null;

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
    const { file, durationMs } = pending;
    setPending(null);
    void capturePhotoV2({ kind: "zone", id: zone.zoneId }, file, undefined, durationMs)
      .then((mediaId) => (note ? captionMedia(mediaId, note) : undefined))
      .catch((e) => showToast(e instanceof Error ? e.message : "Could not save"));
  };

  // No zone yet: the one thing to do is start where you're standing (§6).
  if (!zone) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold text-slate-100">Start where you're standing</h1>
        <p className="text-sm text-slate-400">Name the room you're in and start photographing it.</p>
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

  const media = [...zone.photos].reverse(); // most recent first (§2)

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
        {/* §0.4: the export is the completion gate — a visit is not done until it is out
            of the app. In capture mode there is no walk list to go back to, so the only exit
            leads where the visit actually ends. */}
        <BigButton variant="ghost" onClick={() => navigate({ name: "export2" })}>
          Finish
        </BigButton>
      </header>

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

      {/* The camera, as the dominant and obvious action (§2). */}
      <PhotoInput onPhoto={(file) => setPending({ file })}>
        <span className="text-lg">📷 Photograph this room</span>
      </PhotoInput>

      <div className="flex gap-2">
        <VideoInput onVideo={(file, ms) => setPending({ file, durationMs: ms })}>Video</VideoInput>
        {/* Standalone voice note, from anywhere in capture mode (§3). The concierge is
            already talking; the transcript is orientation the desk cannot otherwise get. */}
        <BigButton variant="secondary" className="flex-1" onClick={() => setVoiceOpen(true)}>
          Voice note
        </BigButton>
      </div>

      {media.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-400">
          Nothing photographed here yet.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {media.map((m) => (
            <button key={m.mediaId} type="button" onClick={() => setViewing(m.mediaId)}>
              <MediaThumb mediaId={m.mediaId} mime={m.mime} durationMs={m.durationMs} className="h-24 w-full" />
            </button>
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
