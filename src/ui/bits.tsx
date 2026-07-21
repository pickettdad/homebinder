/** Small shared UI pieces. Fat targets (≥60pt), glove-friendly, dark-first. */
import type { ReactNode } from "react";
import type { SlotProgress } from "../engine/selectors";

export function BigButton(props: {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  children: ReactNode;
}) {
  const variant = props.variant ?? "primary";
  const styles = {
    primary: "bg-teal-500 text-slate-950 font-semibold active:bg-teal-400 disabled:bg-slate-700 disabled:text-slate-500",
    secondary: "bg-slate-700 text-slate-100 active:bg-slate-600 disabled:opacity-40",
    ghost: "bg-transparent text-slate-300 border border-slate-600 active:bg-slate-800 disabled:opacity-40",
    danger: "bg-rose-600 text-white active:bg-rose-500 disabled:opacity-40",
  }[variant];
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`min-h-16 rounded-xl px-5 text-lg transition-colors ${styles} ${props.className ?? ""}`}
    >
      {props.children}
    </button>
  );
}

export function StatusGlyph({ progress }: { progress: SlotProgress }) {
  switch (progress.kind) {
    case "captured":
      return <span className="text-teal-400" aria-label="captured">●</span>;
    case "partial":
      return <span className="text-amber-400" aria-label="partial">{progress.have}/{progress.need}</span>;
    case "needs-voice":
      return <span className="text-amber-400" aria-label="needs voice">🎙</span>;
    case "excepted":
      return <span className="text-slate-400" aria-label="excepted">⊘</span>;
    default:
      return <span className="text-slate-600" aria-label="pending">○</span>;
  }
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="h-2 w-full rounded-full bg-slate-700">
      <div className="h-2 rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Sheet(props: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={props.onClose}>
      <div
        className="w-full max-w-2xl rounded-t-2xl bg-slate-800 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-semibold text-slate-100">{props.title}</h2>
        {props.children}
      </div>
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
