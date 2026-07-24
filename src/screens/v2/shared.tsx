/** Small shared pieces for the v2 (pin model) screens. */
import { useState } from "react";
import { useApp } from "../../store/sessionStore";
import { useMediaUrl } from "../../ui/useMediaUrl";
import { BigButton } from "../../ui/bits";
import type { PinFlag, PinTypeRef } from "../../engine/v2/events";
import type { PinStateV2 } from "../../engine/v2/fold";

/** Storey grouping for the walk list. UI structure, not checklist content. */
export const ZONE_LEVELS = ["basement", "main", "second", "third", "attic", "exterior"] as const;

export function defaultLevelFor(zoneTypeInherits: string[]): string {
  return zoneTypeInherits.includes("exterior-base") ? "exterior" : "main";
}

export function Thumb({ mediaId, className }: { mediaId: string; className?: string }) {
  const url = useMediaUrl(mediaId);
  if (!url) return <div className={`animate-pulse bg-slate-700 ${className ?? ""}`} />;
  return <img src={url} alt="" className={`object-cover ${className ?? ""}`} />;
}

export function pinTypeLabel(pinType?: PinTypeRef): string {
  if (!pinType) return "untyped";
  return pinType.kind === "component" ? pinType.componentType : `“${pinType.label}”`;
}

/** Component type plus optional nickname: "receptacle — over workbench". */
export function pinFullLabel(pin: Pick<PinStateV2, "pinType" | "label">): string {
  return pin.label ? `${pinTypeLabel(pin.pinType)} — ${pin.label}` : pinTypeLabel(pin.pinType);
}

const FLAG_STYLES: Record<PinFlag, string> = {
  fine: "bg-emerald-900/60 text-emerald-300 ring-emerald-700",
  monitor: "bg-amber-900/60 text-amber-300 ring-amber-700",
  issue: "bg-rose-900/60 text-rose-300 ring-rose-700",
};

export function FlagChip({ flag }: { flag: PinFlag | null }) {
  if (!flag) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${FLAG_STYLES[flag]}`}>
      {flag}
    </span>
  );
}

export function PinBadge({ number }: { number: number }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 font-bold text-white">
      {number}
    </span>
  );
}

/**
 * Searchable pin-type picker (field test 3: a 30-chip cloud doesn't scale — type to
 * filter). Empty input shows the zone's top priors; any text filters the library by
 * substring and always offers itself as a freeform custom type.
 */
export function TypePicker({
  choices,
  current,
  onPick,
}: {
  /** Prior-ordered component types (suggestedPinTypes). */
  choices: string[];
  current?: PinTypeRef;
  onPick: (pinType: PinTypeRef) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q ? choices.filter((t) => t.includes(q)) : choices.slice(0, 8);
  const exact = q !== "" && choices.includes(q);

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type to search — e.g. gar… for garage-door"
        autoFocus
        className="rounded-xl bg-slate-900 p-3 text-lg text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
      />
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {matches.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onPick({ kind: "component", componentType: t })}
            className={`rounded-xl px-4 py-3 text-left font-medium ring-1 ${
              current?.kind === "component" && current.componentType === t
                ? "bg-teal-600 text-white ring-teal-500"
                : "bg-slate-800 text-slate-200 ring-slate-600"
            }`}
          >
            {t}
          </button>
        ))}
        {q === "" && choices.length > 8 && (
          <p className="px-1 text-xs text-slate-500">Showing this zone's usual suspects — type to search all {choices.length}.</p>
        )}
        {q !== "" && matches.length === 0 && (
          <p className="px-1 text-sm text-slate-400">No library match.</p>
        )}
      </div>
      {q !== "" && !exact && (
        <BigButton variant="secondary" onClick={() => onPick({ kind: "freeform", label: query.trim() })}>
          Use “{query.trim()}” as freeform type
        </BigButton>
      )}
    </div>
  );
}

/** One tappable pin row (used by zone, walk-misc, and inbox assignment lists). */
export function PinRow({ pin, onClick, trailing }: { pin: PinStateV2; onClick?: () => void; trailing?: React.ReactNode }) {
  const zone = useApp((s) => s.v2Session?.zones.find((z) => z.zoneId === pin.zoneId));
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl bg-slate-800 p-3 text-left active:bg-slate-700"
    >
      <PinBadge number={pin.number} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-100">
          {pinFullLabel(pin)}
          {pin.retired && <span className="ml-2 text-xs text-slate-500">retired</span>}
        </p>
        <p className="truncate text-sm text-slate-400">
          {zone ? zone.label : "misc"} · {pin.photos.length} photo{pin.photos.length === 1 ? "" : "s"}
          {pin.anchors.length === 0 ? " · unplaced" : ""}
        </p>
      </div>
      <FlagChip flag={pin.flag} />
      {trailing}
    </button>
  );
}
