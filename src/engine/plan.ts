/**
 * Plan compiler: (route config, property flags, room list) -> the concrete slot plan.
 *
 * Pure and deterministic: the same inputs always produce the same plan, which is why the
 * fold can re-derive it from the pinned config snapshot + events instead of storing it.
 *
 * Slot instance ids are stable, human-legible paths:
 *   zone slot:  "<zoneId>/<slotId>"                e.g. "basement/bsmt.furnace-nameplate"
 *   room step:  "<zoneId>/<roomInstanceId>/<key>"  e.g. "upper-floor/0198.../windows"
 */
import type { RouteConfig, SlotDef, TemplateSlot, VoicePolicy, SlotConstraint } from "./schema/routeConfig";
import { evaluateWhen } from "./schema/routeConfig";
import type { RoomInstance } from "./schema/events";

export interface PlanSlot {
  instanceId: string;
  /** Definition id: slot id, or "<templateId>.<key>" for room steps. */
  defId: string;
  zoneId: string;
  roomInstanceId?: string;
  /** Which conditional block injected this slot, if any. */
  fromConditional?: string;
  label: string;
  guidance?: string;
  required: boolean;
  minCaptures: number;
  voiceNote: VoicePolicy;
  needsScaleInFrame: boolean;
  tags: string[];
  reCheckOf?: string;
  constraints: SlotConstraint[];
}

export interface PlanZone {
  zoneId: string;
  label: string;
  intro?: string;
  slots: PlanSlot[];
}

export interface SessionPlan {
  zones: PlanZone[];
}

/** Which template id a step originally came from (for defId stability under extends). */
function templateStepOrigins(config: RouteConfig, id: string): { step: TemplateSlot; templateId: string }[] {
  const template = config.templates.find((t) => t.id === id);
  if (!template) throw new Error(`unknown template: ${id}`);
  const parents = template.extends ? templateStepOrigins(config, template.extends) : [];
  return [...parents, ...template.slots.map((step) => ({ step, templateId: id }))];
}

function slotFromDef(def: SlotDef, zoneId: string, fromConditional?: string): PlanSlot {
  return {
    instanceId: `${zoneId}/${def.id}`,
    defId: def.id,
    zoneId,
    fromConditional,
    label: def.label,
    guidance: def.guidance,
    required: def.required,
    minCaptures: def.minCaptures,
    voiceNote: def.voiceNote,
    needsScaleInFrame: def.needsScaleInFrame,
    tags: def.tags,
    reCheckOf: def.reCheckOf,
    constraints: def.constraints,
  };
}

function slotFromTemplateStep(
  origin: { step: TemplateSlot; templateId: string },
  zoneId: string,
  room: RoomInstance,
): PlanSlot {
  const { step, templateId } = origin;
  const interpolate = (s: string) => s.replaceAll("{room}", room.label);
  return {
    instanceId: `${zoneId}/${room.roomInstanceId}/${step.key}`,
    defId: `${templateId}.${step.key}`,
    zoneId,
    roomInstanceId: room.roomInstanceId,
    label: interpolate(step.label),
    guidance: step.guidance ? interpolate(step.guidance) : undefined,
    required: step.required,
    minCaptures: step.minCaptures,
    voiceNote: step.voiceNote,
    needsScaleInFrame: step.needsScaleInFrame,
    tags: step.tags,
    reCheckOf: step.reCheckOf,
    constraints: step.constraints,
  };
}

export function compilePlan(config: RouteConfig, flags: readonly string[], rooms: readonly RoomInstance[]): SessionPlan {
  const flagSet = new Set(flags);
  const activeBlocks = config.conditionalBlocks.filter((b) => evaluateWhen(b.when, flagSet));

  const zones: PlanZone[] = config.zones.map((zone) => {
    const start: PlanSlot[] = [];
    const end: PlanSlot[] = [];
    for (const block of activeBlocks) {
      for (const inj of block.inject) {
        if (inj.zoneId !== zone.id) continue;
        const target = inj.position === "start" ? start : end;
        target.push(...inj.slots.map((s) => slotFromDef(s, zone.id, block.id)));
      }
    }

    const base = zone.slots.map((s) => slotFromDef(s, zone.id));

    const roomSlots: PlanSlot[] = [];
    for (const room of rooms) {
      if (room.zoneId !== zone.id) continue;
      const accepts = zone.rooms.find((r) => r.roomKinds.includes(room.kind));
      if (!accepts) continue; // room of a kind this zone doesn't take — setup UI prevents this
      const origins = templateStepOrigins(config, accepts.template);
      roomSlots.push(...origins.map((o) => slotFromTemplateStep(o, zone.id, room)));
    }

    return { zoneId: zone.id, label: zone.label, intro: zone.intro, slots: [...start, ...base, ...roomSlots, ...end] };
  });

  return { zones };
}

/** Every slot in the plan, flat, in route order. */
export function planSlots(plan: SessionPlan): PlanSlot[] {
  return plan.zones.flatMap((z) => z.slots);
}
