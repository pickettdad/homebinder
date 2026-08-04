/**
 * The three-reason exception sheet. Reasons come from config (labels, note policy,
 * gap-list behavior) — the consequences are engine code. Deliberately small: one tap
 * for note-free reasons; a note field only where route policy demands one.
 */
import { useState } from "react";
import { useApp } from "../store/sessionStore";
import { BigButton, Sheet } from "./bits";

export function ExceptionSheet(props: {
  slotInstanceId: string | null;
  slotLabel?: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const config = useApp((s) => s.config);
  const recordException = useApp((s) => s.recordException);
  const showToast = useApp((s) => s.showToast);
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (!props.slotInstanceId || !config) return null;
  const reasons = config.exceptionReasons;
  const selected = reasons.find((r) => r.id === reasonId);

  const submit = async (id: string, noteText?: string) => {
    try {
      await recordException(props.slotInstanceId!, id, noteText);
      showToast("Exception recorded");
      setReasonId(null);
      setNote("");
      props.onClose();
      props.onDone?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not record exception");
    }
  };

  return (
    <Sheet open onClose={props.onClose} title={props.slotLabel ? `Can't capture: ${props.slotLabel}` : "Can't capture"}>
      {!selected ? (
        <div className="flex flex-col gap-3">
          {reasons.map((r) => (
            <BigButton
              key={r.id}
              variant="secondary"
              onClick={() => (r.requiresNote ? setReasonId(r.id) : void submit(r.id))}
            >
              {r.label}
              {r.feedsGapList && <span className="ml-2 text-sm text-amber-400">→ visit-two list</span>}
            </BigButton>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-slate-300">
            <span className="font-semibold">{selected.label}</span> needs a short note (why, and what would unblock it).
          </p>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="rounded-xl bg-slate-900 p-3 text-lg text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-brass-500"
            placeholder="e.g. blocked by stored boxes along north wall"
          />
          <div className="flex gap-3">
            <BigButton variant="ghost" className="flex-1" onClick={() => setReasonId(null)}>Back</BigButton>
            <BigButton className="flex-1" disabled={!note.trim()} onClick={() => void submit(selected.id, note)}>
              Record
            </BigButton>
          </div>
        </div>
      )}
    </Sheet>
  );
}
