/**
 * End-of-visit export: completeness matrix, the visit-two gap list, then the handoff —
 * manifest.json first, then per-zone media zips, one share at a time with explicit
 * per-file status (the share sheet's own success signal is not trusted).
 */
import { useRef, useState } from "react";
import { useApp } from "../store/sessionStore";
import { sessionTotals, visitTwoGaps, zoneCounts } from "../engine/selectors";
import { planExport, handoffFile, manifestSha256, type ExportPlan, type HandoffResult } from "../export/exportSession";
import { setSessionStatus } from "../storage/sessionRepo";
import { BigButton, formatBytes } from "../ui/bits";

export function ExportScreen() {
  const { session, config, events, navigate, dispatch, showToast, refreshSessions } = useApp();
  const [plan, setPlan] = useState<ExportPlan | null>(null);
  const [statuses, setStatuses] = useState<Record<string, HandoffResult | "pending">>({});
  const [working, setWorking] = useState<string | null>(null);
  // Synchronous single-flight guard shared by prepare/handoff/finish; `working` is the visual.
  const workingRef = useRef<string | null>(null);
  const beginWork = (label: string): boolean => {
    if (workingRef.current !== null) return false;
    workingRef.current = label;
    setWorking(label);
    return true;
  };
  const endWork = () => {
    workingRef.current = null;
    setWorking(null);
  };

  if (!session || !config) return null;

  const totals = sessionTotals(session, config);
  const gaps = visitTwoGaps(session, config);
  const openZones = session.zones.filter((z) => z.gate === "open");

  const prepare = async () => {
    if (!beginWork("prepare")) return;
    try {
      const p = await planExport({ state: session, config, events });
      setPlan(p);
      setStatuses(Object.fromEntries(p.files.map((f) => [f.name, "pending" as const])));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Export preparation failed");
    } finally {
      endWork();
    }
  };

  const handoff = async (name: string) => {
    if (!plan) return;
    const file = plan.files.find((f) => f.name === name);
    if (!file) return;
    if (!beginWork(name)) return;
    try {
      const result = await handoffFile(await file.getFile());
      setStatuses((s) => ({ ...s, [name]: result }));
      if (result === "failed") showToast("Share cancelled — file not marked as delivered");
    } catch (err) {
      setStatuses((s) => ({ ...s, [name]: "failed" }));
      showToast(err instanceof Error ? err.message : "Handoff failed");
    } finally {
      endWork();
    }
  };

  const allHandled = plan !== null && plan.files.every((f) => ["shared", "downloaded"].includes(statuses[f.name] ?? ""));

  const finish = async () => {
    if (!plan) return;
    if (!beginWork("finish")) return;
    try {
      const sha = await manifestSha256(plan.manifest);
      await dispatch([
        {
          type: "ExportProduced",
          manifestSha256: sha,
          files: plan.files.map((f) => ({ name: f.name, bytes: f.bytes })),
        },
      ]);
      await setSessionStatus(session.sessionId, "exported");
      await refreshSessions();
      showToast("Export recorded");
      navigate({ name: "route" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not record the export");
    } finally {
      endWork();
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Export</h1>
        <BigButton variant="ghost" onClick={() => navigate({ name: "route" })}>Back</BigButton>
      </header>

      <section className="rounded-xl bg-slate-800 p-4">
        <p className="text-lg text-slate-100">
          {totals.requiredResolved}/{totals.requiredTotal} required · {totals.photoCount} photos ·{" "}
          {totals.voiceCount} voice notes · {totals.zonesClosed}/{totals.zonesTotal} zones closed
        </p>
        <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-slate-400 sm:grid-cols-2">
          {session.zones.map((z) => {
            const c = zoneCounts(z, config);
            return (
              <p key={z.zoneId}>
                {z.gate === "closed" ? "✓" : "○"} {z.label}: {c.requiredResolved}/{c.requiredTotal}
              </p>
            );
          })}
        </div>
      </section>

      {openZones.length > 0 && (
        <p className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-3 text-amber-200">
          {openZones.length} zone{openZones.length === 1 ? " is" : "s are"} still open —
          exporting is allowed, but the manifest will record them as unclosed.
        </p>
      )}

      {gaps.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-300">Visit-two gap list ({gaps.length})</h2>
          <ul className="flex flex-col gap-1 rounded-xl bg-slate-800 p-4 text-sm text-slate-300">
            {gaps.map((g) => (
              <li key={g.slot.instanceId}>
                <span className="text-slate-100">{g.zoneLabel}</span> — {g.slot.label}
                {g.note ? <span className="text-slate-400"> ({g.note})</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!plan ? (
        <BigButton disabled={working === "prepare"} onClick={() => void prepare()}>
          {working === "prepare" ? "Preparing…" : "Prepare export files"}
        </BigButton>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-slate-300">
            Files ({plan.files.length}) — share each to Files/AirDrop, then confirm
          </h2>
          {plan.files.map((f) => {
            const st = statuses[f.name] ?? "pending";
            return (
              <div key={f.name} className="flex items-center gap-3 rounded-xl bg-slate-800 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-slate-100">{f.name}</p>
                  <p className="text-xs text-slate-400">{formatBytes(f.bytes)} · {st}</p>
                </div>
                <BigButton
                  variant={st === "pending" || st === "failed" ? "primary" : "secondary"}
                  disabled={working !== null}
                  onClick={() => void handoff(f.name)}
                >
                  {working === f.name ? "…" : st === "pending" || st === "failed" ? "Share" : "Re-share"}
                </BigButton>
              </div>
            );
          })}
          <BigButton disabled={!allHandled || working !== null} onClick={() => void finish()}>
            {allHandled ? "Finish — record export" : "Share every file to finish"}
          </BigButton>
        </section>
      )}
    </div>
  );
}
