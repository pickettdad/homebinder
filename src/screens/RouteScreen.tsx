/** Session home: zones in walk order, completeness at a glance, export entry point. */
import { useApp } from "../store/sessionStore";
import { zoneCounts, sessionTotals, openFindings } from "../engine/selectors";
import { BigButton, ProgressBar } from "../ui/bits";

export function RouteScreen() {
  const { session, config, navigate, leaveSession, reviewPending, drainNow, showToast } = useApp();
  if (!session || !config) return null;

  const totals = sessionTotals(session, config);
  const online = typeof navigator === "undefined" || navigator.onLine;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6 pb-32">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{session.propertyLabel || "Inspection"}</h1>
          <p className="text-sm text-slate-400">
            {session.routeId} v{session.configVersion} · config {session.configHash.slice(0, 8)}
          </p>
        </div>
        <BigButton variant="ghost" onClick={leaveSession}>Home</BigButton>
      </header>

      {session.zones.map((zone) => {
        const c = zoneCounts(zone, config);
        const complete = c.requiredResolved === c.requiredTotal;
        return (
          <button
            key={zone.zoneId}
            type="button"
            onClick={() => navigate({ name: "zone", zoneId: zone.zoneId })}
            className={`rounded-2xl border p-5 text-left transition-colors ${
              zone.gate === "closed"
                ? "border-teal-600/60 bg-teal-950/30"
                : complete
                  ? "border-amber-500/60 bg-slate-800"
                  : "border-slate-700 bg-slate-800 active:bg-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-100">
                {zone.label}
                {openFindings(zone) > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                    {openFindings(zone)} finding{openFindings(zone) === 1 ? "" : "s"}
                  </span>
                )}
              </h2>
              <span className="text-sm text-slate-400">
                {zone.gate === "closed" ? "closed ✓" : `${c.requiredResolved}/${c.requiredTotal} required`}
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar value={c.requiredResolved} max={c.requiredTotal} />
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {c.captured} captured · {c.excepted} excepted · {c.deferred} deferred
              {c.optionalTotal > 0 && ` · ${c.optionalCaptured}/${c.optionalTotal} optional`}
            </p>
          </button>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-700 bg-slate-900/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <p className="text-sm text-slate-300">
            {totals.requiredResolved}/{totals.requiredTotal} required · {totals.photoCount} photos ·{" "}
            {totals.zonesClosed}/{totals.zonesTotal} zones closed
            {totals.gapCount > 0 && <span className="text-amber-400"> · {totals.gapCount} for visit two</span>}
            {reviewPending > 0 && (
              <button
                type="button"
                className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300"
                onClick={() => {
                  if (!online) { showToast("No signal — reviews will run when connected"); return; }
                  void drainNow().then(() => showToast("Running pending reviews"));
                }}
              >
                {reviewPending} review{reviewPending === 1 ? "" : "s"} pending{online ? " · run now" : ""}
              </button>
            )}
          </p>
          <BigButton variant="secondary" onClick={() => navigate({ name: "export" })}>Export</BigButton>
        </div>
      </div>
    </div>
  );
}
