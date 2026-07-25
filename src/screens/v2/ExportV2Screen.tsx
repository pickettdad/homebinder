/**
 * Pin-model export (PLAN-STAGE-1 §7) — the visit's data written cleanly OUT of the app.
 *
 * Owner rule (2026-07-25): an inspection isn't finished until it's been exported so nothing can
 * be lost with the app. Saving into the iPad's Files counts — it doesn't have to leave the
 * device here; cloud/USB is the next stage of the process. Runs mid-visit too, as an emergency
 * backup, so a long inspection is never one dropped iPad away from gone.
 *
 * The integrity sweep runs BEFORE any file is offered: if a photo is missing or the wrong size,
 * the inspector finds out here, not months later in the binder.
 */
import { useRef, useState } from "react";
import { useApp } from "../../store/sessionStore";
import { exportIsCurrent } from "../../engine/v2/fold";
import { planExportV3, manifestV3Sha256, type ExportPlanV3 } from "../../export/exportSessionV3";
import { handoffFile, type HandoffResult } from "../../export/exportSession";
import { BigButton, formatBytes } from "../../ui/bits";

export function ExportV2Screen() {
  const { v2Session, v2Config, v2Events, navigate, recordExportV2, showToast } = useApp();
  const [plan, setPlan] = useState<ExportPlanV3 | null>(null);
  const [statuses, setStatuses] = useState<Record<string, HandoffResult | "pending">>({});
  const [working, setWorking] = useState<string | null>(null);
  // Synchronous single-flight guard (state reads are stale within a render); `working` is visual.
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

  if (!v2Session || !v2Config) return null;

  const backedUp = exportIsCurrent(v2Session);
  const lastExport = v2Session.exports[v2Session.exports.length - 1];

  const prepare = async () => {
    if (!beginWork("prepare")) return;
    try {
      const p = await planExportV3({ state: v2Session, events: v2Events, configSnapshot: v2Config });
      setPlan(p);
      setStatuses(Object.fromEntries(p.files.map((f) => [f.name, "pending" as const])));
      if (!p.integrity.ok) showToast(`${p.integrity.problems.length} media problem(s) — see below`);
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
      if (result === "failed") showToast("Not saved — file not marked as delivered");
    } catch (err) {
      setStatuses((s) => ({ ...s, [name]: "failed" }));
      showToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      endWork();
    }
  };

  const allHandled =
    plan !== null && plan.files.every((f) => ["shared", "downloaded"].includes(statuses[f.name] ?? ""));

  const finish = async () => {
    if (!plan) return;
    if (!beginWork("finish")) return;
    try {
      const sha = await manifestV3Sha256(plan.manifest);
      await recordExportV2(
        sha,
        plan.files.map((f) => ({ name: f.name, bytes: f.bytes })),
      );
      showToast("Export recorded — this visit is backed up");
      navigate({ name: "walk" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not record the export");
    } finally {
      endWork();
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Export / back up</h1>
        <BigButton variant="ghost" onClick={() => navigate({ name: "walk" })}>Back</BigButton>
      </header>

      <section
        className={`rounded-xl p-4 ${backedUp ? "bg-emerald-950/40 ring-1 ring-emerald-600/50" : "bg-amber-950/30 ring-1 ring-amber-500/50"}`}
      >
        <p className={backedUp ? "text-emerald-200" : "text-amber-200"}>
          {backedUp
            ? "✓ Backed up — every change so far has been exported out of the app."
            : lastExport
              ? "Changes since the last export — this visit is not fully backed up."
              : "Not yet exported — this visit exists only inside the app."}
        </p>
        {lastExport && (
          <p className="mt-1 text-sm text-slate-400">
            Last export {new Date(lastExport.at).toLocaleString()} · {lastExport.files.length} file
            {lastExport.files.length === 1 ? "" : "s"}
          </p>
        )}
      </section>

      <section className="rounded-xl bg-slate-800 p-4">
        <p className="text-lg text-slate-100">
          {v2Session.zones.length} zone{v2Session.zones.length === 1 ? "" : "s"} ·{" "}
          {v2Session.pins.length} pin{v2Session.pins.length === 1 ? "" : "s"} ·{" "}
          {v2Session.inbox.length} unfiled
        </p>
        <p className="mt-1 text-sm text-slate-400">
          The export carries everything: zones, pins, photos, voice notes, notes, chats, the
          checklist record, and the full event log.
        </p>
      </section>

      {plan && !plan.integrity.ok && (
        <section className="rounded-xl border border-red-500/60 bg-red-950/30 p-4">
          <h2 className="font-semibold text-red-200">
            {plan.integrity.problems.length} media problem
            {plan.integrity.problems.length === 1 ? "" : "s"} found
          </h2>
          <p className="mt-1 text-sm text-red-200/80">
            These files are referenced by the inspection but could not be verified in storage. Export
            anyway to save what exists — but tell support before wiping this device.
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-red-100/90">
            {plan.integrity.problems.slice(0, 10).map((p) => (
              <li key={p.mediaId} className="font-mono text-xs">
                {p.file} — {p.kind} ({p.detail})
              </li>
            ))}
            {plan.integrity.problems.length > 10 && (
              <li className="text-xs text-red-200/70">…and {plan.integrity.problems.length - 10} more</li>
            )}
          </ul>
        </section>
      )}

      {plan && plan.integrity.ok && (
        <p className="rounded-xl bg-slate-800/60 p-3 text-sm text-emerald-300">
          ✓ Integrity check passed — all {plan.integrity.checked} media files verified.
        </p>
      )}

      {!plan ? (
        <BigButton disabled={working === "prepare"} onClick={() => void prepare()}>
          {working === "prepare" ? "Checking and preparing…" : "Prepare export"}
        </BigButton>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-slate-300">
            Files ({plan.files.length}) — save each to Files (or AirDrop), then finish
          </h2>
          {plan.files.map((f) => {
            const st = statuses[f.name] ?? "pending";
            return (
              <div key={f.name} className="flex items-center gap-3 rounded-xl bg-slate-800 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-slate-100">{f.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(f.bytes)} · {st === "pending" ? "not saved yet" : st}
                  </p>
                </div>
                <BigButton
                  variant={st === "pending" || st === "failed" ? "primary" : "secondary"}
                  disabled={working !== null}
                  onClick={() => void handoff(f.name)}
                >
                  {working === f.name ? "…" : st === "pending" || st === "failed" ? "Save" : "Save again"}
                </BigButton>
              </div>
            );
          })}
          <BigButton disabled={!allHandled || working !== null} onClick={() => void finish()}>
            {allHandled ? "Finish — record this export" : "Save every file to finish"}
          </BigButton>
          <p className="text-xs text-slate-500">
            Saving into Files is enough to count as backed up — getting it to cloud or USB is the
            next stage, not this one.
          </p>
        </section>
      )}
    </div>
  );
}
