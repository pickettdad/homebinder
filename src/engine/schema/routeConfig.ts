/**
 * Route configuration schema — the contract for the file that defines the inspection.
 *
 * The route is PURE DATA: no functions, no expressions. Conditionality is a closed
 * vocabulary of boolean property flags combined with allOf/anyOf/not — nothing more.
 * Anything needing real logic becomes code that emits a flag; the vocabulary stays closed.
 *
 * Authored today as a typed TS module (src/config/route.baseline.ts). Because the shape
 * is JSON-serializable and Zod-validated, externalizing to a fetched JSON file later is
 * a loader swap, not a remodel.
 */
import { z } from "zod";

export const VOICE_POLICIES = ["disabled", "optional", "recommended", "required"] as const;
export type VoicePolicy = (typeof VOICE_POLICIES)[number];

/** ids are lowercase kebab/dot: 'ext.front-elevation', 'well.head-wide', 'bedroom' */
const idPattern = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/;
const idSchema = z.string().regex(idPattern, "ids are lowercase kebab-case, dot-separated segments");

const constraintSchema = z.object({
  /** Slot unlocks only after every slot carrying `tag` is resolved (captured or excepted). */
  type: z.literal("afterAllTagged"),
  tag: z.string().min(1),
});
export type SlotConstraint = z.infer<typeof constraintSchema>;

const slotCoreShape = {
  label: z.string().min(1),
  guidance: z.string().optional(),
  required: z.boolean().default(true),
  minCaptures: z.number().int().min(1).default(1),
  voiceNote: z.enum(VOICE_POLICIES).default("optional"),
  needsScaleInFrame: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  /** Points at a baseline slot; UI shows that slot's photos side-by-side at capture time. */
  reCheckOf: idSchema.optional(),
  constraints: z.array(constraintSchema).default([]),
};

const slotDefSchema = z.object({ id: idSchema, ...slotCoreShape });
export type SlotDef = z.output<typeof slotDefSchema>;

/** Template steps use a local key (unique within the template), not a global id. */
const templateSlotSchema = z.object({ key: idSchema, ...slotCoreShape });
export type TemplateSlot = z.output<typeof templateSlotSchema>;

const roomTemplateSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  /** Single-level inheritance: parent steps first, then this template's steps. */
  extends: idSchema.optional(),
  slots: z.array(templateSlotSchema),
});
export type RoomTemplate = z.output<typeof roomTemplateSchema>;

const zoneRoomsSchema = z.object({
  template: idSchema,
  roomKinds: z.array(idSchema).min(1),
});

const zoneDefSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  intro: z.string().optional(),
  slots: z.array(slotDefSchema).default([]),
  /** Which room kinds this zone accepts, and the template each expands with. */
  rooms: z.array(zoneRoomsSchema).default([]),
});
export type ZoneDef = z.output<typeof zoneDefSchema>;

const whenSchema = z
  .object({
    allOf: z.array(idSchema).optional(),
    anyOf: z.array(idSchema).optional(),
    not: z.array(idSchema).optional(),
  })
  .refine((w) => w.allOf?.length || w.anyOf?.length || w.not?.length, {
    message: "when must reference at least one flag",
  });
export type WhenClause = z.output<typeof whenSchema>;

const conditionalBlockSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  when: whenSchema,
  inject: z
    .array(
      z.object({
        zoneId: idSchema,
        position: z.enum(["start", "end"]).default("end"),
        slots: z.array(slotDefSchema).min(1),
      }),
    )
    .min(1),
});
export type ConditionalBlock = z.output<typeof conditionalBlockSchema>;

const profileFlagSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  hint: z.string().optional(),
});

const roomKindSchema = z.object({ id: idSchema, label: z.string().min(1) });

const exceptionReasonSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  requiresNote: z.boolean().default(false),
  /** Deferrals with this reason land on the visit-two gap list in the export. */
  feedsGapList: z.boolean().default(false),
});
export type ExceptionReason = z.output<typeof exceptionReasonSchema>;

const routeConfigObject = z.object({
  routeId: idSchema,
  title: z.string().min(1),
  /** Bumped in the same commit as any route edit. The content hash is what proves bytes. */
  configVersion: z.string().regex(/^\d+\.\d+\.\d+$/, "configVersion is semver"),
  profileFlags: z.array(profileFlagSchema),
  roomKinds: z.array(roomKindSchema),
  exceptionReasons: z.array(exceptionReasonSchema).min(1),
  templates: z.array(roomTemplateSchema).default([]),
  zones: z.array(zoneDefSchema).min(1),
  conditionalBlocks: z.array(conditionalBlockSchema).default([]),
});

export const routeConfigSchema = routeConfigObject.superRefine((cfg, ctx) => {
  const flagIds = new Set(cfg.profileFlags.map((f) => f.id));
  const roomKindIds = new Set(cfg.roomKinds.map((k) => k.id));
  const templateIds = new Set(cfg.templates.map((t) => t.id));
  const zoneIds = new Set<string>();
  const slotIds = new Set<string>();
  const allTags = new Set<string>();

  const addUnique = (set: Set<string>, id: string, what: string) => {
    if (set.has(id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate ${what} id: ${id}` });
    set.add(id);
  };

  const seenTemplateIds = new Set<string>();
  for (const t of cfg.templates) {
    // A duplicated template id would be silently shadowed (first match wins everywhere)
    // — the config layer's promise is that bad edits fail loudly instead.
    addUnique(seenTemplateIds, t.id, "template");
    if (t.extends && !templateIds.has(t.extends))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `template ${t.id} extends unknown template ${t.extends}` });
    // Walk the full extends chain: any revisit is a cycle (covers self-extends too).
    // Without this, a cycle would stack-overflow the plan compiler at runtime.
    const visited = new Set<string>([t.id]);
    let parentId = t.extends;
    while (parentId) {
      if (visited.has(parentId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `template ${t.id} has a circular extends chain` });
        break;
      }
      visited.add(parentId);
      parentId = cfg.templates.find((p) => p.id === parentId)?.extends;
    }
    const keys = new Set<string>();
    for (const s of t.slots) {
      addUnique(keys, s.key, `step key in template ${t.id}`);
      s.tags.forEach((tag) => allTags.add(tag));
    }
  }

  for (const zone of cfg.zones) {
    addUnique(zoneIds, zone.id, "zone");
    for (const s of zone.slots) {
      addUnique(slotIds, s.id, "slot");
      s.tags.forEach((tag) => allTags.add(tag));
    }
    for (const r of zone.rooms) {
      if (!templateIds.has(r.template))
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `zone ${zone.id} references unknown template ${r.template}` });
      for (const kind of r.roomKinds)
        if (!roomKindIds.has(kind))
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `zone ${zone.id} references unknown room kind ${kind}` });
    }
  }

  for (const block of cfg.conditionalBlocks) {
    for (const flags of [block.when.allOf ?? [], block.when.anyOf ?? [], block.when.not ?? []])
      for (const f of flags)
        if (!flagIds.has(f))
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `conditional ${block.id} references unknown flag ${f}` });
    for (const inj of block.inject) {
      if (!zoneIds.has(inj.zoneId))
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `conditional ${block.id} injects into unknown zone ${inj.zoneId}` });
      for (const s of inj.slots) {
        addUnique(slotIds, s.id, "slot");
        s.tags.forEach((tag) => allTags.add(tag));
      }
    }
  }

  // Referential checks that need the full slot universe.
  const checkSlotRefs = (slots: { id?: string; key?: string; reCheckOf?: string; constraints: SlotConstraint[] }[], where: string) => {
    for (const s of slots) {
      if (s.reCheckOf && !slotIds.has(s.reCheckOf))
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${where}: reCheckOf targets unknown slot ${s.reCheckOf}` });
      for (const c of s.constraints)
        if (!allTags.has(c.tag))
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${where}: afterAllTagged references tag '${c.tag}' carried by no slot` });
    }
  };
  for (const zone of cfg.zones) checkSlotRefs(zone.slots, `zone ${zone.id}`);
  for (const block of cfg.conditionalBlocks) for (const inj of block.inject) checkSlotRefs(inj.slots, `conditional ${block.id}`);
  for (const t of cfg.templates) checkSlotRefs(t.slots, `template ${t.id}`);
});

/** What the author writes (defaults optional). */
export type RouteConfigInput = z.input<typeof routeConfigObject>;
/** What the app runs on (defaults applied, validated). */
export type RouteConfig = z.output<typeof routeConfigObject>;

export function parseRouteConfig(input: unknown): RouteConfig {
  return routeConfigSchema.parse(input);
}

/** Validation that returns readable errors instead of throwing (startup surface). */
export function validateRouteConfig(input: unknown): { ok: true; config: RouteConfig } | { ok: false; errors: string[] } {
  const result = routeConfigSchema.safeParse(input);
  if (result.success) return { ok: true, config: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
  };
}

export function evaluateWhen(when: WhenClause, flags: ReadonlySet<string>): boolean {
  if (when.allOf && !when.allOf.every((f) => flags.has(f))) return false;
  if (when.anyOf && !when.anyOf.some((f) => flags.has(f))) return false;
  if (when.not && when.not.some((f) => flags.has(f))) return false;
  return true;
}
