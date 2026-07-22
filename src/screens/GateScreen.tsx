/**
 * The zone gate. Deterministic: lists exactly what blocks closing; each item is either
 * shot now or excepted with a logged reason. Defer-to-visit-two is one tap but visibly
 * increments the visit-two tally, and there is deliberately NO "defer all" bulk action —
 * deferral can never become forgetting.
 */
import { useState } from "react";
import { useApp } from "../store/sessionStore";
import { gateOutstanding } from "../engine/gate";
import { zoneCounts, sessionTotals } from "../engine/selectors";
import type { SlotState } from "../engine/fold";
import { BigButton } from "../ui/bits";
import { ExceptionSheet } from "../ui/ExceptionSheet";
import { SecondLookPanel } from "../ui/SecondLook";

export function GateScreen({ zoneId }: { zoneId: string }) {
  const { session, config, navigate, closeZone, reopenZone, showToast } = useApp();
  const [exceptFor, setExceptFor] = useState<SlotState | null>(null);

  const zone = session?.zones.find((z) => z.zoneId === zoneId);
  if (!session || !config || !zone) return null;

  const outstanding = gateOutstanding(zone);
  const c = zoneCounts(zone, config);
  const gapCount = sessionTotals(session, config).gapCount;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Gate — {zone.label}</h1>
          <p className="text-sm text-slate-400">Visit-two list: {gapCount} item{gapCount === 1 ? "" : "s"}</p>
        </div>
        <BigButton variant="ghost" onClick={() => navigate({ name: "zone", zoneId })}>Back</BigButton>
      </header>

      {zone.gate === "closed" ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-xl border border-teal-600/60 bg-teal-950/30 p-4 text-teal-200">
            Zone closed with {c.captured} captured · {c.excepted} excepted · {c.deferred} deferred.
          </p>
          <SecondLookPanel zone={zone} />
          <BigButton onClick={() => navigate({ name: "route" })}>Continue route</BigButton>
          <BigButton variant="ghost" onClick={() => { void reopenZone(zoneId).then(() => showToast("Zone reopened")); }}>
            Reopen zone
          </BigButton>
        </div>
      ) : outstanding.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-slate-300">
            {outstanding.length} required slot{outstanding.length === 1 ? "" : "s"} unresolved. Each one gets shot now
            or leaves with a logged reason — the zone can't close with unexplained gaps.
          </p>
          {outstanding.map(({ slot, detail }) => (
            <div key={slot.instanceId} className="rounded-xl bg-slate-800 p-4">
              <p className="font-medium text-slate-100">{slot.label}</p>
              <p className="text-sm text-slate-400">{detail}</p>
              <div className="mt-3 flex gap-2">
                <BigButton
                  className="flex-1"
                  onClick={() => navigate({ name: "capture", slotInstanceId: slot.instanceId })}
                >
                  Go shoot
                </BigButton>
                <BigButton variant="ghost" className="flex-1" onClick={() => setExceptFor(slot)}>
                  Can't capture
                </BigButton>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-slate-800 p-5 text-lg text-slate-200">
            <p className="font-semibold text-slate-100">{c.requiredTotal} required slots:</p>
            <p className="mt-2">{c.captured} captured · {c.excepted} excepted · {c.deferred} deferred to visit two</p>
            {c.deferred + c.excepted > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-400">
                {zone.slots
                  .filter((s) => s.required && s.exception)
                  .map((s) => (
                    <li key={s.instanceId}>
                      {s.label} — {config.exceptionReasons.find((r) => r.id === s.exception!.reasonId)?.label}
                      {s.exception!.note ? `: ${s.exception!.note}` : ""}
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <BigButton
            onClick={() => {
              const reviewed = config.zones.find((z) => z.id === zoneId)?.gate.review === "ai";
              void closeZone(zoneId)
                .then(() => {
                  showToast(`${zone.label} closed`);
                  // Reviewed zones stay on the closed gate — the natural 30-60s packing-up
                  // pause is where Second-look findings land. Unreviewed zones move on.
                  if (!reviewed) navigate({ name: "route" });
                })
                .catch((err) => showToast(err instanceof Error ? err.message : "Could not close zone"));
            }}
          >
            Close zone
          </BigButton>
        </div>
      )}

      <ExceptionSheet
        slotInstanceId={exceptFor?.instanceId ?? null}
        slotLabel={exceptFor?.label}
        onClose={() => setExceptFor(null)}
      />
    </div>
  );
}
