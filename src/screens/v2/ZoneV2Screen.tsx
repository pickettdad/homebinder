import { useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton, Sheet } from "../../ui/bits";
import { PhotoInput } from "../../capture/PhotoInput";
import { auditSnapshot, deriveZoneAudit } from "../../engine/v2/checklist";
import { ChecklistPanel } from "./ChecklistPanel";
import { PinRow, Thumb } from "./shared";

/** A zone during the walk: canvases, pins, advisory close. Checklist panel lands in step 4. */
export function ZoneV2Screen({ zoneId }: { zoneId: string }) {
  const {
    v2Session, v2Config, navigate, createPin, addCanvas, capturePhotoV2,
    closeZoneV2, reopenZoneV2, showToast,
  } = useApp();
  const [closeSheet, setCloseSheet] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const [reopenSheet, setReopenSheet] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [busy, setBusy] = useState(false);

  const zone = v2Session?.zones.find((z) => z.zoneId === zoneId);
  if (!v2Session || !v2Config || !zone) return null;
  const sessionDone = !!v2Session.completedAt; // whole inspection completed
  // A closed zone is locked too — no work slips in until it's reopened (and that's logged).
  const locked = sessionDone || !!zone.closedAt;

  const pins = v2Session.pins.filter((p) => p.zoneId === zoneId && !p.retired);
  const canvases = zone.canvases.filter((c) => !c.retired);
  const auditItems = deriveZoneAudit(v2Config, v2Session, zoneId);
  const audit = auditSnapshot(auditItems);
  const coreOpen = auditItems.filter(
    (d) => d.item.tier === "core" && (d.status.kind === "unresolved" || d.status.kind === "proposed"),
  );

  const newPin = () => {
    setBusy(true);
    createPin(zoneId)
      .then((pinId) => navigate({ name: "pin", pinId }))
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not create pin"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 pb-28">
      <header className="flex items-center gap-3">
        <BigButton variant="ghost" onClick={() => navigate({ name: "walk" })}>←</BigButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-slate-100">{zone.label}</h1>
          <p className="text-sm text-slate-400">
            {zone.zoneType} · {pins.length} pin{pins.length === 1 ? "" : "s"} ·{" "}
            {audit.coreUnresolved.length} core open
          </p>
        </div>
        {sessionDone ? (
          <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">viewing</span>
        ) : zone.closedAt ? (
          <BigButton variant="secondary" onClick={() => { setReopenReason(""); setReopenSheet(true); }}>Reopen</BigButton>
        ) : (
          <BigButton variant="secondary" onClick={() => { setCloseNote(""); setCloseSheet(true); }}>
            Close
          </BigButton>
        )}
      </header>

      {sessionDone && (
        <p className="rounded-xl border border-slate-600 bg-slate-800/60 p-3 text-sm text-amber-200/90">
          Viewing a completed inspection. Reopen it from the property overview to make changes.
        </p>
      )}

      {zone.closedAt && (
        <div className="rounded-xl border border-slate-600 bg-slate-800/60 p-4 text-sm text-slate-300">
          Closed{zone.closeNote ? ` — “${zone.closeNote}”` : ""}. Recorded:{" "}
          {zone.audit?.coreUnresolved.length ?? 0} core unresolved, {zone.audit?.standardUnresolved ?? 0}{" "}
          standard, {zone.audit?.naCount ?? 0} N/A.
        </div>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-300">Canvases</h2>
          {!locked && (
            <PhotoInput onPhoto={(file) => addCanvas(zoneId, file).then(() => showToast("Canvas added"))}>
              Add canvas
            </PhotoInput>
          )}
        </div>
        {canvases.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            Wide photos covering the walls — pins anchor onto them.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {canvases.map((c) => (
              <button
                key={c.canvasId}
                type="button"
                onClick={() => navigate({ name: "canvas", canvasId: c.canvasId, zoneId })}
                className="relative shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-600"
              >
                <Thumb mediaId={c.media.mediaId} className="h-28 w-40" />
                <span className="absolute bottom-1 right-1 rounded bg-slate-950/70 px-1.5 text-xs text-slate-200">
                  {v2Session.pins.filter((p) => p.anchors.some((a) => a.canvasId === c.canvasId)).length} pins
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-300">Pins</h2>
          {!locked && <BigButton variant="secondary" disabled={busy} onClick={newPin}>New pin</BigButton>}
        </div>
        {pins.map((p) => (
          <PinRow key={p.pinId} pin={p} onClick={() => navigate({ name: "pin", pinId: p.pinId })} />
        ))}
        {pins.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            Tap a canvas to drop a pin where it lives — or New pin and place it later.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-slate-300">Checklist</h2>
        <ChecklistPanel items={auditItems} readOnly={locked} />
      </section>

      <section className="flex items-center justify-between rounded-xl bg-slate-800 p-4">
        <p className="text-sm text-slate-300">
          Zone photos: {zone.photos.length} · audio: {zone.voiceNotes.length}
        </p>
        {!locked && (
          <PhotoInput
            onPhoto={(file) =>
              capturePhotoV2({ kind: "zone", id: zoneId }, file).then(() => showToast("Photo saved to zone"))
            }
          >
            Add photo
          </PhotoInput>
        )}
      </section>

      <Sheet open={closeSheet} onClose={() => setCloseSheet(false)} title={`Close ${zone.label}`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-300">
            Closing never blocks. The audit records what's left:{" "}
            <span className="font-semibold text-slate-100">
              {audit.coreUnresolved.length} core unresolved
            </span>
            , {audit.standardUnresolved} standard, {audit.naCount} N/A.
          </p>
          {coreOpen.length > 0 && (
            <ul className="max-h-48 overflow-y-auto rounded-xl bg-slate-900/70 p-3 text-sm text-amber-200/90">
              {coreOpen.map((d) => (
                <li key={`${d.item.id}-${d.scope.kind === "pin" ? d.scope.pinId : ""}`} className="py-0.5">
                  • {d.item.text}
                </li>
              ))}
            </ul>
          )}
          <textarea
            value={closeNote}
            onChange={(e) => setCloseNote(e.target.value)}
            placeholder="Close note (optional — why leaving, what's pending)"
            rows={3}
            className="rounded-xl bg-slate-900 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
          />
          <BigButton
            onClick={() => {
              void closeZoneV2(zoneId, closeNote).then(() => {
                setCloseSheet(false);
                navigate({ name: "walk" });
              });
            }}
          >
            Close zone
          </BigButton>
        </div>
      </Sheet>

      <Sheet open={reopenSheet} onClose={() => setReopenSheet(false)} title={`Reopen ${zone.label}`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-300">
            Reopening unlocks this zone for changes and logs the reason. Close it again when
            you're done.
          </p>
          <textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Reason (e.g. “forgot to test the GFCI”)"
            rows={3}
            className="rounded-xl bg-slate-900 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
          />
          <BigButton
            disabled={!reopenReason.trim()}
            onClick={() => {
              void reopenZoneV2(zoneId, reopenReason).then(() => {
                setReopenSheet(false);
                showToast("Zone reopened");
              });
            }}
          >
            Reopen zone
          </BigButton>
        </div>
      </Sheet>
    </div>
  );
}
