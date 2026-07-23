/** Small shared pieces for the v2 (pin model) screens. */
import { useApp } from "../../store/sessionStore";
import { useMediaUrl } from "../../ui/useMediaUrl";
import type { PinFlag, PinTypeRef } from "../../engine/v2/events";
import type { PinStateV2 } from "../../engine/v2/fold";

export function Thumb({ mediaId, className }: { mediaId: string; className?: string }) {
  const url = useMediaUrl(mediaId);
  if (!url) return <div className={`animate-pulse bg-slate-700 ${className ?? ""}`} />;
  return <img src={url} alt="" className={`object-cover ${className ?? ""}`} />;
}

export function pinTypeLabel(pinType?: PinTypeRef): string {
  if (!pinType) return "untyped";
  return pinType.kind === "component" ? pinType.componentType : `“${pinType.label}”`;
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
          {pinTypeLabel(pin.pinType)}
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
