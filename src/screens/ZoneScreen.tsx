/** The zone checklist: every slot's state at a glance; tap a slot to capture. */
import { useMemo, useState } from "react";
import { useApp } from "../store/sessionStore";
import type { SlotState } from "../engine/fold";
import { slotProgress, isSlotUnlocked, zoneCounts, nextIncompleteSlot } from "../engine/selectors";
import { BigButton, StatusGlyph, Sheet } from "../ui/bits";
import { ExceptionSheet } from "../ui/ExceptionSheet";

export function ZoneScreen({ zoneId }: { zoneId: string }) {
  const { session, config, navigate, addRoom, clearException, showToast } = useApp();
  const [exceptFor, setExceptFor] = useState<SlotState | null>(null);
  const [addingRoom, setAddingRoom] = useState(false);

  const zone = session?.zones.find((z) => z.zoneId === zoneId);

  const groups = useMemo(() => {
    if (!zone || !session) return [];
    const base: SlotState[] = [];
    const byConditional = new Map<string, SlotState[]>();
    const byRoom = new Map<string, SlotState[]>();
    for (const slot of zone.slots) {
      if (slot.roomInstanceId) {
        const list = byRoom.get(slot.roomInstanceId) ?? [];
        list.push(slot); byRoom.set(slot.roomInstanceId, list);
      } else if (slot.fromConditional) {
        const list = byConditional.get(slot.fromConditional) ?? [];
        list.push(slot); byConditional.set(slot.fromConditional, list);
      } else base.push(slot);
    }
    const out: { title: string | null; badge?: string; slots: SlotState[] }[] = [];
    if (base.length) out.push({ title: null, slots: base });
    for (const [roomId, slots] of byRoom) {
      const room = session.rooms.find((r) => r.roomInstanceId === roomId);
      out.push({ title: room?.label ?? "Room", slots });
    }
    for (const [condId, slots] of byConditional) {
      const block = config?.conditionalBlocks.find((b) => b.id === condId);
      out.push({ title: block?.label ?? condId, badge: "from property flags", slots });
    }
    return out;
  }, [zone, session, config]);

  if (!session || !config || !zone) return null;

  const c = zoneCounts(zone, config);
  const readyToClose = c.requiredResolved === c.requiredTotal;
  const next = nextIncompleteSlot(session, zoneId);
  const zoneDef = config.zones.find((z) => z.id === zoneId);
  const acceptedKinds = [...new Set(zoneDef?.rooms.flatMap((r) => r.roomKinds) ?? [])];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6 pb-32">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-slate-100">{zone.label}</h1>
          <p className="text-sm text-slate-400">{c.requiredResolved}/{c.requiredTotal} required resolved</p>
        </div>
        <BigButton variant="ghost" onClick={() => navigate({ name: "route" })}>Route</BigButton>
      </header>

      {zone.intro && <p className="rounded-xl bg-slate-800/60 p-3 text-sm text-slate-300">{zone.intro}</p>}
      {zone.gate === "closed" && (
        <p className="rounded-xl border border-teal-600/60 bg-teal-950/30 p-3 text-teal-200">
          Zone closed. Capturing again will require reopening at the gate.
        </p>
      )}

      {groups.map((group, gi) => (
        <section key={gi}>
          {group.title && (
            <h2 className="mb-2 mt-2 text-lg font-semibold text-slate-300">
              {group.title}
              {group.badge && <span className="ml-2 rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{group.badge}</span>}
            </h2>
          )}
          <div className="flex flex-col gap-2">
            {group.slots.map((slot) => {
              const p = slotProgress(slot);
              const unlocked = isSlotUnlocked(session, slot);
              return (
                <div key={slot.instanceId} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    disabled={!unlocked}
                    onClick={() => navigate({ name: "capture", slotInstanceId: slot.instanceId })}
                    className={`flex min-h-16 flex-1 items-center gap-3 rounded-xl px-4 text-left transition-colors ${
                      unlocked ? "bg-slate-800 active:bg-slate-700" : "bg-slate-800/40 text-slate-500"
                    }`}
                  >
                    <span className="w-10 text-center text-lg"><StatusGlyph progress={p} /></span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate ${slot.required ? "text-slate-100" : "text-slate-400"}`}>
                        {slot.label}
                        {!slot.required && <span className="ml-1 text-xs">(optional)</span>}
                      </span>
                      {!unlocked && <span className="text-xs text-amber-400">locked — waiting on the water run</span>}
                      {p.kind === "excepted" && (
                        <span className="text-xs text-slate-400">
                          {config.exceptionReasons.find((r) => r.id === p.reasonId)?.label}
                          {slot.exception?.note ? ` — ${slot.exception.note}` : ""}
                        </span>
                      )}
                    </span>
                    {slot.photos.length > 0 && <span className="text-sm text-slate-400">{slot.photos.length}📷</span>}
                    {slot.voiceNotes.length > 0 && <span className="text-sm text-slate-400">{slot.voiceNotes.length}🎙</span>}
                  </button>
                  {p.kind === "excepted" ? (
                    <button
                      type="button"
                      className="rounded-xl bg-slate-800 px-3 text-xs text-slate-400 active:bg-slate-700"
                      onClick={() => { void clearException(slot.instanceId).then(() => showToast("Exception cleared")); }}
                    >
                      clear
                    </button>
                  ) : (
                    !slot.exception && !["captured"].includes(p.kind) && (
                      <button
                        type="button"
                        className="rounded-xl bg-slate-800 px-3 text-xs text-slate-400 active:bg-slate-700"
                        onClick={() => setExceptFor(slot)}
                      >
                        can't
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {acceptedKinds.length > 0 && (
        <BigButton variant="ghost" onClick={() => setAddingRoom(true)}>+ Add a room to this zone</BigButton>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-700 bg-slate-900/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3">
          {next && (
            <BigButton className="flex-1" onClick={() => navigate({ name: "capture", slotInstanceId: next.instanceId })}>
              Resume capture
            </BigButton>
          )}
          <BigButton
            className="flex-1"
            variant={readyToClose && zone.gate === "open" ? "primary" : "secondary"}
            onClick={() => navigate({ name: "gate", zoneId })}
          >
            {zone.gate === "closed" ? "Gate (closed)" : readyToClose ? "Close zone" : "Gate check"}
          </BigButton>
        </div>
      </div>

      <ExceptionSheet
        slotInstanceId={exceptFor?.instanceId ?? null}
        slotLabel={exceptFor?.label}
        onClose={() => setExceptFor(null)}
      />

      <Sheet open={addingRoom} onClose={() => setAddingRoom(false)} title="Add a room">
        <div className="flex flex-col gap-3">
          {acceptedKinds.map((kind) => {
            const kindLabel = config.roomKinds.find((k) => k.id === kind)?.label ?? kind;
            const existing = session.rooms.filter((r) => r.zoneId === zoneId && r.kind === kind).length;
            return (
              <BigButton
                key={kind}
                variant="secondary"
                onClick={() => {
                  const label = existing > 0 ? `${kindLabel} ${existing + 1}` : kindLabel;
                  void addRoom(zoneId, kind, label).then(() => {
                    setAddingRoom(false);
                    showToast(`${label} added — its routine is in the list`);
                  });
                }}
              >
                {kindLabel}{existing > 0 && <span className="ml-2 text-sm text-slate-400">({existing} already)</span>}
              </BigButton>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
