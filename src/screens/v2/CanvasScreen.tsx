import { useRef, useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton } from "../../ui/bits";
import { useMediaUrl } from "../../ui/useMediaUrl";

/**
 * A photo canvas: pinch-zoom + pan, anchor dots with pin numbers, tap-to-pin.
 * With placePinId set, a tap places an anchor for that pin; otherwise a tap creates a
 * new pin at that spot (number assigned by the storage transaction).
 *
 * Coordinates: taps are normalized against the transformed image's bounding rect, so
 * the math is zoom-independent. Anchors are absolutely positioned INSIDE the
 * transformed element and track pan/zoom for free.
 */
export function CanvasScreen({ canvasId, zoneId, placePinId }: { canvasId: string; zoneId: string; placePinId?: string }) {
  const { v2Session, navigate, createPin, placeAnchor, showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const view = useRef({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; mid: { x: number; y: number }; tx: number; ty: number } | null>(null);
  const moved = useRef(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const zone = v2Session?.zones.find((z) => z.zoneId === zoneId);
  const canvas = zone?.canvases.find((c) => c.canvasId === canvasId);
  const url = useMediaUrl(canvas?.media.mediaId);
  if (!v2Session || !zone || !canvas) return null;

  const placePin = placePinId ? v2Session.pins.find((p) => p.pinId === placePinId) : undefined;
  const anchored = v2Session.pins
    .filter((p) => !p.retired)
    .flatMap((p) => p.anchors.filter((a) => a.canvasId === canvasId).map((a) => ({ pin: p, anchor: a })));

  const apply = () => {
    const el = innerRef.current;
    if (el) el.style.transform = `translate(${view.current.tx}px, ${view.current.ty}px) scale(${view.current.scale})`;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        scale: view.current.scale,
        mid: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 },
        tx: view.current.tx,
        ty: view.current.ty,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (Math.hypot(dx, dy) > 6) moved.current = true;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const factor = dist / gesture.current.dist;
      const scale = Math.min(6, Math.max(1, gesture.current.scale * factor));
      const applied = scale / gesture.current.scale;
      // Keep the pinch midpoint stationary while scaling around it.
      view.current.scale = scale;
      view.current.tx = gesture.current.mid.x - (gesture.current.mid.x - gesture.current.tx) * applied;
      view.current.ty = gesture.current.mid.y - (gesture.current.mid.y - gesture.current.ty) * applied;
      apply();
    } else if (pointers.current.size === 1 && view.current.scale > 1) {
      view.current.tx += dx;
      view.current.ty += dy;
      apply();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (view.current.scale <= 1.02 && pointers.current.size === 0) {
      view.current = { scale: 1, tx: 0, ty: 0 };
      apply();
    }
  };

  const onTap = (e: React.MouseEvent) => {
    if (moved.current || busy) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    setBusy(true);
    const done = () => setBusy(false);
    if (placePinId) {
      void placeAnchor(placePinId, canvasId, x, y)
        .then(() => {
          showToast(`Pin #${placePin?.number ?? ""} placed`);
          navigate({ name: "pin", pinId: placePinId });
        })
        .finally(done);
    } else {
      void createPin(zoneId)
        .then(async (pinId) => {
          await placeAnchor(pinId, canvasId, x, y);
          navigate({ name: "pin", pinId });
        })
        .catch((err) => showToast(err instanceof Error ? err.message : "Could not place pin"))
        .finally(done);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-slate-950">
      <header className="flex items-center gap-3 p-4">
        <BigButton variant="ghost" onClick={() => navigate({ name: "zone2", zoneId })}>←</BigButton>
        <p className="flex-1 text-sm text-slate-300">
          {placePin ? `Tap where pin #${placePin.number} lives` : "Tap to drop a new pin · pinch to zoom"}
        </p>
      </header>
      <div
        className="relative flex-1 overflow-hidden"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onTap}
      >
        <div ref={innerRef} style={{ transformOrigin: "0 0" }} className="absolute inset-0">
          {url && (
            <div className="relative">
              <img ref={imgRef} src={url} alt="" className="w-full select-none" draggable={false} />
              {anchored.map(({ pin, anchor }) => (
                <button
                  key={anchor.anchorId}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate({ name: "pin", pinId: pin.pinId });
                  }}
                  className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-slate-950 ${
                    pin.flag === "issue" ? "bg-rose-600" : pin.flag === "monitor" ? "bg-amber-600" : "bg-teal-600"
                  }`}
                  style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }}
                >
                  {pin.number}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
