/**
 * The "Second look" panel — AI findings for a closed zone. Trust treatment, enforced
 * visually: subordinate weight to the deterministic gate, no red (nothing here is an
 * error), no green (green belongs to human-confirmed states only), findings are
 * suggestions with one-tap Clear, and nothing here ever blocks anything.
 */
import { useEffect, useState } from "react";
import { useApp } from "../store/sessionStore";
import type { FindingState, ZoneState } from "../engine/fold";
import { db } from "../storage/db";
import { useMediaUrl } from "./useMediaUrl";
import { BigButton } from "./bits";

function useZonePendingReviews(sessionId: string | null, zoneId: string) {
  const [state, setState] = useState<{ count: number; oldestAt: number | null }>({ count: 0, oldestAt: null });
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const poll = async () => {
      const rows = await db.reviewJobs.where("sessionId").equals(sessionId).toArray();
      const mine = rows.filter((r) => r.zoneId === zoneId && (r.status === "pending" || r.status === "inflight"));
      if (!cancelled)
        setState({
          count: mine.length,
          oldestAt: mine.length ? Math.min(...mine.map((r) => Date.parse(r.createdAt))) : null,
        });
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [sessionId, zoneId]);
  return state;
}

const SEVERITY_STYLE: Record<FindingState["severity"], { chip: string; border: string; label: string }> = {
  reshoot: { chip: "bg-amber-500/20 text-amber-300", border: "border-amber-500/40", label: "reshoot?" },
  anomaly: { chip: "bg-violet-500/20 text-violet-300", border: "border-violet-500/40", label: "worth a look" },
  info: { chip: "bg-slate-600/40 text-slate-300", border: "border-slate-600/40", label: "note" },
};

function FindingCard({ finding, zone }: { finding: FindingState; zone: ZoneState }) {
  const { navigate, resolveFinding, showToast } = useApp();
  const thumbUrl = useMediaUrl(finding.mediaIds[0]);
  const style = SEVERITY_STYLE[finding.severity];
  const slot = zone.slots.find((s) => s.instanceId === finding.slotInstanceId);

  const resolve = (resolution: "cleared" | "deferred") => {
    void resolveFinding(finding.findingId, zone.zoneId, resolution).then(() =>
      showToast(resolution === "deferred" ? "Added to visit-two list" : "Cleared"),
    );
  };

  return (
    <div className={`rounded-xl border bg-slate-800/60 p-3 ${style.border}`}>
      <div className="flex gap-3">
        {thumbUrl && <img src={thumbUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs ${style.chip}`}>{style.label}</span>
            <span className="truncate text-xs text-slate-500">{slot?.label ?? finding.slotInstanceId}</span>
          </div>
          <p className="mt-1 text-sm text-slate-200">{finding.message}</p>
          <p className="mt-1 text-xs text-slate-500">Claude · suggestion</p>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <BigButton variant="ghost" className="min-h-11 flex-1 text-sm" onClick={() => resolve("cleared")}>
          Clear
        </BigButton>
        <BigButton variant="ghost" className="min-h-11 flex-1 text-sm" onClick={() => resolve("deferred")}>
          Defer
        </BigButton>
        <BigButton
          variant="secondary"
          className="min-h-11 flex-1 text-sm"
          onClick={() =>
            navigate({ name: "capture", slotInstanceId: finding.slotInstanceId, findingId: finding.findingId })
          }
        >
          {finding.severity === "anomaly" ? "Add evidence" : "Reshoot"}
        </BigButton>
      </div>
    </div>
  );
}

export function SecondLookPanel({ zone }: { zone: ZoneState }) {
  const { sessionId, config } = useApp();
  const pending = useZonePendingReviews(sessionId, zone.zoneId);
  const [elapsed, setElapsed] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!pending.oldestAt) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - pending.oldestAt!) / 1000)), 1000);
    return () => clearInterval(t);
  }, [pending.oldestAt]);

  const zoneDef = config?.zones.find((z) => z.id === zone.zoneId);
  if (zoneDef?.gate.review !== "ai") return null;

  const open = zone.findings.filter((f) => f.status === "open");
  const actionable = open.filter((f) => f.severity !== "info");
  const infoFindings = open.filter((f) => f.severity === "info");
  const resolvedCount = zone.findings.length - open.length;
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <section className="flex flex-col gap-2">
      {pending.count > 0 && (
        <div className="rounded-xl bg-slate-800/50 p-3 text-sm text-slate-400">
          {offline ? (
            <span>Second look queued — will run when there's signal.</span>
          ) : elapsed < 60 ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-brass-400" />
              Second look — reviewing… {elapsed}s
            </span>
          ) : (
            <span>Still reviewing — findings will appear on this zone's card.</span>
          )}
          <span className="mt-1 block text-xs text-slate-500">Zone is closed either way.</span>
        </div>
      )}

      {actionable.map((f) => (
        <FindingCard key={f.findingId} finding={f} zone={zone} />
      ))}

      {infoFindings.length > 0 && (
        <button
          type="button"
          className="rounded-xl bg-slate-800/40 p-3 text-left text-sm text-slate-400"
          onClick={() => setShowInfo((v) => !v)}
        >
          {showInfo
            ? infoFindings.map((f) => <span key={f.findingId} className="block">{f.message}</span>)
            : `${infoFindings.length} note${infoFindings.length === 1 ? "" : "s"} — captures look consistent (tap to expand)`}
        </button>
      )}

      {resolvedCount > 0 && (
        <p className="px-1 text-xs text-slate-500">{resolvedCount} finding{resolvedCount === 1 ? "" : "s"} resolved</p>
      )}

      {(actionable.length > 0 || infoFindings.length > 0) && (
        <p className="px-1 text-xs text-slate-600">Identification aid — conditions and calls are the inspector's.</p>
      )}
    </section>
  );
}
