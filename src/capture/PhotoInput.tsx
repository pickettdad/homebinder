/**
 * Capture via the native camera: <input type="file" capture="environment">.
 *
 * Chosen over a getUserMedia viewfinder for *deliberate* shots: full 12MP stills
 * (getUserMedia caps at video resolution on iPadOS and the full-res ImageCapture API is
 * unsupported), proper low-light handling for basements, the OS flash toggle for free,
 * and none of the standalone-PWA camera-permission bugs. On desktop this opens a file
 * picker — exactly what the desktop-fixture workflow wants.
 *
 * The complement is `SweepCamera`: a stay-open viewfinder for the walkabout sweep, where
 * rate matters more than resolution. Deliberate shot → here. Rapid sweep → there.
 */
import { useRef, type ReactNode } from "react";

function MediaInput(props: {
  accept: string;
  onFile: (file: File) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={props.accept}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void props.onFile(file);
          e.target.value = ""; // allow re-capturing the same slot repeatedly
        }}
      />
      <button
        type="button"
        disabled={props.disabled}
        className={props.className}
        onClick={() => inputRef.current?.click()}
      >
        {props.children}
      </button>
    </>
  );
}

export function PhotoInput(props: {
  onPhoto: (file: File) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return <MediaInput accept="image/*" onFile={props.onPhoto} {...props} />;
}

/**
 * Video through the same native-camera door. Deliberately NOT MediaRecorder-in-the-page:
 * the OS recorder handles long takes, thermal throttling, the flash toggle and storage
 * pressure — all of which a page-level recorder gets wrong on iPadOS. Storage is not a
 * constraint here (owner ruling 2026-07-25), so nothing is transcoded or downscaled.
 */
export function VideoInput(props: {
  /** durationMs is best-effort: undefined when the browser won't report it. */
  onVideo: (file: File, durationMs?: number) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <MediaInput
      accept="video/*"
      onFile={async (file) => props.onVideo(file, await probeDurationMs(file))}
      disabled={props.disabled}
      className={props.className}
    >
      {props.children}
    </MediaInput>
  );
}

/**
 * Read a clip's length from its metadata so the grid can say "0:47" instead of just "video".
 * Best-effort by design: a failed probe must never cost the capture, so every failure path
 * resolves undefined rather than rejecting.
 */
export function probeDurationMs(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    const done = (ms?: number) => {
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    const timer = setTimeout(() => done(undefined), 5000); // never hang the capture
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      clearTimeout(timer);
      done(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration * 1000) : undefined);
    };
    el.onerror = () => {
      clearTimeout(timer);
      done(undefined);
    };
    el.src = url;
  });
}
