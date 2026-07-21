/**
 * Session setup: property flags + the actual room list. The "standard 3-bed" is a
 * fiction at any given address — this is where the real house gets enumerated.
 * Starting the session pins the config version + content hash permanently.
 */
import { useMemo, useState } from "react";
import { useApp } from "../store/sessionStore";
import { compilePlan, planSlots } from "../engine/plan";
import { BigButton } from "../ui/bits";

// Tap-saving defaults for the standard detached home; purely UI convenience.
const DEFAULT_COUNTS: Record<string, number> = {
  "main-floor/kitchen": 1, "main-floor/living": 1, "main-floor/dining": 1, "main-floor/bathroom": 1,
  "upper-floor/bedroom": 3, "upper-floor/bathroom": 1,
};

export function SetupScreen() {
  const { route, navigate, startSession } = useApp();
  const [propertyLabel, setPropertyLabel] = useState("");
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>(DEFAULT_COUNTS);
  const [starting, setStarting] = useState(false);

  const rooms = useMemo(() => {
    if (!route) return [];
    const out: { zoneId: string; kind: string; label: string }[] = [];
    for (const zone of route.zones) {
      const kinds = new Set(zone.rooms.flatMap((r) => r.roomKinds));
      for (const kind of kinds) {
        const n = counts[`${zone.id}/${kind}`] ?? 0;
        const kindLabel = route.roomKinds.find((k) => k.id === kind)?.label ?? kind;
        for (let i = 1; i <= n; i++) out.push({ zoneId: zone.id, kind, label: n > 1 ? `${kindLabel} ${i}` : kindLabel });
      }
    }
    return out;
  }, [route, counts]);

  const slotCount = useMemo(() => {
    if (!route) return 0;
    const withIds = rooms.map((r, i) => ({ ...r, roomInstanceId: `preview-${i}` }));
    return planSlots(compilePlan(route, [...flags], withIds)).filter((s) => s.required).length;
  }, [route, flags, rooms]);

  if (!route) return null;

  const zonesWithRooms = route.zones.filter((z) => z.rooms.length > 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">New inspection</h1>
        <BigButton variant="ghost" onClick={() => navigate({ name: "home" })}>Cancel</BigButton>
      </header>

      <label className="flex flex-col gap-2">
        <span className="text-slate-300">Property label</span>
        <input
          value={propertyLabel}
          onChange={(e) => setPropertyLabel(e.target.value)}
          placeholder="e.g. 42 Concession Rd"
          className="rounded-xl bg-slate-800 p-4 text-lg text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
        />
      </label>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-300">Property has…</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {route.profileFlags.map((f) => {
            const on = flags.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFlags((prev) => { const next = new Set(prev); on ? next.delete(f.id) : next.add(f.id); return next; })}
                className={`min-h-16 rounded-xl border p-4 text-left text-lg transition-colors ${
                  on ? "border-teal-400 bg-teal-500/15 text-teal-200" : "border-slate-600 bg-slate-800 text-slate-300"
                }`}
              >
                <span className="font-medium">{f.label}</span>
                {f.hint && <span className="mt-1 block text-xs text-slate-400">{f.hint}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {zonesWithRooms.map((zone) => (
        <section key={zone.id}>
          <h2 className="mb-3 text-lg font-semibold text-slate-300">{zone.label} — rooms</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[...new Set(zone.rooms.flatMap((r) => r.roomKinds))].map((kind) => {
              const key = `${zone.id}/${kind}`;
              const n = counts[key] ?? 0;
              const kindLabel = route.roomKinds.find((k) => k.id === kind)?.label ?? kind;
              return (
                <div key={key} className="flex items-center justify-between rounded-xl bg-slate-800 p-3">
                  <span className="text-slate-200">{kindLabel}</span>
                  <div className="flex items-center gap-2">
                    <BigButton variant="ghost" className="min-h-14 w-14" disabled={n === 0}
                      onClick={() => setCounts((c) => ({ ...c, [key]: Math.max(0, (c[key] ?? 0) - 1) }))}>−</BigButton>
                    <span className="w-8 text-center text-xl font-semibold text-slate-100">{n}</span>
                    <BigButton variant="ghost" className="min-h-14 w-14"
                      onClick={() => setCounts((c) => ({ ...c, [key]: (c[key] ?? 0) + 1 }))}>+</BigButton>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <BigButton
        disabled={starting}
        onClick={async () => {
          setStarting(true);
          try {
            await startSession({ flags: [...flags], rooms, propertyLabel: propertyLabel.trim() || undefined });
          } finally {
            setStarting(false);
          }
        }}
      >
        Start visit — {slotCount} required slots
      </BigButton>
    </div>
  );
}
