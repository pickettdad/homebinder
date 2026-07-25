/**
 * Stay-open viewfinder for the walkabout sweep.
 *
 * WHY THIS EXISTS ALONGSIDE `PhotoInput`: the inspection has two speeds. Passes 1–3 are a
 * fast repetitive sweep — walk, shoot, keep moving — where the native camera's open/shoot/
 * confirm/close round-trip is the whole cost. Pass 4 is deliberate: a nameplate that must
 * stay legible, where 12MP matters and one round-trip is nothing. This component serves the
 * first; `PhotoInput` serves the second. Both file into the same place.
 *
 * KNOWN TRADE-OFF, stated plainly: getUserMedia hands back *video* frames, so a sweep shot
 * is roughly 1080p–4K depending on what the device grants — not the 12MP a native still
 * gives. That is the price of staying open, and it is the right price for context shots.
 * Shoot nameplates and fine cracks with the still camera.
 *
 * TORCH: `applyConstraints({advanced:[{torch}]})` is Chromium-only in practice — iOS Safari
 * does not expose it. The button is therefore *feature-detected*, not assumed: it only
 * renders where the capability is actually reported, so the field never sees a dead control.
 * On iPadOS, use the still camera's native flash for dark spaces.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** `torch` is not in the DOM lib's MediaTrack types (it is an unshipped-in-Safari extension),
 *  so it is declared locally rather than reached for with `any`. */
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraintSet = MediaTrackConstraintSet & { torch?: boolean };

export function SweepCamera(props: {
  /** Where shots are landing ("Kitchen", "Inbox") — shown on screen so it is never a mystery. */
  destination: string;
  onShot: (blob: Blob) => Promise<unknown>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [count, setCount] = useState(0);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        // Ask for the most the device will give; it will clamp to what the sensor supports.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 4096 }, height: { ideal: 2160 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        // getCapabilities is itself absent on some WebKit builds — hence the optional call.
        const caps = stream.getVideoTracks()[0]?.getCapabilities?.() as TorchCapabilities | undefined;
        setTorchSupported(caps?.torch === true);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof DOMException && err.name === "NotAllowedError"
              ? "Camera permission was refused. Allow camera access for this site, or use the still camera."
              : "Could not open the viewfinder on this device — use the still camera instead.",
          );
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Revoke the previous preview URL rather than leaking one per shot across a long sweep.
  useEffect(() => () => { if (lastUrl) URL.revokeObjectURL(lastUrl); }, [lastUrl]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as TorchConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false); // reported capable but refused — stop offering it
    }
  }, [torchOn]);

  const shoot = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busy || !video.videoWidth) return;
    setBusy(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 90);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(video, 0, 0);
      // 0.92 JPEG, no downscale: storage is not a constraint (owner ruling 2026-07-25).
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
      if (!blob) throw new Error("encode failed");
      await props.onShot(blob);
      setCount((n) => n + 1);
      setLastUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch {
      setError("That shot didn't save — storage may be full.");
    } finally {
      setBusy(false);
    }
  }, [busy, props]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
        {flash && <div className="pointer-events-none absolute inset-0 bg-white/70" />}
        {error && (
          <div className="absolute inset-x-4 top-4 rounded-xl bg-slate-900/95 p-4 text-center text-amber-200 ring-1 ring-amber-700">
            {error}
          </div>
        )}
        {/* Destination is always on screen — the field report's core complaint was not
            knowing where a capture went. */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-4">
          <span className="rounded-full bg-black/60 px-3 py-1.5 text-sm font-medium text-slate-100">
            → {props.destination}
          </span>
          <div className="flex items-center gap-2">
            {torchSupported && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                aria-pressed={torchOn}
                className={`rounded-full px-4 py-2 text-xl ${torchOn ? "bg-amber-400 text-slate-950" : "bg-black/60 text-slate-100"}`}
              >
                🔦
              </button>
            )}
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-slate-100"
            >
              Done{count > 0 ? ` (${count})` : ""}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-6 bg-black px-8 py-6">
        {/* Last shot: confirms it landed without leaving the viewfinder. */}
        <div className="h-16 w-16 overflow-hidden rounded-xl ring-1 ring-slate-700">
          {lastUrl && <img src={lastUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <button
          type="button"
          onClick={() => void shoot()}
          disabled={busy || !!error}
          aria-label="Take photo"
          className="h-20 w-20 rounded-full bg-white ring-4 ring-white/40 active:bg-slate-300 disabled:opacity-40"
        />
        <div className="w-16 text-right text-sm text-slate-400">
          {count} shot{count === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}
