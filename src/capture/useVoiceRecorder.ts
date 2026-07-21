/**
 * Voice notes via MediaRecorder. Safari yields audio/mp4 (AAC) — negotiated with
 * isTypeSupported, actual mime recorded with the capture. Stream is acquired per
 * recording and released after; if the mic fails, the UI's typed-note fallback in the
 * exception path still works and the capture is never blocked from saving.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const CANDIDATE_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

export function pickAudioMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

export type RecorderState = "idle" | "recording" | "unsupported" | "denied";

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>(
    typeof MediaRecorder === "undefined" ? "unsupported" : "idle",
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async (): Promise<boolean> => {
    if (typeof MediaRecorder === "undefined") { setState("unsupported"); return false; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickAudioMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(1000); // periodic chunks: a crash loses at most the last second
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
      setState("recording");
      return true;
    } catch {
      setState("denied");
      return false;
    }
  }, []);

  const stop = useCallback((): Promise<{ blob: Blob; mime: string; durationMs: number } | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") { cleanup(); setState("idle"); return Promise.resolve(null); }
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const mime = recorder.mimeType || pickAudioMime() || "audio/mp4";
        const blob = new Blob(chunksRef.current, { type: mime });
        const durationMs = Date.now() - startedAtRef.current;
        cleanup();
        setState("idle");
        resolve(blob.size > 0 ? { blob, mime, durationMs } : null);
      };
      recorder.stop();
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    setState("idle");
  }, [cleanup]);

  return { state, elapsedMs, start, stop, cancel };
}
