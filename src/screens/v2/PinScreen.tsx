import { useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton, Sheet, formatDuration } from "../../ui/bits";
import { PhotoInput } from "../../capture/PhotoInput";
import { useVoiceRecorder } from "../../capture/useVoiceRecorder";
import { suggestedPinTypes } from "../../engine/v2/checklist";
import type { PinFlag } from "../../engine/v2/events";
import { FlagChip, PinBadge, Thumb, TypePicker, pinTypeLabel } from "./shared";

const FLAGS: PinFlag[] = ["fine", "monitor", "issue"];

/** One pin: the identity everything hangs off — type, flag, photos, notes, placement. */
export function PinScreen({ pinId }: { pinId: string }) {
  const {
    v2Session, v2Config, navigate, setPinType, setPinFlag, retirePin,
    capturePhotoV2, attachVoiceV2, discardMediaV2, addNote, editNote, showToast,
  } = useApp();
  const [typeSheet, setTypeSheet] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);
  const recorder = useVoiceRecorder();

  const pin = v2Session?.pins.find((p) => p.pinId === pinId);
  if (!v2Session || !v2Config || !pin) return null;
  const zone = v2Session.zones.find((z) => z.zoneId === pin.zoneId);
  const back = () =>
    navigate(pin.zoneId ? { name: "zone2", zoneId: pin.zoneId } : { name: "walk" });

  const typeChoices = suggestedPinTypes(v2Config, zone?.zoneType ?? "utility");
  const target = { kind: "pin" as const, id: pinId };
  const notes = pin.noteIds.map((id) => v2Session.notes.get(id)).filter((n) => n !== undefined);

  const stopRecording = async () => {
    const result = await recorder.stop();
    if (result) {
      await attachVoiceV2(target, result.blob, result.mime, result.durationMs);
      showToast("Voice note attached");
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 pb-28">
      <header className="flex items-center gap-3">
        <BigButton variant="ghost" onClick={back}>←</BigButton>
        <PinBadge number={pin.number} />
        <div className="min-w-0 flex-1">
          <button type="button" className="block truncate text-left text-xl font-bold text-teal-300 underline-offset-4 hover:underline" onClick={() => setTypeSheet(true)}>
            {pinTypeLabel(pin.pinType)}
          </button>
          <p className="truncate text-sm text-slate-400">{zone?.label ?? "misc"}{pin.retired ? " · retired" : ""}</p>
        </div>
        <FlagChip flag={pin.flag} />
      </header>

      <section className="flex gap-2">
        {FLAGS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => void setPinFlag(pinId, pin.flag === f ? null : f)}
            className={`flex-1 rounded-xl px-3 py-3 font-semibold ring-1 ${
              pin.flag === f
                ? f === "issue"
                  ? "bg-rose-700 text-white ring-rose-500"
                  : f === "monitor"
                    ? "bg-amber-700 text-white ring-amber-500"
                    : "bg-emerald-700 text-white ring-emerald-500"
                : "bg-slate-800 text-slate-300 ring-slate-600"
            }`}
          >
            {f}
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-300">Photos ({pin.photos.length})</h2>
          <PhotoInput onPhoto={(file) => capturePhotoV2(target, file).then(() => showToast("Photo added"))}>
            Add photo
          </PhotoInput>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {pin.photos.map((m) => (
            <button
              key={m.mediaId}
              type="button"
              onClick={() => {
                if (confirm("Discard this photo?")) void discardMediaV2(m.mediaId);
              }}
              className="overflow-hidden rounded-xl ring-1 ring-slate-700"
            >
              <Thumb mediaId={m.mediaId} className="aspect-square w-full" />
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-300">Notes</h2>
        {notes.map((n) => (
          <div key={n.noteId} className="rounded-xl bg-slate-800 p-3">
            {editingNote?.id === n.noteId ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editingNote.text}
                  onChange={(e) => setEditingNote({ id: n.noteId, text: e.target.value })}
                  rows={3}
                  className="rounded-lg bg-slate-900 p-2 text-slate-100 outline-none ring-1 ring-slate-600"
                />
                <div className="flex gap-2">
                  <BigButton
                    variant="secondary"
                    onClick={() => {
                      void editNote(n.noteId, editingNote.text.trim()).then(() => setEditingNote(null));
                    }}
                  >
                    Save
                  </BigButton>
                  <BigButton variant="ghost" onClick={() => setEditingNote(null)}>Cancel</BigButton>
                </div>
              </div>
            ) : (
              <button type="button" className="w-full text-left" onClick={() => setEditingNote({ id: n.noteId, text: n.text })}>
                <p className="whitespace-pre-wrap text-slate-100">{n.text}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(n.at).toLocaleTimeString()}{n.editedAt ? " · edited" : ""}</p>
              </button>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Type or dictate a note…"
            rows={2}
            className="flex-1 rounded-xl bg-slate-800 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
          />
          <BigButton
            variant="secondary"
            disabled={!noteDraft.trim()}
            onClick={() => {
              void addNote(target, noteDraft.trim()).then(() => setNoteDraft(""));
            }}
          >
            Add
          </BigButton>
        </div>
      </section>

      <section className="flex items-center justify-between gap-3 rounded-xl bg-slate-800 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200">
            Audio evidence{pin.voiceNotes.length > 0 ? ` (${pin.voiceNotes.map((v) => formatDuration(v.durationMs ?? 0)).join(", ")})` : ""}
          </p>
          <p className="text-xs text-slate-500">For sounds — a rattling fan, a banging pipe. Notes are better typed or dictated above.</p>
        </div>
        {recorder.state === "recording" ? (
          <BigButton variant="danger" onClick={() => void stopRecording()}>
            Stop {formatDuration(recorder.elapsedMs)}
          </BigButton>
        ) : (
          <BigButton
            variant="secondary"
            disabled={recorder.state === "unsupported"}
            onClick={() => void recorder.start()}
          >
            Record
          </BigButton>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-300">Placement ({pin.anchors.length} anchor{pin.anchors.length === 1 ? "" : "s"})</h2>
        {zone && zone.canvases.filter((c) => !c.retired).length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {zone.canvases.filter((c) => !c.retired).map((c) => (
              <button
                key={c.canvasId}
                type="button"
                onClick={() => navigate({ name: "canvas", canvasId: c.canvasId, zoneId: zone.zoneId, placePinId: pinId })}
                className="relative shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-600"
              >
                <Thumb mediaId={c.media.mediaId} className="h-24 w-36" />
                <span className="absolute inset-x-0 bottom-0 bg-slate-950/70 py-0.5 text-center text-xs text-teal-300">
                  {pin.anchors.some((a) => a.canvasId === c.canvasId) ? "placed — tap to add another" : "tap to place here"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-400">
            {pin.zoneId ? "Add a canvas to the zone first, then place this pin on it." : "Assign this pin to a zone to place it."}
          </p>
        )}
      </section>

      <BigButton
        variant="ghost"
        onClick={() => {
          if (confirm(`Retire pin #${pin.number}? Its number is never reused; the record stays.`))
            void retirePin(pinId).then(back);
        }}
      >
        Retire pin
      </BigButton>

      <Sheet open={typeSheet} onClose={() => setTypeSheet(false)} title={`Type for pin #${pin.number}`}>
        <TypePicker
          choices={typeChoices}
          current={pin.pinType}
          onPick={(pinType) => void setPinType(pinId, pinType).then(() => setTypeSheet(false))}
        />
      </Sheet>
    </div>
  );
}
