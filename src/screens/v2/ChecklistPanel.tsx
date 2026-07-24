/**
 * The checklist made visible (Stage 1 step 4): Documentation and Tests as separate
 * sections — never mixed (owner decision, master §2) — as a collapsed accordion so the
 * dense list reads calm: two headings, then groups, then items, each opened on demand.
 * Every collapsed heading still shows its open count and a core dot, so nothing urgent
 * hides behind a closed row.
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

const isOpen = (d: DerivedItem) => d.status.kind === "unresolved" || d.status.kind === "proposed";
const coreOpen = (items: DerivedItem[]) => items.some((d) => d.item.tier === "core" && isOpen(d));
const openCount = (items: DerivedItem[]) => items.filter(isOpen).length;

/** Right-aligned "N open" / "done" summary with a core dot — shown on collapsed headings. */
function CountBadge({ items }: { items: DerivedItem[] }) {
  const n = openCount(items);
  if (n === 0) return <span className="text-xs text-emerald-500">all done</span>;
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400">
      {coreOpen(items) && <span className="h-2 w-2 rounded-full bg-amber-400" />}
      {n} open
    </span>
  );
}

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
  const loud = d.item.tier === "core" && isOpen(d);
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

/** Level 2: a rendered group (base list / sub-heading / pin), collapsed by default. */
function Group({ group, onOpen }: { group: { key: string; items: DerivedItem[] }; onOpen: (d: DerivedItem) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-slate-900/40 p-1.5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-2 py-1.5 text-left"
      >
        <span className="text-slate-500">{expanded ? "▾" : "▸"}</span>
        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.key}</span>
        <CountBadge items={group.items} />
      </button>
      {expanded &&
        group.items.map((d) => (
          <ItemRow key={`${d.item.id}-${d.scope.kind === "pin" ? d.scope.pinId : ""}`} d={d} onOpen={() => onOpen(d)} />
        ))}
    </div>
  );
}

/** Level 1: Documentation / Tests, collapsed by default. */
function Section({
  title,
  groups,
  onOpen,
}: {
  title: string;
  groups: { key: string; items: DerivedItem[] }[];
  onOpen: (d: DerivedItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const all = groups.flatMap((g) => g.items);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900/30 p-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-2 py-1.5 text-left"
      >
        <span className="text-slate-400">{expanded ? "▾" : "▸"}</span>
        <span className="flex-1 font-semibold text-slate-200">{title}</span>
        <CountBadge items={all} />
      </button>
      {expanded && (
        <div className="flex flex-col gap-2">
          {groups.map((g) => (
            <Group key={g.key} group={g} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemSheet({ d, readOnly, onClose }: { d: DerivedItem; readOnly: boolean; onClose: () => void }) {
  const { v2Config, v2Session, navigate, resolveItem, reopenItem, createPin, setPinType, showToast } = useApp();
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [naMode, setNaMode] = useState(false);
  const [linkMode, setLinkMode] = useState(false);

  if (!v2Config || !v2Session) return null;
  const item = d.item;
  const isTest = item.attest === "action";
  const resolved = d.status.kind === "satisfied" || d.status.kind === "na";
  const zoneId = d.scope.kind === "zone" ? d.scope.zoneId : undefined;
  // Pins in this zone whose type can evidence this item (for "link an existing pin").
  const linkable =
    zoneId && item.attest === "evidence" && item.pinTypes?.length
      ? v2Session.pins.filter(
          (p) =>
            p.zoneId === zoneId &&
            !p.retired &&
            p.pinType?.kind === "component" &&
            item.pinTypes!.includes(p.pinType.componentType),
        )
      : [];

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

  const createPinForItem = () => {
    if (!zoneId) return;
    void createPin(zoneId)
      .then(async (pinId) => {
        // Seed the pin's type from the item so it lands ready to place/photograph —
        // and (for evidence items) so it proposes this very item back automatically.
        if (item.pinTypes?.[0]) await setPinType(pinId, { kind: "component", componentType: item.pinTypes[0] });
        onClose();
        navigate({ name: "pin", pinId });
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not create pin"));
  };

  return (
    <Sheet open onClose={onClose} title={isTest ? "Test" : "Documentation"}>
      <div className="flex flex-col gap-4">
        <p className="text-slate-100">{item.text}</p>
        {item.guidance && <p className="text-sm text-slate-400">{item.guidance}</p>}

        {readOnly ? (
          <p className="text-sm text-slate-300">
            {d.status.kind === "satisfied"
              ? "Satisfied."
              : d.status.kind === "na"
                ? `Marked N/A — ${v2Config.naReasons.find((r) => d.status.kind === "na" && r.id === d.status.reasonId)?.label ?? ""}`
                : d.status.kind === "proposed"
                  ? "Proposed by a matching pin — awaiting confirmation."
                  : "Not yet resolved."}
          </p>
        ) : resolved ? (
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
        ) : linkMode ? (
          <>
            <p className="text-sm text-slate-400">Confirm this from an existing pin in the zone:</p>
            {linkable.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-400">
                No matching pins in this zone yet — create one instead.
              </p>
            ) : (
              linkable.map((p) => (
                <BigButton
                  key={p.pinId}
                  variant="secondary"
                  onClick={() => finish({ kind: "satisfied", via: "pin", evidence: { pinId: p.pinId } })}
                >
                  #{p.number} {p.pinType?.kind === "component" ? p.pinType.componentType : ""}
                  {p.label ? ` — ${p.label}` : ""}
                </BigButton>
              ))
            )}
            <BigButton variant="ghost" onClick={() => setLinkMode(false)}>Back</BigButton>
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

            {zoneId && (
              <div className="flex flex-col gap-2 border-t border-slate-700 pt-3">
                <p className="text-xs text-slate-500">Tie this to a marker on the canvas:</p>
                <BigButton variant="secondary" onClick={createPinForItem}>
                  Create a pin for this
                </BigButton>
                {item.attest === "evidence" && item.pinTypes?.length ? (
                  <BigButton variant="secondary" onClick={() => setLinkMode(true)}>
                    Link an existing pin
                  </BigButton>
                ) : null}
              </div>
            )}

            <BigButton variant="ghost" onClick={() => setNaMode(true)}>N/A…</BigButton>
          </>
        )}
      </div>
    </Sheet>
  );
}

export function ChecklistPanel({ items, readOnly = false }: { items: DerivedItem[]; readOnly?: boolean }) {
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
    <div className="flex flex-col gap-3">
      {view.documentation.length > 0 && (
        <Section title="Documentation" groups={view.documentation} onOpen={setOpen} />
      )}
      {view.tests.length > 0 && <Section title="Tests" groups={view.tests} onOpen={setOpen} />}
      {current && <ItemSheet d={current} readOnly={readOnly} onClose={() => setOpen(null)} />}
    </div>
  );
}
