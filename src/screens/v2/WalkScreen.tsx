import { useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton, Sheet } from "../../ui/bits";
import { PinRow } from "./shared";

/** The free walk: zones in creation order, created as you go. Replaces RouteScreen. */
export function WalkScreen() {
  const { v2Session, v2Config, checklists, navigate, createZone, leaveSession, showToast } = useApp();
  const config = v2Config ?? checklists;
  const [sheet, setSheet] = useState(false);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [attrs, setAttrs] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  if (!v2Session || !config) return null;

  const inboxCount = v2Session.inbox.length + v2Session.inboxNoteIds.length;
  const miscPins = v2Session.pins.filter((p) => !p.zoneId && !p.retired);
  const askAttrs = config.zoneAttributes.filter((a) => a.askAtCreation);
  const selectedType = config.zoneTypes.find((t) => t.id === typeId);

  const openSheet = () => {
    setTypeId(null);
    setLabel("");
    setAttrs(new Set());
    setSheet(true);
  };

  const create = () => {
    if (!typeId) return;
    setCreating(true);
    const attributes: Record<string, boolean> = {};
    for (const a of askAttrs) attributes[a.id] = attrs.has(a.id);
    createZone(typeId, label.trim() || selectedType?.typicalLabels[0] || typeId, attributes)
      .then((zoneId) => {
        setSheet(false);
        navigate({ name: "zone2", zoneId });
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not create zone"))
      .finally(() => setCreating(false));
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 pb-28">
      <header className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-100">
            {v2Session.propertyLabel || "Inspection"}
          </h1>
          <p className="text-sm text-slate-400">
            {v2Session.zones.length} zone{v2Session.zones.length === 1 ? "" : "s"} ·{" "}
            {v2Session.pins.filter((p) => !p.retired).length} pins · walk free, the audit remembers
          </p>
        </div>
        <BigButton variant="ghost" onClick={() => leaveSession()}>Home</BigButton>
      </header>

      <div className="flex gap-3">
        <BigButton className="flex-1" onClick={openSheet}>New zone</BigButton>
        <BigButton variant="secondary" onClick={() => navigate({ name: "inbox" })}>
          Inbox{inboxCount > 0 ? ` (${inboxCount})` : ""}
        </BigButton>
      </div>

      <section className="flex flex-col gap-3">
        {v2Session.zones.map((z) => {
          const pins = v2Session.pins.filter((p) => p.zoneId === z.zoneId && !p.retired);
          return (
            <button
              key={z.zoneId}
              type="button"
              onClick={() => navigate({ name: "zone2", zoneId: z.zoneId })}
              className="flex items-center gap-3 rounded-xl bg-slate-800 p-4 text-left active:bg-slate-700"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-medium text-slate-100">{z.label}</p>
                <p className="text-sm text-slate-400">
                  {z.zoneType} · {pins.length} pin{pins.length === 1 ? "" : "s"} · {z.canvases.filter((c) => !c.retired).length} canvas
                </p>
              </div>
              {z.closedAt ? (
                <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">closed</span>
              ) : (
                <span className="rounded-full bg-teal-900/60 px-3 py-1 text-xs font-semibold text-teal-300">open</span>
              )}
            </button>
          );
        })}
        {v2Session.zones.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
            Start where you're standing — create the first zone.
          </p>
        )}
      </section>

      {miscPins.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-300">Misc (no zone yet)</h2>
          {miscPins.map((p) => (
            <PinRow key={p.pinId} pin={p} onClick={() => navigate({ name: "pin", pinId: p.pinId })} />
          ))}
        </section>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="New zone">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {config.zoneTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTypeId(t.id);
                  if (!label.trim()) setLabel(t.typicalLabels[0] ?? t.id);
                }}
                className={`rounded-xl px-3 py-2 text-sm font-medium ring-1 ${
                  typeId === t.id ? "bg-teal-600 text-white ring-teal-500" : "bg-slate-800 text-slate-300 ring-slate-600"
                }`}
              >
                {t.id}
              </button>
            ))}
          </div>
          {selectedType && selectedType.typicalLabels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedType.typicalLabels.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLabel(l)}
                  className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300 ring-1 ring-slate-700"
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (what the owner calls it)"
            className="rounded-xl bg-slate-900 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
          />
          {typeId && askAttrs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {askAttrs.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    setAttrs((prev) => {
                      const next = new Set(prev);
                      if (next.has(a.id)) next.delete(a.id);
                      else next.add(a.id);
                      return next;
                    })
                  }
                  className={`rounded-xl px-3 py-2 text-sm ring-1 ${
                    attrs.has(a.id) ? "bg-teal-700 text-white ring-teal-500" : "bg-slate-800 text-slate-300 ring-slate-600"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <BigButton disabled={!typeId || creating} onClick={create}>Create zone</BigButton>
        </div>
      </Sheet>
    </div>
  );
}
