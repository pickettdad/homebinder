/**
 * The capture loop. Steady state per slot: Capture photo -> native camera -> photo lands
 * (atomically persisted) -> [ Retake · Add voice note · Next ] with Next primary.
 * Voice per slot policy: disabled | optional | recommended | required.
 * Required voice blocks Next; recommended emphasizes the button; nothing else nags.
 */
import { useMemo, useRef, useState } from "react";
import { useApp } from "../store/sessionStore";
import { nextIncompleteSlot, reCheckBaseline, slotProgress, isSlotUnlocked } from "../engine/selectors";
import { PhotoInput } from "../capture/PhotoInput";
import { useVoiceRecorder } from "../capture/useVoiceRecorder";
import { useMediaUrl } from "../ui/useMediaUrl";
import { BigButton, formatDuration } from "../ui/bits";
import { ExceptionSheet } from "../ui/ExceptionSheet";

function Thumb({ mediaId, onTap }: { mediaId: string; onTap?: () => void }) {
  const url = useMediaUrl(mediaId);
  return (
    <button type="button" onClick={onTap} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-800">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
    </button>
  );
}

export function CaptureScreen({ slotInstanceId, findingId }: { slotInstanceId: string; findingId?: string }) {
  const { session, config, navigate, capturePhoto, discardPhoto, attachVoice, showToast, resolveFinding } = useApp();
  const recorder = useVoiceRecorder();
  const [lastMediaId, setLastMediaId] = useState<string | null>(null);
  const [excepting, setExcepting] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const { zone, slot } = useMemo(() => {
    for (const z of session?.zones ?? [])
      for (const s of z.slots)
        if (s.instanceId === slotInstanceId) return { zone: z, slot: s };
    return { zone: undefined, slot: undefined };
  }, [session, slotInstanceId]);

  if (!session || !config || !zone || !slot) return null;

  const progress = slotProgress(slot);
  const unlocked = isSlotUnlocked(session, slot);
  const baseline = reCheckBaseline(session, slot);
  const voicePolicy = slot.voiceNote;
  const hasVoice = slot.voiceNotes.length > 0;
  const voiceBlocksNext = voicePolicy === "required" && !hasVoice && slot.photos.length > 0;

  const goNext = () => {
    const next = nextIncompleteSlot(session, zone.zoneId, slot.instanceId);
    setLastMediaId(null);
    if (next) navigate({ name: "capture", slotInstanceId: next.instanceId });
    else navigate({ name: "gate", zoneId: zone.zoneId });
  };

  const activeFinding = findingId
    ? zone.findings.find((f) => f.findingId === findingId && f.status === "open")
    : undefined;

  const onPhoto = async (file: File) => {
    setSaving(true);
    try {
      const id = await capturePhoto(slot.instanceId, file);
      setLastMediaId(id);
      // A reshoot capture resolves its finding — event-linked, append-only.
      if (activeFinding && activeFinding.severity === "reshoot")
        void resolveFinding(activeFinding.findingId, zone.zoneId, "reshot");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Photo failed to save");
    } finally {
      setSaving(false);
    }
  };

  const stopAndSaveVoice = async () => {
    if (savingRef.current) return; // synchronous guard — state alone is stale within a render
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await recorder.stop();
      if (result) {
        await attachVoice(slot.instanceId, result.blob, result.mime, result.durationMs);
        showToast("Voice note saved");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Voice note failed to save");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">{zone.label}</p>
          <h1 className="text-2xl font-bold leading-tight text-slate-100">{slot.label}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {slot.photos.length}/{slot.minCaptures}+ photos
            {slot.needsScaleInFrame && <span className="ml-2 text-amber-400">· scale in frame</span>}
            {voicePolicy === "required" && <span className="ml-2 text-amber-400">· voice note required</span>}
          </p>
        </div>
        <BigButton variant="ghost" onClick={() => navigate({ name: "zone", zoneId: zone.zoneId })}>List</BigButton>
      </header>

      {activeFinding && (
        <p className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-3 text-amber-200">
          Second look: {activeFinding.message}
        </p>
      )}

      {slot.guidance && <p className="rounded-xl bg-slate-800/60 p-3 text-slate-300">{slot.guidance}</p>}

      {!unlocked && (
        <p className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-3 text-amber-200">
          Locked: this slot opens after the water run — every fixture-run capture must be resolved first.
        </p>
      )}

      {baseline && baseline.photos.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-400">Baseline (before water run) — compare against these:</h2>
          <div className="flex gap-2 overflow-x-auto">
            {baseline.photos.map((p) => (<Thumb key={p.mediaId} mediaId={p.mediaId} />))}
          </div>
        </section>
      )}

      {slot.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {slot.photos.map((p) => (
            <Thumb
              key={p.mediaId}
              mediaId={p.mediaId}
              onTap={() => {
                if (confirm("Discard this photo?")) {
                  void discardPhoto(slot.instanceId, p.mediaId).then(() => {
                    if (lastMediaId === p.mediaId) setLastMediaId(null);
                  });
                }
              }}
            />
          ))}
        </div>
      )}

      <div className="flex-1" />

      {progress.kind === "excepted" ? (
        <p className="rounded-xl bg-slate-800 p-4 text-slate-300">
          Excepted: {config.exceptionReasons.find((r) => r.id === progress.reasonId)?.label}
          {slot.exception?.note ? ` — ${slot.exception.note}` : ""}. Clear it from the zone list to capture instead.
        </p>
      ) : recorder.state === "recording" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl bg-alert-950/40 p-4 ring-1 ring-alert-500">
            <span className="flex items-center gap-2 text-alert-200">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-alert-500" />
              Recording — {formatDuration(recorder.elapsedMs)}
            </span>
            <BigButton variant="ghost" onClick={recorder.cancel}>Discard</BigButton>
          </div>
          <BigButton disabled={saving} onClick={() => void stopAndSaveVoice()}>
            {saving ? "Saving…" : "Stop & save note"}
          </BigButton>
        </div>
      ) : lastMediaId ? (
        // Post-photo bar: Retake · Add voice note · Next (primary).
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <BigButton
              variant="ghost"
              className="flex-1"
              onClick={() => { void discardPhoto(slot.instanceId, lastMediaId).then(() => setLastMediaId(null)); }}
            >
              Retake
            </BigButton>
            {voicePolicy !== "disabled" && (
              <BigButton
                variant="secondary"
                className={`flex-1 ${voicePolicy !== "optional" && !hasVoice ? "ring-2 ring-amber-400" : ""}`}
                onClick={() => void recorder.start().then((ok) => { if (!ok) showToast("Microphone unavailable — check Settings"); })}
              >
                Add voice note{voicePolicy === "recommended" && !hasVoice ? " ★" : ""}
              </BigButton>
            )}
          </div>
          <PhotoInput onPhoto={onPhoto} className="min-h-14 rounded-xl border border-slate-600 text-slate-300 active:bg-slate-800" disabled={saving}>
            + Another photo
          </PhotoInput>
          <BigButton disabled={voiceBlocksNext} onClick={goNext}>
            {voiceBlocksNext ? "Voice note required before Next" : "Next"}
          </BigButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <PhotoInput
            onPhoto={onPhoto}
            disabled={!unlocked || saving}
            className="min-h-24 rounded-2xl bg-brass-500 text-2xl font-semibold text-slate-950 active:bg-brass-400 disabled:bg-slate-700 disabled:text-slate-500"
          >
            {saving ? "Saving…" : slot.photos.length > 0 ? "📷 Another photo" : "📷 Capture photo"}
          </PhotoInput>
          <div className="flex gap-3">
            {voicePolicy !== "disabled" && slot.photos.length > 0 && (
              <BigButton
                variant="secondary"
                className="flex-1"
                onClick={() => void recorder.start().then((ok) => { if (!ok) showToast("Microphone unavailable — check Settings"); })}
              >
                Add voice note
              </BigButton>
            )}
            <BigButton variant="ghost" className="flex-1" onClick={() => setExcepting(true)}>Can't capture</BigButton>
            {(slot.photos.length > 0 || !slot.required) && (
              <BigButton variant="secondary" className="flex-1" disabled={voiceBlocksNext} onClick={goNext}>
                {voiceBlocksNext ? "Voice required" : "Next"}
              </BigButton>
            )}
          </div>
        </div>
      )}

      <ExceptionSheet
        slotInstanceId={excepting ? slot.instanceId : null}
        slotLabel={slot.label}
        onClose={() => setExcepting(false)}
        onDone={goNext}
      />
    </div>
  );
}
