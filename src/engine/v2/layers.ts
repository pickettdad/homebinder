/**
 * Layers — saved views over pins (REDESIGN-v2 §3 / PLAN-STAGE-1 §5). Defined in the
 * checklist config (they're binder artifacts the export must be able to re-derive), so
 * the app only *reads* them. A pin matches a layer when the layer's predicate is empty
 * (the "all" view) or the pin hits ANY listed flag OR component type.
 *
 * Pure + config-driven so the same predicate serves the canvas chips today and the
 * binder builder's layer views at export.
 */
import type { LayerDef } from "../schema/checklistConfig";
import type { PinStateV2 } from "./fold";

export function pinMatchesLayer(pin: PinStateV2, layer: LayerDef): boolean {
  const { flags, componentTypes } = layer.predicate;
  if (!flags?.length && !componentTypes?.length) return true; // empty predicate = every pin
  if (flags?.length && pin.flag && flags.includes(pin.flag)) return true;
  if (
    componentTypes?.length &&
    pin.pinType?.kind === "component" &&
    componentTypes.includes(pin.pinType.componentType)
  )
    return true;
  return false;
}

/** Layers that actually match at least one of the given pins — for chip rows that
 *  shouldn't offer empty filters. Order follows the config (authored priority). */
export function relevantLayers(layers: LayerDef[], pins: PinStateV2[]): LayerDef[] {
  return layers.filter((l) => pins.some((p) => pinMatchesLayer(p, l)));
}
