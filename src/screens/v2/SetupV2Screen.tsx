import { useMemo, useState } from "react";
import { useApp } from "../../store/sessionStore";
import { VISIT_KINDS, visitKindLabel } from "../../engine/v2/checklist";
import type { VisitKind } from "../../engine/v2/events";
import { BigButton } from "../../ui/bits";

/** v2 session setup: property label + intake property flags. No room enumeration —
 *  zones are created on the walk (REDESIGN-v2 §3). */
export function SetupV2Screen() {
  const { checklists, navigate, startSessionV2, showToast } = useApp();
  const [label, setLabel] = useState("");
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  /**
   * Capture Mode spec §1: mode follows the visit kind, and the kind is picked ONCE, at the
   * one moment it is unambiguous. Deliberately not a toggle anywhere else in the app — the
   * named failure is a concierge on a busy morning capturing against an inspection screen.
   * No default is pre-selected: a wrong kind is silent for the whole visit and permanent in
   * the log, so this is one of the few places worth making the concierge choose.
   */
  const [visitKind, setVisitKind] = useState<VisitKind | null>(null);

  const groups = useMemo(() => {
    const bySource = new Map<string, { id: string; label: string }[]>();
    for (const f of checklists?.propertyFlags ?? []) {
      bySource.set(f.intakeSource, [...(bySource.get(f.intakeSource) ?? []), f]);
    }
    return [...bySource.entries()];
  }, [checklists]);

  /**
   * F-23: Table A's intake-source column was authored as an annotation and is rendered as a
   * UI heading, so authoring marks reach the screen. The walk saw the literal
   * `⚠ **not yet asked at intake** — see §9` — a spec cross-reference, asterisks included,
   * on a screen a client can see. Strip authoring marks and spec references here; §8's
   * vocabulary layer is the durable fix, and issue #64's generator guard stops the class.
   * Not fixed in the master: that file is owner-authored and currently frozen.
   */
  const heading = (source: string): string => {
    const clean = source
      .replace(/[*`_]/g, "")
      .replace(/\s*[—-]?\s*see\s+§\s*\d+\s*$/i, "")
      .replace(/^\s*⚠\s*/, "")
      .trim();
    return clean || "Other";
  };

  if (!checklists) return null;

  const toggle = (id: string) =>
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center gap-3">
        <BigButton variant="ghost" onClick={() => navigate({ name: "home" })}>←</BigButton>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">New inspection</h1>
          <p className="text-sm text-slate-400">
            Checklists v{checklists.configVersion} · flags can be corrected on site
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <span className="font-semibold text-slate-300">What is this visit?</span>
        <div className="flex flex-wrap gap-2">
          {VISIT_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setVisitKind(k)}
              className={`rounded-xl px-4 py-3 font-medium ring-1 ${
                visitKind === k
                  ? "bg-brass-600 text-white ring-brass-500"
                  : "bg-slate-800 text-slate-300 ring-slate-600"
              }`}
            >
              {visitKindLabel(k)}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Set once, here. It cannot be changed mid-visit.</p>
      </section>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-slate-300">Property label</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. 41 Birch Lane"
          className="rounded-xl bg-slate-800 p-4 text-lg text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-brass-500"
        />
      </label>

      {groups.map(([source, items]) => (
        <section key={source} className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-300">{heading(source)}</h2>
          <div className="flex flex-wrap gap-2">
            {items.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                className={`rounded-xl px-4 py-3 font-medium ring-1 ${
                  flags.has(f.id)
                    ? "bg-brass-600 text-white ring-brass-500"
                    : "bg-slate-800 text-slate-300 ring-slate-600"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>
      ))}

      <BigButton
        disabled={starting || !visitKind}
        onClick={() => {
          if (!visitKind) return;
          setStarting(true);
          startSessionV2({ propertyFlags: [...flags], propertyLabel: label.trim() || undefined, visitKind })
            .catch((err) => showToast(err instanceof Error ? err.message : "Could not start"))
            .finally(() => setStarting(false));
        }}
      >
        Start the walk
      </BigButton>
    </div>
  );
}
