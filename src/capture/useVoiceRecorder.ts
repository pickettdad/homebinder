/**
 * Voice notes via MediaRecorder. Safari yields audio/mp4 (AAC) — negotiated with
 * isTypeSupported, actual mime recorded with the capture. If the mic fails, the UI's typed-note
 * fallback in the exception path still works and the capture is never blocked from saving.
 *
 * ⚑ **The microphone stream is held separately from the recorder, so a note can be closed and
 * another opened without letting go of the mic** (owner requirement 2026-08-30). A trace of a
 * mechanical room is seven or eight legs; the concierge narrates continuously and each leg wants
 * its own file, *"so the desk does not need to fish through all audio through all legs."*
 *
 * ⛑ **`getUserMedia` is the expensive half and it used to run on every start.** `stop` released the
 * tracks and `start` re-acquired them, which on iOS is a fresh permission round trip and a hardware
 * open — hundreds of milliseconds, at every leg boundary, taken out of the middle of a sentence.
 * `stop({ keepStream: true })` keeps the tracks open so the next `start` is a `new MediaRecorder`
 * on a stream that is already live. **The mic is released on `cancel` and on unmount**, which are
 * the two moments it should be.
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
  /** Held across a stop/start cycle. ⚑ Owned here rather than reached through the recorder, so a
   *  released recorder cannot take the microphone with it. */
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** @param keepStream leave the microphone open for an immediate restart — see the header. */
  const cleanup = useCallback((keepStream = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current = null;
    if (!keepStream) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => cleanup(false), [cleanup]);

  const start = useCallback(async (): Promise<boolean> => {
    if (typeof MediaRecorder === "undefined") { setState("unsupported"); return false; }
    try {
      /* ⚑ Reused when it is still live. A track that has ended cannot be recorded from, so the
         state is checked rather than the reference — *the thing consulted must be the thing that
         governs*, which this file has watched cost four days elsewhere. */
      const held = streamRef.current;
      const stream =
        held && held.getAudioTracks().some((t) => t.readyState === "live")
          ? held
          : await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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

  const stop = useCallback(
    (options?: { keepStream?: boolean }): Promise<{ blob: Blob; mime: string; durationMs: number } | null> => {
      const keepStream = options?.keepStream ?? false;
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanup(keepStream);
        setState("idle");
        return Promise.resolve(null);
      }
      return new Promise((resolve) => {
        recorder.onstop = () => {
          const mime = recorder.mimeType || pickAudioMime() || "audio/mp4";
          const blob = new Blob(chunksRef.current, { type: mime });
          const durationMs = Date.now() - startedAtRef.current;
          cleanup(keepStream);
          setState("idle");
          resolve(blob.size > 0 ? { blob, mime, durationMs } : null);
        };
        recorder.stop();
      });
    },
    [cleanup],
  );

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup(false);
    setState("idle");
  }, [cleanup]);

  return { state, elapsedMs, start, stop, cancel, releaseMic };
}
