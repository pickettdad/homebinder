/**
 * The checklist made visible (Stage 1 step 4): Documentation and Tests as separate
 * sections — never mixed (owner decision, master §2) — grouped by rendered-group key,
 * core loud, standard quiet, satisfied collapsed behind a count.
 *
 * The attest rule is enforced at the interaction level too: evidence items offer
 * one-tap confirmation (including of a proposal); action items offer ONLY explicit
 * Pass/Fail. Nothing here can mark a test from software state.
 */
import { useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton, Sheet } from "../../ui/bits";
import { buildAuditView, type DerivedItem } from "../../engine/v2/checklist";
import type { ItemResolution } from "../../engine/v2/events";

function StatusChip({ d }: { d: DerivedItem }) {
  const s = d.status;
  if (s.kind === "satisfied") return <span className="text-emerald-400">✓</span>;
  if (s.kind === "na") return <span className="text-slate-400">N/A</span>;
  if (s.kind === "proposed")
    return <span className="rounded-full bg-teal-900/70 px-2 py-0.5 text-xs font-semibold text-teal-300">pinned — confirm</span>;
  return d.item.tier === "core" ? (
    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
  ) : (
    <span className="h-2 w-2 rounded-full bg-slate-600" />
  );
}

function ItemRow({ d, onOpen }: { d: DerivedItem; onOpen: () => void }) {
  const loud = d.item.tier === "core" && (d.status.kind === "unresolved" || d.status.kind === "proposed");
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
        loud ? "bg-slate-800" : "bg-slate-800/40"
      } active:bg-slate-700`}
    >
      <span className={`flex-1 text-sm ${loud ? "font-medium text-slate-100" : "text-slate-300"}`}>
        {d.item.text}
      </span>
      <StatusChip d={d} />
    </button>
  );
}

function Group({ group, onOpen }: { group: { key: string; items: DerivedItem[] }; onOpen: (d: DerivedItem) => void }) {
  const [showDone, setShowDone] = useState(false);
  const open = group.items.filter((d) => d.status.kind === "unresolved" || d.status.kind === "proposed");
  const done = group.items.filter((d) => d.status.kind === "satisfied" || d.status.kind === "na");
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.key}</h4>
        {done.length > 0 && (
          <button type="button" className="text-xs text-slate-500 underline-offset-2 hover:underline" onClick={() => setShowDone(!showDone)}>
            {done.length} done {showDone ? "▾" : "▸"}
          </button>
        )}
      </div>
      {open.map((d) => (
        <ItemRow key={`${d.item.id}-${d.scope.kind === "pin" ? d.scope.pinId : ""}`} d={d} onOpen={() => onOpen(d)} />
      ))}
      {showDone && done.map((d) => (
        <ItemRow key={`${d.item.id}-${d.scope.kind === "pin" ? d.scope.pinId : ""}`} d={d} onOpen={() => onOpen(d)} />
      ))}
    </div>
  );
}

function ItemSheet({ d, onClose }: { d: DerivedItem; onClose: () => void }) {
  const { v2Config, v2Session, resolveItem, reopenItem, showToast } = useApp();
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [naMode, setNaMode] = useState(false);

  if (!v2Config || !v2Session) return null;
  const item = d.item;
  const isTest = item.attest === "action";
  const resolved = d.status.kind === "satisfied" || d.status.kind === "na";

  const finish = (resolution: ItemResolution) => {
    void resolveItem(d.scope, item.id, resolution).then(onClose);
  };

  const satisfied = (result?: "pass" | "fail") => {
    const evidence: NonNullable<Extract<ItemResolution, { kind: "satisfied" }>["evidence"]> = {};
    if (item.satisfy === "measure" && value.trim()) {
      evidence.value = value.trim();
      if (item.unit) evidence.unit = item.unit;
    }
    if (d.status.kind === "proposed") evidence.pinId = d.status.pinIds[0];
    finish({
      kind: "satisfied",
      via: item.satisfy,
      result,
      evidence: Object.keys(evidence).length ? evidence : undefined,
      note: note.trim() || undefined,
    });
    if (result === "fail") showToast("Recorded as failed — drop an issue pin where it lives");
  };

  return (
    <Sheet open onClose={onClose} title={isTest ? "Test" : "Documentation"}>
      <div className="flex flex-col gap-4">
        <p className="text-slate-100">{item.text}</p>
        {item.guidance && <p className="text-sm text-slate-400">{item.guidance}</p>}

        {resolved ? (
          <>
            <p className="text-sm text-slate-300">
              {d.status.kind === "na"
                ? `Marked N/A — ${v2Config.naReasons.find((r) => d.status.kind === "na" && r.id === d.status.reasonId)?.label ?? ""}`
                : "Satisfied."}
            </p>
            <BigButton variant="secondary" onClick={() => void reopenItem(d.scope, item.id).then(onClose)}>
              Reopen
            </BigButton>
          </>
        ) : naMode ? (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (why it doesn't apply / couldn't be reached)"
              rows={2}
              className="rounded-xl bg-slate-900 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
            />
            <div className="flex flex-col gap-2">
              {v2Config.naReasons.map((r) => (
                <BigButton
                  key={r.id}
                  variant="secondary"
                  onClick={() => finish({ kind: "na", reasonId: r.id, note: note.trim() || undefined })}
                >
                  {r.label}
                  {r.feedsGapList ? " → visit two" : ""}
                </BigButton>
              ))}
            </div>
            <BigButton variant="ghost" onClick={() => setNaMode(false)}>Back</BigButton>
          </>
        ) : (
          <>
            {item.satisfy === "measure" && (
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
                placeholder={item.unit ? `Reading (${item.unit})` : "Reading"}
                className="rounded-xl bg-slate-900 p-3 text-lg text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
              />
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional — type or dictate)"
              rows={2}
              className="rounded-xl bg-slate-900 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
            />
            {isTest ? (
              <div className="flex gap-3">
                <BigButton className="flex-1" onClick={() => satisfied("pass")}>Pass</BigButton>
                <BigButton variant="danger" className="flex-1" onClick={() => satisfied("fail")}>Fail</BigButton>
              </div>
            ) : d.status.kind === "proposed" ? (
              <BigButton onClick={() => satisfied()}>
                Confirm — pinned{(() => {
                  const st = d.status;
                  if (st.kind !== "proposed") return "";
                  const nums = st.pinIds
                    .map((id) => v2Session.pins.find((p) => p.pinId === id)?.number)
                    .filter((n) => n !== undefined);
                  return nums.length ? ` (#${nums.join(", #")})` : "";
                })()}
              </BigButton>
            ) : (
              <BigButton disabled={item.satisfy === "measure" && !value.trim()} onClick={() => satisfied()}>
                Mark satisfied
              </BigButton>
            )}
            <BigButton variant="ghost" onClick={() => setNaMode(true)}>N/A…</BigButton>
          </>
        )}
      </div>
    </Sheet>
  );
}

export function ChecklistPanel({ items }: { items: DerivedItem[] }) {
  const [open, setOpen] = useState<DerivedItem | null>(null);
  const view = buildAuditView(items);
  // Keep the open sheet pointed at fresh derivation after a resolution re-render.
  const current = open
    ? items.find(
        (d) =>
          d.item.id === open.item.id &&
          (d.scope.kind !== "pin" || (open.scope.kind === "pin" && d.scope.pinId === open.scope.pinId)),
      ) ?? null
    : null;

  return (
    <div className="flex flex-col gap-5">
      {(["documentation", "tests"] as const).map((section) => {
        const groups = view[section];
        if (groups.length === 0) return null;
        return (
          <div key={section} className="flex flex-col gap-3">
            <h3 className="font-semibold text-slate-300">{section === "documentation" ? "Documentation" : "Tests"}</h3>
            {groups.map((g) => (
              <Group key={g.key} group={g} onOpen={setOpen} />
            ))}
          </div>
        );
      })}
      {current && <ItemSheet d={current} onClose={() => setOpen(null)} />}
    </div>
  );
}
