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

/**
 * Trigger refs are namespaced: property.<flag> · zone.<attribute> · pin.<type> · house.<type>
 *
 * `pin.*` and `house.*` are deliberately NOT the same question (master v1.6.1 §3):
 * `pin.foo` = a pin of that type exists IN THIS ZONE · `house.foo` = anywhere this visit.
 * Before v1.6.1 `pin.*` silently meant house-wide when evaluated at session scope, so one
 * namespace meant two things depending on where it was read. `pin.*` is now zone-only and
 * rejected at session scope; nothing used it there, so the restriction was free to take.
 */
const triggerRefSchema = z
  .string()
  .regex(/^(property|zone|pin|house)\.[a-z0-9][a-z0-9_-]*$/, "trigger refs are property.* / zone.* / pin.* / house.*");

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
  /**
   * List-level gate (master v1.6.2 §0): every item in this list is conditioned on this ref.
   * Where an item ALSO carries its own trigger, the effective condition is
   * allOf(gate, item.trigger) — the item cell's `|` stays anyOf internally.
   *
   * This is the only way to express an AND of two refs: a trigger cell cannot. It is also
   * the fix for a whole defect class — the gate previously lived in a heading sentence the
   * generator never read, so 21 of 24 mechanical items shipped ungated.
   */
  gate: triggerRefSchema.optional(),
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
  gate: triggerRefSchema.optional(),
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
  /**
   * Component inheritance (master v1.4): this type carries the named parent's items first,
   * then its own — mirroring zone-type inheritance.
   *
   * Deliberately kept DECLARATIVE rather than flattened at generation time. Flattening would
   * copy every parent item into every child list, which (a) breaks the invariant above that
   * item ids exist exactly once, failing the duplicate-id check, and (b) discards the
   * authored structure the binder's config snapshot needs. Composition happens where zone
   * inheritance already happens: at derivation.
   */
  inherits: idSchema.optional(),
  gate: triggerRefSchema.optional(),
  items: z.array(itemSchema).default([]),
});
export type ComponentList = z.output<typeof componentListSchema>;

/**
 * Component alias (master v1.5, Table E) — a SEARCH-ONLY synonym resolving to a canonical
 * component type. Aliases never create a type, never appear in the manifest, and never carry
 * items; they exist so a concierge searching "air conditioner" finds `heat-pump` instead of
 * finding nothing and freeform-entering it — which would manufacture exactly the telemetry
 * noise the sub-type work removed.
 *
 * `alias` is deliberately NOT an id: the authored terms carry spaces and capitals
 * ("hot water tank", "UV", "WC"). It is display/search text, normalised at match time.
 */
const componentAliasSchema = z.object({
  alias: z.string().min(1),
  type: idSchema,
});
export type ComponentAlias = z.output<typeof componentAliasSchema>;

/**
 * The single normalisation used for alias and type-name matching: lowercase, and treat
 * hyphens, underscores and whitespace as one separator.
 *
 * The separator collapse is not cosmetic — it is the fix for G7 recurring. Table E authors
 * `air-conditioner` in id style, but a concierge types "air conditioner" with a space and
 * would otherwise find nothing, which is the exact failure the alias existed to prevent.
 * Normalising both sides fixes the whole class in one place instead of doubling every row,
 * and it also lets "heat pump" match the `heat-pump` type directly.
 */
export const normalizeAlias = (s: string): string =>
  s.trim().toLowerCase().replace(/[\s_-]+/g, " ");

/**
 * Table I (v1.9) — derived-value provenance. An item recording a value transcribed or decoded
 * from a physical artifact names the `photo` item capturing that artifact, so the value can be
 * re-checked. Parser-enforced: the entry exists, the source exists, the source is a photo.
 *
 * An unverifiable value is indistinguishable from a verified one, and the equipment registry —
 * the consumer with no session and no vote — has no way to notice the difference.
 */
const provenanceSchema = z.object({
  itemId: idSchema,
  derivedFrom: z.string().min(1),
  sourceItemId: idSchema,
});
export type DerivedProvenance = z.output<typeof provenanceSchema>;

/** Table G (v1.7) — a retired choice option value and what replaced it. Option values follow
 *  the item-id lifecycle: never renamed, only retired and replaced. */
const retiredOptionSchema = z.object({
  itemId: idSchema,
  value: z.string().min(1),
  version: z.string().min(1),
  replacement: z.string().optional(),
  reason: z.string().optional(),
});
export type RetiredOption = z.output<typeof retiredOptionSchema>;

/** Table H (v1.7) — the CLOSED set of measure units. A unit is part of an item's identity;
 *  changing it is a breaking change, not a content edit. */
const measureUnitSchema = z.object({ unit: z.string().min(1), means: z.string().min(1) });
export type MeasureUnit = z.output<typeof measureUnitSchema>;

/** Reserved item-id suffixes (v1.7 §2) — DECLARED classes, not naming conventions, because
 *  downstream consumers bind to them. `.unit` = condition baseline · `.wide` = locating photo.
 *  Both are always photo + evidence. */
export const RESERVED_ITEM_CLASSES = [".unit", ".wide"] as const;

/**
 * Table A col 4 (2026-08-08) — who actually reads this flag.
 *
 * `field` = the app does something with it *during the visit*: an item trigger, a list gate,
 * or the Discovery capture prompt. `binder` = it travels in the manifest and is read
 * downstream — report language, schedule derivation, session-plan input.
 *
 * An ARRAY, not an enum, because several flags are genuinely both: `pool` prompts the walk to
 * photograph the pool AND tells the binder to carry pool equipment into the session plan.
 *
 * The column exists because eight of eighteen flags were asked at intake and referenced by
 * nothing, and from inside the config a deliberate binder-only fact (`pre_1990` conditions
 * report language, not a checklist row) is INDISTINGUISHABLE from an oversight. Declaring the
 * consumer turns a silence into a checkable claim.
 */
export const FLAG_CONSUMERS = ["field", "binder"] as const;
export type FlagConsumer = (typeof FLAG_CONSUMERS)[number];

const propertyFlagSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_]*$/, "property flag ids are lowercase snake"),
  label: z.string().min(1),
  /** Intake-question grouping, e.g. "Water source", "Fuel on property". */
  intakeSource: z.string().min(1),
  /** Table A col 4. Optional so a pre-column master still validates; see the rules below. */
  consumers: z.array(z.enum(FLAG_CONSUMERS)).min(1).optional(),
});
export type PropertyFlag = z.output<typeof propertyFlagSchema>;

const zoneAttributeSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_]*$/, "zone attribute ids are lowercase snake"),
  label: z.string().min(1),
  /** false = derived from pins/observation rather than asked at zone creation. */
  askAtCreation: z.boolean(),
  /**
   * Zone types that start with this attribute ON (master v1.6.1 Table B col 4).
   * `has_mechanicals` defaults true for `utility`. Kept in config rather than app code so
   * the rule stays data — hardcoding "utility" in the UI is exactly the drift the
   * config-is-data discipline exists to prevent.
   */
  defaultsTrueFor: z.array(idSchema).default([]),
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
  /** Table E (v1.5). Optional so a pre-v1.5 config still validates. */
  componentAliases: z.array(componentAliasSchema).default([]),
  /** Table G (v1.7). Empty until the first option retirement. */
  retiredOptions: z.array(retiredOptionSchema).default([]),
  /** Table H (v1.7). Closed set; empty means "not declared" (pre-v1.7 config). */
  measureUnits: z.array(measureUnitSchema).default([]),
  /** Table I (v1.9). Empty means "not declared" (pre-v1.9 config). */
  provenance: z.array(provenanceSchema).default([]),
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

  // Table B col 4 (v1.6.1): a zone-type default must name a real zone type.
  const declaredZoneTypes = new Set(cfg.zoneTypes.map((z) => z.id));
  for (const a of cfg.zoneAttributes)
    for (const zt of a.defaultsTrueFor)
      if (!declaredZoneTypes.has(zt)) issue(`zone attribute ${a.id} defaults true for unknown zone type ${zt}`);

  // Table E aliases (v1.5): must resolve to a real type, must not shadow one, no duplicates.
  // Table G: retirement lineage must reference a real choice item, and a retired value must
  // NOT still be live — retirement means gone, not deprecated-but-present.
  const choiceItems = new Map<string, string[]>();
  const collectChoices = (items: ChecklistItem[]) => {
    for (const i of items) if (i.satisfy === "choice" && i.options) choiceItems.set(i.id, i.options);
  };
  for (const b of cfg.baseLists) collectChoices(b.items);
  for (const z of cfg.zoneLists) collectChoices(z.items);
  for (const c of cfg.componentLists) collectChoices(c.items);
  collectChoices(cfg.sessionItems);
  for (const r of cfg.retiredOptions) {
    const live = choiceItems.get(r.itemId);
    if (!live) issue(`Table G: retired option '${r.value}' names unknown choice item ${r.itemId}`);
    else if (live.includes(r.value))
      issue(`Table G: '${r.value}' is listed as retired on ${r.itemId} but is still a live option`);
    if (r.replacement && live && !live.includes(r.replacement))
      issue(`Table G: replacement '${r.replacement}' for ${r.itemId} is not a live option`);
  }

  // Table I (v1.9). Resolution MUST compose component inheritance: `wsf.age` names
  // `wt.nameplate`, which lives on the parent `water-treatment` list. Checking only a list's
  // own items would report a false gap on exactly the row that proves the rule works.
  const allItems = new Map<string, ChecklistItem>();
  const addAll = (items: ChecklistItem[]) => { for (const i of items) allItems.set(i.id, i); };
  for (const b of cfg.baseLists) addAll(b.items);
  for (const z of cfg.zoneLists) addAll(z.items);
  for (const c of cfg.componentLists) addAll(c.items);
  addAll(cfg.sessionItems);

  /**
   * Items visible together with `id` — its own list, plus the inherited chain for a component.
   * Global existence is NOT enough: provenance means the photo is captured on the SAME pin,
   * so a source item living on an unrelated component would pass an existence check while
   * never actually being taken. `wsf.age` names `wt.nameplate`, which lives on the parent
   * `water-treatment` list — so the chain must be composed before testing, exactly as flagged.
   */
  const provListByType = new Map<string, (typeof cfg.componentLists)[number]>();
  for (const c of cfg.componentLists) for (const t of c.types) provListByType.set(t, c);
  const coVisible = (id: string): Set<string> => {
    const out = new Set<string>();
    for (const b of cfg.baseLists) if (b.items.some((i) => i.id === id)) b.items.forEach((i) => out.add(i.id));
    for (const z of cfg.zoneLists) if (z.items.some((i) => i.id === id)) z.items.forEach((i) => out.add(i.id));
    if (cfg.sessionItems.some((i) => i.id === id)) cfg.sessionItems.forEach((i) => out.add(i.id));
    for (const c of cfg.componentLists) {
      if (!c.items.some((i) => i.id === id)) continue;
      const seen = new Set<string>();
      let cursor: string | undefined = c.types[0];
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const l = provListByType.get(cursor);
        if (!l) break;
        l.items.forEach((i) => out.add(i.id));
        cursor = l.inherits;
      }
    }
    return out;
  };

  for (const p of cfg.provenance) {
    if (!allItems.has(p.itemId)) {
      issue(`Table I: provenance names unknown item ${p.itemId}`);
      continue;
    }
    const src = allItems.get(p.sourceItemId);
    if (!src) issue(`Table I: ${p.itemId} names unknown source item ${p.sourceItemId}`);
    else if (src.satisfy !== "photo")
      issue(`Table I: ${p.itemId} names source ${p.sourceItemId}, which is ${src.satisfy}, not photo`);
    else if (!coVisible(p.itemId).has(p.sourceItemId))
      issue(
        `Table I: ${p.itemId} names source ${p.sourceItemId}, which is not reachable from the same list ` +
          `(inheritance included) — the photo would never be captured alongside the value`,
      );
  }

  const seenAliases = new Set<string>();
  // Compare against NORMALISED type ids: `air-conditioner` and "air conditioner" are the
  // same term, so a raw kebab comparison would miss the collision it exists to catch.
  const normalizedTypeIds = new Set([...componentTypeIds].map(normalizeAlias));
  for (const a of cfg.componentAliases) {
    const key = normalizeAlias(a.alias);
    if (!componentTypeIds.has(a.type)) issue(`alias "${a.alias}" resolves to unknown component type ${a.type}`);
    // A shadowing alias is worse than a missing one: searching the real type name would
    // silently resolve through the alias table instead of matching the type itself.
    if (normalizedTypeIds.has(key)) issue(`alias "${a.alias}" collides with the component type of the same name`);
    if (seenAliases.has(key)) issue(`duplicate alias "${a.alias}"`);
    seenAliases.add(key);
  }

  // Component inheritance: the parent must exist, must carry items, and the chain must
  // terminate. A cycle would hang derivation rather than fail a build, so it fails here.
  const listByType = new Map<string, (typeof cfg.componentLists)[number]>();
  for (const c of cfg.componentLists) for (const t of c.types) listByType.set(t, c);
  for (const c of cfg.componentLists) {
    if (!c.inherits) continue;
    const child = c.types[0]!;
    if (!componentTypeIds.has(c.inherits)) {
      issue(`component ${child} inherits unknown type ${c.inherits}`);
      continue;
    }
    if (c.types.includes(c.inherits)) issue(`component ${child} inherits itself`);
    const parent = listByType.get(c.inherits);
    if (parent?.stub) issue(`component ${child} inherits ${c.inherits}, which is a stub with no items`);
    const seen = new Set<string>([child]);
    let cursor = c.inherits;
    while (cursor) {
      if (seen.has(cursor)) {
        issue(`component inheritance cycle through ${cursor}`);
        break;
      }
      seen.add(cursor);
      cursor = listByType.get(cursor)?.inherits ?? "";
    }
  }

  for (const zt of cfg.zoneTypes)
    for (const inh of zt.inherits)
      if (!baseListIds.has(inh)) issue(`zone type ${zt.id} inherits unknown base list ${inh}`);

  const zoneListTypes = new Set<string>();
  for (const zl of cfg.zoneLists) {
    addUnique(zoneListTypes, zl.zoneType, "zone list");
    if (!zoneTypeIds.has(zl.zoneType)) issue(`zone list references unknown zone type ${zl.zoneType}`);
  }

  // List gates (v1.6.2) resolve against the same closed vocabulary as item triggers.
  const checkGate = (gate: string | undefined, where: string) => {
    if (!gate) return;
    const [ns, rest] = [gate.slice(0, gate.indexOf(".")), gate.slice(gate.indexOf(".") + 1)];
    if (ns === "property" && !flagIds.has(rest)) issue(`${where}: gate on unknown property flag ${rest}`);
    if (ns === "zone" && !attrIds.has(rest)) issue(`${where}: gate on unknown zone attribute ${rest}`);
    if ((ns === "pin" || ns === "house") && !componentTypeIds.has(rest))
      issue(`${where}: gate on unknown component type ${rest}`);
  };
  for (const b of cfg.baseLists) checkGate(b.gate, `base ${b.id}`);
  for (const z of cfg.zoneLists) checkGate(z.gate, `zone ${z.zoneType}`);
  for (const c of cfg.componentLists) checkGate(c.gate, `component ${c.types.join("/")}`);

  const itemIds = new Set<string>();
  const checkItem = (item: ChecklistItem, where: string, atSessionScope = false) => {
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
    // Reserved item classes (v1.7 §2): the builder binds to these suffixes, so they must
    // mean exactly one thing. A `.unit` that is a check would silently break the condition
    // baseline the binder renders year over year.
    for (const suffix of RESERVED_ITEM_CLASSES)
      if (item.id.endsWith(suffix) && !(item.satisfy === "photo" && item.attest === "evidence"))
        issue(`${where}: ${item.id} uses the reserved '${suffix}' class but is ${item.satisfy}/${item.attest}, not photo/evidence`);
    // Table H (v1.7): units are a closed set. Declared units only, once the table exists.
    if (item.unit && cfg.measureUnits.length && !cfg.measureUnits.some((u) => u.unit === item.unit))
      issue(`${where}: ${item.id} uses unit '${item.unit}', which Table H does not declare`);
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
        if (ns === "house" && !componentTypeIds.has(rest)) issue(`${where}: ${item.id} triggers on unknown house pin type ${rest}`);
        // `pin.*` asks "in THIS ZONE", which has no meaning without a zone. Before v1.6.1 it
        // silently answered house-wide here — use `house.*` and say so (master v1.6.1 §3).
        if (ns === "pin" && atSessionScope)
          issue(`${where}: ${item.id} triggers on ${ref} at session scope — pin.* is zone-only; use house.${rest}`);
      }
    }
  };

  for (const b of cfg.baseLists) for (const item of b.items) checkItem(item, `base ${b.id}`);
  for (const zl of cfg.zoneLists) for (const item of zl.items) checkItem(item, `zone ${zl.zoneType}`);
  for (const item of cfg.sessionItems) checkItem(item, "session", true);
  for (const c of cfg.componentLists) {
    if (c.stub && c.items.length) issue(`stub component ${c.types.join("/")} carries items`);
    if (!c.stub && !c.items.length) issue(`component ${c.types.join("/")} has no items and is not a stub`);
    for (const item of c.items) checkItem(item, `component ${c.types.join("/")}`);
  }

  /**
   * Table A col 4 rules. Both are deliberately shaped so they say something FALSE-ABLE rather
   * than passing vacuously on a config that has not adopted the column yet.
   *
   * (1) ALL-OR-NOTHING. Once any flag declares consumers the column exists, so every flag must
   *     declare one. Partial adoption is the worst state available: an undeclared flag is then
   *     ambiguous between "nobody has filled this in" and "declared as having no consumer",
   *     which is the exact silence the column was added to remove.
   *
   * (2) TRIGGERED IMPLIES `field`. If an item trigger or a list gate names the flag, the
   *     declaration must say `field`. This is the drift catcher: someone adds a trigger on a
   *     binder-only flag a year from now and the declaration goes stale without it.
   *
   * The converse is NOT a rule and must not become one: `field` does not require a trigger,
   * because the Discovery capture prompt is a field consumer that needs no trigger at all
   * (`pool`, `generator`, `ev` are exactly that case).
   */
  const declaring = cfg.propertyFlags.filter((f) => f.consumers?.length);
  if (declaring.length) {
    for (const f of cfg.propertyFlags)
      if (!f.consumers?.length)
        issue(
          `Table A: ${f.id} declares no consumer, but other flags do — the column is all-or-nothing`,
        );

    const flagsReferenced = new Set<string>();
    const noteRef = (ref: string | undefined) => {
      if (ref?.startsWith("property.")) flagsReferenced.add(ref.slice("property.".length));
    };
    const noteItems = (items: ChecklistItem[], gate?: string) => {
      noteRef(gate);
      for (const i of items)
        for (const r of [...(i.trigger?.allOf ?? []), ...(i.trigger?.anyOf ?? []), ...(i.trigger?.not ?? [])])
          noteRef(r);
    };
    for (const b of cfg.baseLists) noteItems(b.items, b.gate);
    for (const z of cfg.zoneLists) noteItems(z.items, z.gate);
    for (const c of cfg.componentLists) noteItems(c.items, c.gate);
    noteItems(cfg.sessionItems);

    for (const f of cfg.propertyFlags)
      if (flagsReferenced.has(f.id) && f.consumers?.length && !f.consumers.includes("field"))
        issue(
          `Table A: ${f.id} is named by an item trigger or list gate but declares consumers ` +
            `[${f.consumers.join(", ")}] — a triggered flag is read in the field`,
        );
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
