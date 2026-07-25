/**
 * Checklist configuration schema — the contract for v2's generated verification config.
 *
 * The config is PURE DATA, generated from docs/CHECKLIST-MASTER.md by
 * scripts/gen-checklists.mts — never edited by hand (CI proves master ↔ generated
 * agreement byte-for-byte). Same discipline as routeConfig.ts: closed vocabularies,
 * Zod-validated fail-closed at startup and in CI, content-hashed and pinned per session.
 *
 * Semantics the schema encodes (CHECKLIST-MASTER v1.1 §2 + CHECKLIST-MASTER-REVIEW §3):
 * - `attest` always wins over satisfy kind: "evidence" items may be PROPOSED by software
 *   and confirmed by one human tap; "action" items (tests) are satisfiable only by a
 *   deliberate human tap recording pass/fail — no software path may ever mark them.
 * - Triggers are a closed vocabulary over property.* / zone.* / pin.* refs with
 *   allOf/anyOf/not — never an expression language.
 * - Layer definitions live here (not app code) because layers are binder artifacts:
 *   the export's config snapshot must let the binder builder derive them alone.
 */
import { z } from "zod";

export const SATISFY_KINDS = ["pin", "check", "note", "measure", "photo", "choice"] as const;
export type SatisfyKind = (typeof SATISFY_KINDS)[number];

export const TIERS = ["core", "standard"] as const;
export type Tier = (typeof TIERS)[number];

export const ATTEST_KINDS = ["evidence", "action"] as const;
export type AttestKind = (typeof ATTEST_KINDS)[number];

/** ids are lowercase kebab/dot: 'int.canvas', 'utl.heat-source', 'water-heater' */
const idPattern = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/;
const idSchema = z.string().regex(idPattern, "ids are lowercase kebab-case, dot-separated segments");

/** baseline · monthly · seasonal:spring|summer|fall|winter */
const scopeSchema = z
  .string()
  .regex(/^(baseline|monthly|seasonal:(spring|summer|fall|winter))$/, "unknown scope tag");
export type ScopeTag = z.output<typeof scopeSchema>;

/** Trigger refs are namespaced: property.<flag> · zone.<attribute> · pin.<component-type> */
const triggerRefSchema = z
  .string()
  .regex(/^(property|zone|pin)\.[a-z0-9][a-z0-9_-]*$/, "trigger refs are property.* / zone.* / pin.*");

const whenSchema = z
  .object({
    allOf: z.array(triggerRefSchema).optional(),
    anyOf: z.array(triggerRefSchema).optional(),
    not: z.array(triggerRefSchema).optional(),
  })
  .refine((w) => w.allOf?.length || w.anyOf?.length || w.not?.length, {
    message: "trigger must reference at least one property/zone/pin ref",
  });
export type ChecklistWhen = z.output<typeof whenSchema>;

const itemSchema = z.object({
  id: idSchema,
  /** The verification, in "is this true?" voice. May carry inline markdown emphasis. */
  text: z.string().min(1),
  satisfy: z.enum(SATISFY_KINDS),
  tier: z.enum(TIERS),
  /** evidence = software may propose, human confirms · action = a test, human-only. */
  attest: z.enum(ATTEST_KINDS),
  scope: z.array(scopeSchema).min(1).default(["baseline"]),
  /** For satisfy: pin — any listed component type satisfies. */
  pinTypes: z.array(idSchema).optional(),
  /** For satisfy: measure — unit hint, e.g. "psi", "%RH", "in", "mm". */
  unit: z.string().min(1).optional(),
  /**
   * For satisfy: choice — the authored single-select options, in authored order.
   * Master v1.3 §2 "choice discipline": options should be exhaustive for realistic field
   * cases and carry an escape (`unknown` and/or `other`), so an inspector who cannot
   * determine the answer records *that* rather than being forced into a wrong value.
   */
  options: z.array(z.string().min(1)).min(2).optional(),
  trigger: whenSchema.optional(),
  /** Rendered sub-group within a dense zone list (utility's bold sub-headings). */
  group: z.string().min(1).optional(),
  /** The "how/why", shown on tap. Mostly empty in v1.1 — a later content pass. */
  guidance: z.string().optional(),
});
export type ChecklistItem = z.output<typeof itemSchema>;

const baseListSchema = z.object({
  id: idSchema,
  items: z.array(itemSchema).min(1),
});
export type BaseList = z.output<typeof baseListSchema>;

const zoneTypeSchema = z.object({
  id: idSchema,
  /** Label suggestions offered at zone creation; labels are display-only, never logic. */
  typicalLabels: z.array(z.string().min(1)).default([]),
  inherits: z.array(idSchema).default([]),
});
export type ZoneTypeDef = z.output<typeof zoneTypeSchema>;

const zoneListSchema = z.object({
  zoneType: idSchema,
  items: z.array(itemSchema).min(1),
});
export type ZoneList = z.output<typeof zoneListSchema>;

/**
 * One component table can serve several pin types (v1.1 §7 shared headings, e.g.
 * smoke-alarm / co-alarm). Item ids stay globally unique because the items exist once.
 * Stubs reserve ids with no items yet.
 */
const componentListSchema = z.object({
  types: z.array(idSchema).min(1),
  note: z.string().optional(),
  stub: z.boolean().default(false),
  items: z.array(itemSchema).default([]),
});
export type ComponentList = z.output<typeof componentListSchema>;

const propertyFlagSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_]*$/, "property flag ids are lowercase snake"),
  label: z.string().min(1),
  /** Intake-question grouping, e.g. "Water source", "Fuel on property". */
  intakeSource: z.string().min(1),
});
export type PropertyFlag = z.output<typeof propertyFlagSchema>;

const zoneAttributeSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_]*$/, "zone attribute ids are lowercase snake"),
  label: z.string().min(1),
  /** false = derived from pins/observation rather than asked at zone creation. */
  askAtCreation: z.boolean(),
});
export type ZoneAttribute = z.output<typeof zoneAttributeSchema>;

const naReasonSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  /** How strongly the UI asks for a note alongside this reason. */
  note: z.enum(["optional", "recommended"]),
  /** N/A with this reason lands on the visit-two gap list in the export. */
  feedsGapList: z.boolean().default(false),
  /** "Confirmed absent" is real inspection data — recorded as a finding. */
  recordsFinding: z.boolean().default(false),
});
export type NaReason = z.output<typeof naReasonSchema>;

const layerSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  /** Empty predicate = all pins. Otherwise pins match on flag OR component type. */
  predicate: z.object({
    flags: z.array(z.enum(["fine", "monitor", "issue"])).optional(),
    componentTypes: z.array(idSchema).optional(),
  }),
});
export type LayerDef = z.output<typeof layerSchema>;

const checklistConfigObject = z.object({
  configId: idSchema,
  /** Master vX.Y maps to X.Y.0; bumped by regenerating from an edited master. */
  configVersion: z.string().regex(/^\d+\.\d+\.\d+$/, "configVersion is semver"),
  propertyFlags: z.array(propertyFlagSchema).min(1),
  zoneAttributes: z.array(zoneAttributeSchema),
  zoneTypes: z.array(zoneTypeSchema).min(1),
  baseLists: z.array(baseListSchema).min(1),
  zoneLists: z.array(zoneListSchema),
  /** Surface only in the session-close audit (review §3.2). */
  sessionItems: z.array(itemSchema),
  componentLists: z.array(componentListSchema).min(1),
  naReasons: z.array(naReasonSchema).min(1),
  layers: z.array(layerSchema).min(1),
});

export const checklistConfigSchema = checklistConfigObject.superRefine((cfg, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });

  const flagIds = new Set(cfg.propertyFlags.map((f) => f.id));
  const attrIds = new Set(cfg.zoneAttributes.map((a) => a.id));
  const baseListIds = new Set<string>();
  const zoneTypeIds = new Set<string>();
  const componentTypeIds = new Set<string>();

  const addUnique = (set: Set<string>, id: string, what: string) => {
    if (set.has(id)) issue(`duplicate ${what} id: ${id}`);
    set.add(id);
  };

  for (const b of cfg.baseLists) addUnique(baseListIds, b.id, "base list");
  for (const zt of cfg.zoneTypes) addUnique(zoneTypeIds, zt.id, "zone type");
  for (const c of cfg.componentLists) for (const t of c.types) addUnique(componentTypeIds, t, "component type");

  for (const zt of cfg.zoneTypes)
    for (const inh of zt.inherits)
      if (!baseListIds.has(inh)) issue(`zone type ${zt.id} inherits unknown base list ${inh}`);

  const zoneListTypes = new Set<string>();
  for (const zl of cfg.zoneLists) {
    addUnique(zoneListTypes, zl.zoneType, "zone list");
    if (!zoneTypeIds.has(zl.zoneType)) issue(`zone list references unknown zone type ${zl.zoneType}`);
  }

  const itemIds = new Set<string>();
  const checkItem = (item: ChecklistItem, where: string) => {
    addUnique(itemIds, item.id, "item");
    if (item.satisfy === "pin") {
      if (!item.pinTypes?.length) issue(`${where}: ${item.id} is satisfy:pin but names no pinTypes`);
      for (const t of item.pinTypes ?? [])
        if (!componentTypeIds.has(t)) issue(`${where}: ${item.id} references unknown pin type ${t}`);
    } else if (item.pinTypes) {
      issue(`${where}: ${item.id} carries pinTypes but satisfy is ${item.satisfy}`);
    }
    if (item.unit && item.satisfy !== "measure")
      issue(`${where}: ${item.id} carries a unit but satisfy is ${item.satisfy}`);
    if (item.satisfy === "choice") {
      const opts = item.options ?? [];
      if (opts.length < 2) issue(`${where}: ${item.id} is satisfy:choice but names fewer than 2 options`);
      if (new Set(opts).size !== opts.length) issue(`${where}: ${item.id} has duplicate choice options`);
      // NOT enforced here: master v1.3 §2 says every choice must carry an `unknown`/`other`
      // escape, but six authored items don't (pnl.type, fp.type, fc.orientation, gen.fuel,
      // and both access-honesty items). Either the rule or those rows must give — that is an
      // owner content decision, so it is a change-request (REVIEW §8), not a build failure.
    } else if (item.options) {
      issue(`${where}: ${item.id} carries options but satisfy is ${item.satisfy}`);
    }
    if (item.trigger) {
      const refs = [...(item.trigger.allOf ?? []), ...(item.trigger.anyOf ?? []), ...(item.trigger.not ?? [])];
      for (const ref of refs) {
        const [ns, rest] = [ref.slice(0, ref.indexOf(".")), ref.slice(ref.indexOf(".") + 1)];
        if (ns === "property" && !flagIds.has(rest)) issue(`${where}: ${item.id} triggers on unknown property flag ${rest}`);
        if (ns === "zone" && !attrIds.has(rest)) issue(`${where}: ${item.id} triggers on unknown zone attribute ${rest}`);
        if (ns === "pin" && !componentTypeIds.has(rest)) issue(`${where}: ${item.id} triggers on unknown pin type ${rest}`);
      }
    }
  };

  for (const b of cfg.baseLists) for (const item of b.items) checkItem(item, `base ${b.id}`);
  for (const zl of cfg.zoneLists) for (const item of zl.items) checkItem(item, `zone ${zl.zoneType}`);
  for (const item of cfg.sessionItems) checkItem(item, "session");
  for (const c of cfg.componentLists) {
    if (c.stub && c.items.length) issue(`stub component ${c.types.join("/")} carries items`);
    if (!c.stub && !c.items.length) issue(`component ${c.types.join("/")} has no items and is not a stub`);
    for (const item of c.items) checkItem(item, `component ${c.types.join("/")}`);
  }

  const layerIds = new Set<string>();
  for (const layer of cfg.layers) {
    addUnique(layerIds, layer.id, "layer");
    for (const t of layer.predicate.componentTypes ?? [])
      if (!componentTypeIds.has(t)) issue(`layer ${layer.id} references unknown component type ${t}`);
  }
});

/** What the generator emits (defaults optional). */
export type ChecklistConfigInput = z.input<typeof checklistConfigObject>;
/** What the app runs on (defaults applied, validated). */
export type ChecklistConfig = z.output<typeof checklistConfigObject>;

export function parseChecklistConfig(input: unknown): ChecklistConfig {
  return checklistConfigSchema.parse(input);
}

/** Validation that returns readable errors instead of throwing (startup surface). */
export function validateChecklistConfig(
  input: unknown,
): { ok: true; config: ChecklistConfig } | { ok: false; errors: string[] } {
  const result = checklistConfigSchema.safeParse(input);
  if (result.success) return { ok: true, config: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
  };
}

export function evaluateTrigger(when: ChecklistWhen, active: ReadonlySet<string>): boolean {
  if (when.allOf && !when.allOf.every((r) => active.has(r))) return false;
  if (when.anyOf && !when.anyOf.some((r) => active.has(r))) return false;
  if (when.not && when.not.some((r) => active.has(r))) return false;
  return true;
}
