import { useRef, useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton, Sheet } from "../../ui/bits";
import { useMediaUrl } from "../../ui/useMediaUrl";
import { suggestedPinTypes } from "../../engine/v2/checklist";
import { pinMatchesLayer, relevantLayers } from "../../engine/v2/layers";
import type { PinTypeRef } from "../../engine/v2/events";
import { TypePicker, pinTypeLabel } from "./shared";

/**
 * A photo canvas: pinch-zoom + pan, anchor dots with pin numbers, tap-to-pin.
 * - placePinId set → a tap places an anchor for that pin.
 * - Stamp mode → each tap creates a NEW typed pin (own permanent number) right there.
 *   Field test 3: "mark every receptacle" needs one identity per receptacle so a single
 *   one can be flagged monitor — stamping makes that a tap per outlet.
 * - Otherwise → a tap creates an untyped pin and opens it.
 * Tapping an existing dot opens actions (open pin / remove this anchor).
 *
 * Coordinates: taps are normalized against the transformed image's bounding rect, so
 * the math is zoom-independent. Anchors are absolutely positioned INSIDE the
 * transformed element and track pan/zoom for free.
 */
export function CanvasScreen({ canvasId, zoneId, placePinId }: { canvasId: string; zoneId: string; placePinId?: string }) {
  const { v2Session, v2Config, navigate, createPinAt, placeAnchor, removeAnchor, showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const [stampType, setStampType] = useState<PinTypeRef | null>(null);
  const [stampSheet, setStampSheet] = useState(false);
  const [anchorSheet, setAnchorSheet] = useState<{ anchorId: string; pinId: string; number: number } | null>(null);
  const [layerId, setLayerId] = useState<string | null>(null); // null = All
  const view = useRef({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; mid: { x: number; y: number }; tx: number; ty: number } | null>(null);
  const moved = useRef(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const zone = v2Session?.zones.find((z) => z.zoneId === zoneId);
  const canvas = zone?.canvases.find((c) => c.canvasId === canvasId);
  const url = useMediaUrl(canvas?.media.mediaId);
  if (!v2Session || !v2Config || !zone || !canvas) return null;
  // View-only when the inspection is completed OR this canvas's zone is closed.
  const ro = !!v2Session.completedAt || !!zone.closedAt;

  const placePin = placePinId ? v2Session.pins.find((p) => p.pinId === placePinId) : undefined;
  const anchored = v2Session.pins
    .filter((p) => !p.retired)
    .flatMap((p) => p.anchors.filter((a) => a.canvasId === canvasId).map((a) => ({ pin: p, anchor: a })));
  // Layer chips: only offer layers that actually match a pin on THIS canvas (no empty filters).
  const chips = relevantLayers(v2Config.layers, anchored.map(({ pin }) => pin));
  const activeLayer = layerId ? v2Config.layers.find((l) => l.id === layerId) : undefined;
  const shown = activeLayer ? anchored.filter(({ pin }) => pinMatchesLayer(pin, activeLayer)) : anchored;

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
    if (moved.current || busy || ro) return;
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
    } else if (stampType) {
      // Stamp mode: stay on the canvas — one tap, one new typed pin.
      void createPinAt(zoneId, canvasId, x, y, stampType)
        .then((pinId) => {
          const n = useApp.getState().v2Session?.pins.find((p) => p.pinId === pinId)?.number;
          showToast(`#${n ?? "?"} ${pinTypeLabel(stampType)}`);
        })
        .catch((err) => showToast(err instanceof Error ? err.message : "Could not stamp pin"))
        .finally(done);
    } else {
      void createPinAt(zoneId, canvasId, x, y)
        .then((pinId) => navigate({ name: "pin", pinId }))
        .catch((err) => showToast(err instanceof Error ? err.message : "Could not place pin"))
        .finally(done);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-slate-950">
      <header className="flex items-center gap-3 p-4">
        <BigButton variant="ghost" onClick={() => navigate({ name: "zone2", zoneId })}>←</BigButton>
        <p className="flex-1 text-sm text-slate-300">
          {ro
            ? "Viewing — pinch to zoom. Reopen the inspection to edit."
            : placePin
              ? `Tap where pin #${placePin.number} lives`
              : stampType
                ? `Stamping ${pinTypeLabel(stampType)} — every tap is a NEW numbered pin`
                : "Tap to drop a new pin · pinch to zoom"}
        </p>
        {!ro && !placePinId &&
          (stampType ? (
            <BigButton variant="danger" onClick={() => setStampType(null)}>Stop</BigButton>
          ) : (
            <BigButton variant="secondary" onClick={() => setStampSheet(true)}>Stamp</BigButton>
          ))}
      </header>

      {chips.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2">
          <button
            type="button"
            onClick={() => setLayerId(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ring-1 ${
              layerId === null ? "bg-teal-600 text-white ring-teal-500" : "bg-slate-800 text-slate-300 ring-slate-600"
            }`}
          >
            All ({anchored.length})
          </button>
          {chips.map((l) => {
            const n = anchored.filter(({ pin }) => pinMatchesLayer(pin, l)).length;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLayerId(l.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ring-1 ${
                  layerId === l.id ? "bg-teal-600 text-white ring-teal-500" : "bg-slate-800 text-slate-300 ring-slate-600"
                }`}
              >
                {l.label} ({n})
              </button>
            );
          })}
        </div>
      )}

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
              {shown.map(({ pin, anchor }) => (
                <button
                  key={anchor.anchorId}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnchorSheet({ anchorId: anchor.anchorId, pinId: pin.pinId, number: pin.number });
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

      <Sheet open={stampSheet} onClose={() => setStampSheet(false)} title="Stamp pins">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-400">
            Pick a type, then every tap drops a new pin with its own number — so one
            receptacle can be flagged without painting the rest.
          </p>
          <TypePicker
            choices={suggestedPinTypes(v2Config, zone.zoneType)}
            onPick={(pinType) => {
              setStampType(pinType);
              setStampSheet(false);
            }}
          />
        </div>
      </Sheet>

      <Sheet
        open={anchorSheet !== null}
        onClose={() => setAnchorSheet(null)}
        title={anchorSheet ? `Pin #${anchorSheet.number}` : ""}
      >
        {anchorSheet && (
          <div className="flex flex-col gap-3">
            <BigButton onClick={() => navigate({ name: "pin", pinId: anchorSheet.pinId })}>
              Open pin #{anchorSheet.number}
            </BigButton>
            {!ro && (
              <>
                <BigButton
                  variant="danger"
                  onClick={() => {
                    void removeAnchor(anchorSheet.anchorId)
                      .then(() => {
                        setAnchorSheet(null);
                        showToast("Marker removed — the pin and its number remain");
                      })
                      .catch((err) => showToast(err instanceof Error ? err.message : "Could not remove"));
                  }}
                >
                  Remove this marker
                </BigButton>
                <p className="text-xs text-slate-500">
                  Removing a marker only takes it off this photo — the pin keeps its number,
                  record, and any other placements. To drop the whole pin, open it and retire.
                </p>
              </>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
