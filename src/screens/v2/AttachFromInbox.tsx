/**
 * Attach captures that already exist to an object/concern or a zone.
 *
 * The field test found the same hole from three directions: the pin's "Add photo" only
 * offered the camera, the zone viewer could show a capture but not file it, and the inbox
 * could only move one at a time. All three are the same missing verb — *attach what I
 * already shot* — so this is one sheet, opened from anywhere, rather than three flows.
 *
 * Multi-select is the default, not a mode: the walkabout produces captures in batches
 * (twelve shots of a water heater), and filing them one tap at a time is the friction that
 * stops filing happening at all. Nothing here creates media; it only re-files existing
 * captures through the same `reassignMedia` path the inbox already uses.
 */
import { useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton, Sheet, formatDuration } from "../../ui/bits";
import type { MediaRef } from "../../engine/v2/fold";
import { MediaThumb } from "./shared";

export function AttachFromInbox(props: {
  open: boolean;
  onClose: () => void;
  /** Where the selected captures land. */
  target: { kind: "pin" | "zone"; id: string };
  /** Zone whose captures are offered alongside the unfiled ones (the walkabout sweep). */
  zoneId?: string;
  label: string;
}) {
  const { v2Session, reassignMedia, showToast } = useApp();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  if (!v2Session) return null;
  const zone = props.zoneId ? v2Session.zones.find((z) => z.zoneId === props.zoneId) : undefined;
  // Zone captures are offered only when filing INTO something else — a zone can't attach
  // its own captures to itself.
  const zoneCaptures =
    zone && !(props.target.kind === "zone" && props.target.id === zone.zoneId)
      ? [...zone.photos, ...zone.voiceNotes]
      : [];

  const groups: { title: string; items: MediaRef[] }[] = [
    { title: "Unfiled", items: v2Session.inbox },
    { title: zone ? `${zone.label} captures` : "", items: zoneCaptures },
  ].filter((g) => g.items.length > 0);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const attach = () => {
    setBusy(true);
    const ids = [...picked];
    // Sequential, not Promise.all: each reassign appends an event, and the repo stamps
    // seq per append. Firing them concurrently races the counter.
    void ids
      .reduce<Promise<unknown>>((chain, id) => chain.then(() => reassignMedia(id, props.target)), Promise.resolve())
      .then(() => {
        showToast(`${ids.length} capture${ids.length === 1 ? "" : "s"} → ${props.label}`);
        setPicked(new Set());
        props.onClose();
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not attach"))
      .finally(() => setBusy(false));
  };

  return (
    <Sheet open={props.open} onClose={props.onClose} title={`Attach to ${props.label}`}>
      <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
        {groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
            Nothing available to attach. Captures taken with the camera while you're in this
            zone land under the zone, and anything shot between zones lands in Unfiled.
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.title} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-400">
                {g.title} ({g.items.length})
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {g.items.map((m) => {
                  const on = picked.has(m.mediaId);
                  return (
                    <button
                      key={m.mediaId}
                      type="button"
                      onClick={() => toggle(m.mediaId)}
                      aria-pressed={on}
                      className={`relative overflow-hidden rounded-xl ring-2 ${
                        on ? "ring-brass-400" : "ring-slate-700"
                      }`}
                    >
                      {m.mime.startsWith("audio") ? (
                        <span className="flex aspect-square w-full items-center justify-center bg-slate-800 text-slate-300">
                          🎙 {formatDuration(m.durationMs ?? 0)}
                        </span>
                      ) : (
                        <MediaThumb
                          mediaId={m.mediaId}
                          mime={m.mime}
                          durationMs={m.durationMs}
                          className="aspect-square w-full"
                        />
                      )}
                      {on && (
                        <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brass-500 text-sm font-bold text-slate-950">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
        {groups.length > 0 && (
          <BigButton disabled={busy || picked.size === 0} onClick={attach}>
            Attach {picked.size > 0 ? picked.size : ""} to {props.label}
          </BigButton>
        )}
      </div>
    </Sheet>
  );
}
