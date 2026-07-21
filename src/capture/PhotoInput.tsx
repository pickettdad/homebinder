/**
 * Photo capture via the native camera: <input type="file" capture="environment">.
 *
 * Chosen over a getUserMedia viewfinder deliberately: full 12MP stills (getUserMedia
 * caps at video resolution on iPadOS and the full-res ImageCapture API is unsupported),
 * proper low-light handling for basements, and none of the standalone-PWA camera-
 * permission bugs. On desktop this opens a file picker — which is exactly what the
 * desktop-fixture workflow wants. If field testing shows the round-trip is too slow,
 * an in-app viewfinder can be added behind this same component boundary.
 */
import { useRef, type ReactNode } from "react";

export function PhotoInput(props: {
  onPhoto: (file: File) => void | Promise<void>;
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
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void props.onPhoto(file);
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
