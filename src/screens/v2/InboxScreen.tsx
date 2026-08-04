import { useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton, Sheet, formatDuration } from "../../ui/bits";
import type { MediaRef } from "../../engine/v2/fold";
import { MediaThumb, MediaViewer, PinRow } from "./shared";

/** Session inbox: shoot first, file when hands are free. Everything is retaggable. */
export function InboxScreen() {
  const { v2Session, navigate, reassignMedia, createPin, captionMedia, discardMediaV2, showToast } = useApp();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  /** "unfiled" = the classic inbox; otherwise a zoneId. ONE inbox, filtered — not two inboxes
      (field report 2026-07-25: the walkabout sweep files into the zone, and those captures were
      unreachable from here). Two inboxes would mean two mental models and two places to forget. */
  const [filter, setFilter] = useState<string>("unfiled");

  if (!v2Session) return null;
  const notes = v2Session.inboxNoteIds.map((id) => v2Session.notes.get(id)).filter((n) => n !== undefined);
  const zoneMediaOf = (z: (typeof v2Session.zones)[number]) => [...z.photos, ...z.voiceNotes];
  const allMedia = [...v2Session.inbox, ...v2Session.zones.flatMap(zoneMediaOf)];
  const activeZone = v2Session.zones.find((z) => z.zoneId === filter);
  const items: MediaRef[] = filter === "unfiled" ? v2Session.inbox : activeZone ? zoneMediaOf(activeZone) : [];
  // Re-derive from fresh state so a saved caption shows without reopening the sheet. Searches
  // ALL media (not just unfiled) so a zone capture stays open while it is being filed onto a pin.
  const assigning = assigningId ? allMedia.find((m) => m.mediaId === assigningId) ?? null : null;
  const assigningIsFiled = assigning ? !v2Session.inbox.some((m) => m.mediaId === assigning.mediaId) : false;
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
    const filed = !v2Session.inbox.some((m) => m.mediaId === assigning.mediaId);
    if (
      !confirm(
        filed
          ? "Delete this capture? It's gone for good — it is currently filed to a zone."
          : "Delete this capture? It's gone for good — it was never filed anywhere.",
      )
    )
      return;
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
          <h1 className="text-2xl font-bold text-slate-100">Captures</h1>
          <p className="text-sm text-slate-400">
            {v2Session.inbox.length} unfiled · {allMedia.length} total this visit
          </p>
        </div>
      </header>

      {/* Filter, not a second inbox: everything captured this visit is reachable from here. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[
          { key: "unfiled", label: "Unfiled", n: v2Session.inbox.length },
          ...v2Session.zones.map((z) => ({ key: z.zoneId, label: z.label, n: zoneMediaOf(z).length })),
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
              filter === tab.key ? "bg-brass-600 text-slate-950" : "bg-slate-800 text-slate-300"
            }`}
          >
            {tab.label} ({tab.n})
          </button>
        ))}
      </div>

      {items.length === 0 && (filter !== "unfiled" || notes.length === 0) && (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
          {filter === "unfiled"
            ? "Nothing unfiled — the global camera drops captures here when you're between zones."
            : `No captures in ${activeZone?.label ?? "this zone"} yet. Photos taken with the camera while you're in a zone land under that zone.`}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {items.map((m) => (
          <button
            key={m.mediaId}
            type="button"
            onClick={() => open(m)}
            className="relative overflow-hidden rounded-xl ring-1 ring-slate-700"
          >
            {m.mime.startsWith("audio") ? (
              <div className="flex aspect-square w-full items-center justify-center bg-slate-800 text-slate-300">
                🎙 {formatDuration(m.durationMs ?? 0)}
              </div>
            ) : (
              <MediaThumb mediaId={m.mediaId} mime={m.mime} durationMs={m.durationMs} className="aspect-square w-full" />
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

      <Sheet
        open={assigning !== null}
        onClose={() => setAssigningId(null)}
        title={assigningIsFiled ? "Re-file this capture" : "File this capture"}
      >
        {assigning && (
          <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
            {!assigning.mime.startsWith("audio") && (
              // MediaViewer, not MediaThumb: the filing sheet is where you decide WHERE a
              // capture goes, so it has to be viewable — the field test hit a black square
              // with a play button and no way to tell what it was.
              <MediaViewer
                mediaId={assigning.mediaId}
                mime={assigning.mime}
                className="max-h-[45dvh] w-full rounded-xl object-contain"
              />
            )}
            <div className="flex gap-2">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Note on this capture (type or dictate) — travels with it when filed"
                rows={2}
                className="flex-1 rounded-xl bg-slate-900 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-brass-500"
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
