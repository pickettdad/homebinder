import { useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton, Sheet, formatDuration } from "../../ui/bits";
import type { MediaRef } from "../../engine/v2/fold";
import { PinRow, Thumb } from "./shared";

/** Session inbox: shoot first, file when hands are free. Everything is retaggable. */
export function InboxScreen() {
  const { v2Session, navigate, reassignMedia, createPin, captionMedia, discardMediaV2, showToast } = useApp();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  if (!v2Session) return null;
  const notes = v2Session.inboxNoteIds.map((id) => v2Session.notes.get(id)).filter((n) => n !== undefined);
  // Re-derive from fresh state so a saved caption shows without reopening the sheet.
  const assigning = assigningId ? v2Session.inbox.find((m) => m.mediaId === assigningId) ?? null : null;
  const sessionDone = !!v2Session.completedAt; // completed inspection → no filing
  const zoneById = new Map(v2Session.zones.map((z) => [z.zoneId, z]));
  // Filing into a closed zone (or a pin inside one) is the back door — surface it as locked.
  const pinLocked = (zoneId?: string) => sessionDone || (!!zoneId && !!zoneById.get(zoneId)?.closedAt);

  const open = (m: MediaRef) => {
    setCaption(m.caption ?? "");
    setAssigningId(m.mediaId);
  };

  const saveCaption = () => {
    if (!assigning) return;
    void captionMedia(assigning.mediaId, caption.trim()).then(() => showToast("Note saved"));
  };

  const remove = () => {
    if (!assigning) return;
    if (!confirm("Delete this capture? It's gone for good — it was never filed anywhere.")) return;
    setBusy(true);
    void discardMediaV2(assigning.mediaId)
      .then(() => {
        setAssigningId(null);
        showToast("Deleted");
      })
      .finally(() => setBusy(false));
  };

  const assignTo = (target: { kind: "pin" | "zone"; id: string }) => {
    if (!assigning) return;
    setBusy(true);
    void reassignMedia(assigning.mediaId, target)
      .then(() => {
        showToast("Filed");
        setAssigningId(null);
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not file"))
      .finally(() => setBusy(false));
  };

  const assignToNewPin = (zoneId: string) => {
    if (!assigning) return;
    setBusy(true);
    void createPin(zoneId)
      .then(async (pinId) => {
        await reassignMedia(assigning.mediaId, { kind: "pin", id: pinId });
        setAssigningId(null);
        navigate({ name: "pin", pinId });
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not file"))
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
            onClick={() => open(m)}
            className="relative overflow-hidden rounded-xl ring-1 ring-slate-700"
          >
            {m.mime.startsWith("image") ? (
              <Thumb mediaId={m.mediaId} className="aspect-square w-full" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-slate-800 text-slate-300">
                🎙 {formatDuration(m.durationMs ?? 0)}
              </div>
            )}
            {m.caption && (
              <span className="absolute inset-x-0 bottom-0 truncate bg-slate-950/70 px-1.5 py-0.5 text-left text-xs text-slate-200">
                {m.caption}
              </span>
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

      <Sheet open={assigning !== null} onClose={() => setAssigningId(null)} title="File this capture">
        {assigning && (
          <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
            {assigning.mime.startsWith("image") && <Thumb mediaId={assigning.mediaId} className="h-40 w-full rounded-xl" />}
            <div className="flex gap-2">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Note on this capture (type or dictate) — travels with it when filed"
                rows={2}
                className="flex-1 rounded-xl bg-slate-900 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
              />
              <BigButton
                variant="secondary"
                disabled={busy || sessionDone || caption.trim() === (assigning.caption ?? "")}
                onClick={saveCaption}
              >
                Save
              </BigButton>
            </div>
            {sessionDone && (
              <p className="rounded-xl border border-slate-600 bg-slate-800/60 p-3 text-sm text-amber-200/90">
                This inspection is completed — reopen it to file or delete captures.
              </p>
            )}
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-400">To an existing pin</h3>
              {v2Session.pins.filter((p) => !p.retired).map((p) => {
                const lock = pinLocked(p.zoneId);
                return (
                  <PinRow
                    key={p.pinId}
                    pin={p}
                    trailing={lock ? <span className="text-xs text-slate-500">zone closed</span> : undefined}
                    onClick={() =>
                      lock
                        ? showToast("That zone is closed — reopen it to file here")
                        : !busy && assignTo({ kind: "pin", id: p.pinId })
                    }
                  />
                );
              })}
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-400">To a zone (or a new pin in it)</h3>
              {v2Session.zones.map((z) => {
                const lock = sessionDone || !!z.closedAt;
                return (
                  <div key={z.zoneId} className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || lock}
                      onClick={() => assignTo({ kind: "zone", id: z.zoneId })}
                      className="flex-1 rounded-xl bg-slate-800 p-3 text-left font-medium text-slate-100 active:bg-slate-700 disabled:opacity-50"
                    >
                      {z.label}
                      {z.closedAt && <span className="ml-2 text-xs text-slate-500">closed</span>}
                    </button>
                    <BigButton variant="secondary" disabled={busy || lock} onClick={() => assignToNewPin(z.zoneId)}>
                      New pin
                    </BigButton>
                  </div>
                );
              })}
            </section>
            <BigButton variant="danger" disabled={busy || sessionDone} onClick={remove}>
              Delete this capture
            </BigButton>
          </div>
        )}
      </Sheet>
    </div>
  );
}
