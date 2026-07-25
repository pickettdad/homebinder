import { useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton, Sheet } from "../../ui/bits";
import { deriveSessionItems } from "../../engine/v2/checklist";
import { exportIsCurrent } from "../../engine/v2/fold";
import { ChecklistPanel } from "./ChecklistPanel";
import { PinRow, ZONE_LEVELS, defaultLevelFor } from "./shared";

/** The free walk: zones created as you go, grouped by storey. Replaces RouteScreen. */
export function WalkScreen() {
  const {
    v2Session, v2Config, checklists, navigate, createZone, leaveSession,
    completeSessionV2, reopenSessionV2, showToast,
  } = useApp();
  const config = v2Config ?? checklists;
  const [sheet, setSheet] = useState(false);
  const [finishSheet, setFinishSheet] = useState(false);
  const [reopenSheet, setReopenSheet] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [typeId, setTypeId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [level, setLevel] = useState<string>("main");
  const [attrs, setAttrs] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  if (!v2Session || !config) return null;
  const ro = !!v2Session.completedAt; // completed → view only until reopened
  const wasCompletedBefore = v2Session.lifecycle.some((l) => l.type === "completed");
  const backedUp = exportIsCurrent(v2Session);

  const inboxCount = v2Session.inbox.length + v2Session.inboxNoteIds.length;
  const miscPins = v2Session.pins.filter((p) => !p.zoneId && !p.retired);
  const askAttrs = config.zoneAttributes.filter((a) => a.askAtCreation);
  const selectedType = config.zoneTypes.find((t) => t.id === typeId);
  const sessionItems = deriveSessionItems(config, v2Session);

  const levelGroups = [...ZONE_LEVELS, "unassigned"]
    .map((lvl) => ({
      level: lvl,
      zones: v2Session.zones.filter((z) => (z.level ?? "unassigned") === lvl),
    }))
    .filter((g) => g.zones.length > 0);

  const openSheet = () => {
    setTypeId(null);
    setLabel("");
    setLevel("main");
    setAttrs(new Set());
    setSheet(true);
  };

  const create = () => {
    if (!typeId) return;
    setCreating(true);
    const attributes: Record<string, boolean> = {};
    for (const a of askAttrs) attributes[a.id] = attrs.has(a.id);
    createZone(typeId, label.trim() || selectedType?.typicalLabels[0] || typeId, attributes, level)
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
        {!ro && <BigButton className="flex-1" onClick={openSheet}>New zone</BigButton>}
        <BigButton variant="secondary" className={ro ? "flex-1" : ""} onClick={() => navigate({ name: "inbox" })}>
          Inbox{inboxCount > 0 ? ` (${inboxCount})` : ""}
        </BigButton>
      </div>

      <section className="flex flex-col gap-4">
        {levelGroups.map((g) => (
          <div key={g.level} className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{g.level}</h2>
            {g.zones.map((z) => {
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
          </div>
        ))}
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

      {v2Session.zones.length > 0 && !ro && (
        <BigButton variant="secondary" onClick={() => setFinishSheet(true)}>
          {wasCompletedBefore ? "Re-complete inspection" : "Finish visit — house-level checks"}
        </BigButton>
      )}

      {/* Backup state. A completed-but-unexported visit is NOT finished (owner rule): the export
          is the loud next step. Mid-visit it stays available as a quieter emergency backup. */}
      {v2Session.zones.length > 0 &&
        (ro && !backedUp ? (
          <section className="flex flex-col gap-3 rounded-xl border border-amber-500/60 bg-amber-950/30 p-4">
            <p className="text-amber-200">
              Completed, but <span className="font-semibold">not yet exported</span> — the visit
              still exists only inside the app.
            </p>
            <BigButton onClick={() => navigate({ name: "export2" })}>Export / back up now</BigButton>
          </section>
        ) : backedUp ? (
          <button
            type="button"
            onClick={() => navigate({ name: "export2" })}
            className="rounded-xl bg-emerald-950/40 p-3 text-left text-sm text-emerald-300 ring-1 ring-emerald-600/50"
          >
            ✓ Backed up — exported out of the app. Tap to export again.
          </button>
        ) : (
          <BigButton variant="ghost" onClick={() => navigate({ name: "export2" })}>
            Export / back up now
          </BigButton>
        ))}

      {(ro || v2Session.lifecycle.length > 0) && (
        <section className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <h2 className="text-sm font-semibold text-slate-300">Inspection log</h2>
          <ol className="flex flex-col gap-1.5 text-sm">
            {v2Session.lifecycle.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className={l.type === "completed" ? "text-emerald-400" : "text-amber-400"}>
                  {l.type === "completed" ? "✓ Completed" : "↻ Reopened"}
                </span>
                <span className="text-slate-400">{new Date(l.at).toLocaleString()}</span>
                {l.reason && <span className="text-slate-300">— “{l.reason}”</span>}
              </li>
            ))}
          </ol>
          {ro && (
            <BigButton variant="secondary" onClick={() => { setReopenReason(""); setReopenSheet(true); }}>
              Reopen inspection to make changes
            </BigButton>
          )}
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
                  setLevel(t.id === "basement" || t.id === "crawlspace" ? "basement" : t.id === "attic" ? "attic" : defaultLevelFor(t.inherits));
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
          {typeId && (
            <div className="flex flex-wrap gap-2">
              {ZONE_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  className={`rounded-full px-3 py-1.5 text-sm ring-1 ${
                    level === lvl ? "bg-teal-700 text-white ring-teal-500" : "bg-slate-800 text-slate-300 ring-slate-600"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          )}
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

      <Sheet open={finishSheet} onClose={() => setFinishSheet(false)} title="House-level checks">
        <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
          <ChecklistPanel items={sessionItems} />
          <BigButton
            onClick={() => {
              void completeSessionV2().then(() => {
                setFinishSheet(false);
                showToast(wasCompletedBefore ? "Inspection re-completed — export again" : "Visit completed — now export to back it up");
              });
            }}
          >
            {wasCompletedBefore ? "Re-complete inspection" : "Complete visit"}
          </BigButton>
          <p className="text-xs text-slate-500">
            Completing never blocks on unresolved items — they're recorded, same as a zone close.
          </p>
        </div>
      </Sheet>

      <Sheet open={reopenSheet} onClose={() => setReopenSheet(false)} title="Reopen inspection">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-300">
            Reopening logs the date, time, and your reason, then unlocks the visit for
            changes. Re-complete it when you're done — that's logged too.
          </p>
          <textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Reason (e.g. “noticed something in the bathroom to log”)"
            rows={3}
            className="rounded-xl bg-slate-900 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
          />
          <BigButton
            disabled={!reopenReason.trim()}
            onClick={() => {
              void reopenSessionV2(reopenReason).then(() => {
                setReopenSheet(false);
                showToast("Reopened — make your changes, then re-complete");
              });
            }}
          >
            Reopen
          </BigButton>
        </div>
      </Sheet>
    </div>
  );
}
