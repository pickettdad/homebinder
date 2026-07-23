import { useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton, Sheet, formatDuration } from "../../ui/bits";
import type { MediaRef } from "../../engine/v2/fold";
import { PinRow, Thumb } from "./shared";

/** Session inbox: shoot first, file when hands are free. Everything is retaggable. */
export function InboxScreen() {
  const { v2Session, navigate, reassignMedia, createPin, showToast } = useApp();
  const [assigning, setAssigning] = useState<MediaRef | null>(null);
  const [busy, setBusy] = useState(false);

  if (!v2Session) return null;
  const notes = v2Session.inboxNoteIds.map((id) => v2Session.notes.get(id)).filter((n) => n !== undefined);

  const assignTo = (target: { kind: "pin" | "zone"; id: string }) => {
    if (!assigning) return;
    setBusy(true);
    void reassignMedia(assigning.mediaId, target)
      .then(() => {
        showToast("Filed");
        setAssigning(null);
      })
      .finally(() => setBusy(false));
  };

  const assignToNewPin = (zoneId: string) => {
    if (!assigning) return;
    setBusy(true);
    void createPin(zoneId)
      .then(async (pinId) => {
        await reassignMedia(assigning.mediaId, { kind: "pin", id: pinId });
        setAssigning(null);
        navigate({ name: "pin", pinId });
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 pb-28">
      <header className="flex items-center gap-3">
        <BigButton variant="ghost" onClick={() => navigate({ name: "walk" })}>←</BigButton>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-100">Inbox</h1>
          <p className="text-sm text-slate-400">
            {v2Session.inbox.length} capture{v2Session.inbox.length === 1 ? "" : "s"} to file
          </p>
        </div>
      </header>

      {v2Session.inbox.length === 0 && notes.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
          Empty — the global camera drops captures here when you're between zones.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {v2Session.inbox.map((m) => (
          <button
            key={m.mediaId}
            type="button"
            onClick={() => setAssigning(m)}
            className="relative overflow-hidden rounded-xl ring-1 ring-slate-700"
          >
            {m.mime.startsWith("image") ? (
              <Thumb mediaId={m.mediaId} className="aspect-square w-full" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-slate-800 text-slate-300">
                🎙 {formatDuration(m.durationMs ?? 0)}
              </div>
            )}
          </button>
        ))}
      </div>

      {notes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-300">Unfiled notes</h2>
          {notes.map((n) => (
            <p key={n.noteId} className="rounded-xl bg-slate-800 p-3 text-slate-100">{n.text}</p>
          ))}
        </section>
      )}

      <Sheet open={assigning !== null} onClose={() => setAssigning(null)} title="File this capture">
        {assigning && (
          <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
            {assigning.mime.startsWith("image") && <Thumb mediaId={assigning.mediaId} className="h-40 w-full rounded-xl" />}
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-400">To an existing pin</h3>
              {v2Session.pins.filter((p) => !p.retired).map((p) => (
                <PinRow key={p.pinId} pin={p} onClick={() => !busy && assignTo({ kind: "pin", id: p.pinId })} />
              ))}
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-400">To a zone (or a new pin in it)</h3>
              {v2Session.zones.map((z) => (
                <div key={z.zoneId} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => assignTo({ kind: "zone", id: z.zoneId })}
                    className="flex-1 rounded-xl bg-slate-800 p-3 text-left font-medium text-slate-100 active:bg-slate-700"
                  >
                    {z.label}
                  </button>
                  <BigButton variant="secondary" disabled={busy} onClick={() => assignToNewPin(z.zoneId)}>
                    New pin
                  </BigButton>
                </div>
              ))}
            </section>
          </div>
        )}
      </Sheet>
    </div>
  );
}
