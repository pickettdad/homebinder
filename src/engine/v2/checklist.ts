/**
 * Checklist derivation — which items EXIST for a zone / pin / session, and what state
 * each is in. Pure functions over (config, fold state); nothing here is persisted.
 *
 * The two-axis model + session items (master §1):
 *  - zone items   = inherited base lists + the zone type's own list, trigger-filtered
 *  - component items = the pin's component list, attached PER PIN (they travel with it)
 *  - session items = surface only in the session-close audit
 *
 * The attest rule (master §2, owner decision) is enforced here mechanically:
 *  - evidence items with satisfy:pin whose matching typed pin exists are surfaced as
 *    "proposed" — one confirming human tap records an ItemResolved.
 *  - action items are NEVER proposed. No matching evidence, pin, tag, or AI output
 *    can move them off "unresolved" — only an explicit human ItemResolved can.
 */
import type { ChecklistConfig, ChecklistItem, ChecklistWhen } from "../schema/checklistConfig";
import { evaluateTrigger } from "../schema/checklistConfig";
import type { ItemScope } from "./events";
import { resolutionKey } from "./fold";
import type { PinStateV2, SessionStateV2, ZoneStateV2 } from "./fold";

export type ItemStatus =
  | { kind: "unresolved" }
  /** evidence-attested only: matching evidence exists; one human tap confirms. */
  | { kind: "proposed"; pinIds: string[] }
  | { kind: "satisfied" }
  | { kind: "na"; reasonId: string };

export interface DerivedItem {
  item: ChecklistItem;
  scope: ItemScope;
  /** Rendered-group key: base list id, zone sub-heading, zone type, or pin identity. */
  group: string;
  status: ItemStatus;
}

/** Non-retired pins assigned to a zone. */
export const zonePins = (state: SessionStateV2, zoneId: string): PinStateV2[] =>
  state.pins.filter((p) => p.zoneId === zoneId && !p.retired);

const componentTypesOf = (pins: PinStateV2[]): Set<string> => {
  const types = new Set<string>();
  for (const p of pins) if (p.pinType?.kind === "component") types.add(p.pinType.componentType);
  return types;
};

/** The active trigger refs for a zone: property.* + zone.* + pin.* (master §3). */
export function activeRefs(
  state: SessionStateV2,
  zone: ZoneStateV2 | undefined,
): Set<string> {
  const refs = new Set<string>();
  for (const f of state.propertyFlags) refs.add(`property.${f}`);
  if (zone) {
    for (const [attr, on] of Object.entries(zone.attributes)) if (on) refs.add(`zone.${attr}`);
    for (const t of componentTypesOf(zonePins(state, zone.zoneId))) refs.add(`pin.${t}`);
  } else {
    // Session scope: pin.* refs consider every non-retired pin in the house.
    for (const t of componentTypesOf(state.pins.filter((p) => !p.retired))) refs.add(`pin.${t}`);
  }
  return refs;
}

const triggered = (item: ChecklistItem, refs: Set<string>): boolean =>
  !item.trigger || evaluateTrigger(item.trigger as ChecklistWhen, refs);

function statusOf(
  state: SessionStateV2,
  scope: ItemScope,
  item: ChecklistItem,
  pinsInScope: PinStateV2[],
): ItemStatus {
  const recorded = state.resolutions.get(resolutionKey(scope, item.id));
  if (recorded) {
    if (recorded.resolution.kind === "na") return { kind: "na", reasonId: recorded.resolution.reasonId };
    return { kind: "satisfied" };
  }
  // Proposal path: evidence-attested pin items only. attest:action NEVER proposes —
  // creating a sump-pump pin must not touch "bucket-tested" (review §3.3).
  if (item.attest === "evidence" && item.satisfy === "pin" && item.pinTypes?.length) {
    const wanted = new Set(item.pinTypes);
    const matching = pinsInScope.filter(
      (p) => p.pinType?.kind === "component" && wanted.has(p.pinType.componentType),
    );
    if (matching.length) return { kind: "proposed", pinIds: matching.map((p) => p.pinId) };
  }
  return { kind: "unresolved" };
}

/**
 * A zone's own checklist: inherited base lists + the zone type's list, trigger-filtered,
 * with rendered-group keys (base list id / authored sub-heading / zone type).
 */
export function deriveZoneItems(
  config: ChecklistConfig,
  state: SessionStateV2,
  zoneId: string,
): DerivedItem[] {
  const zone = state.zones.find((z) => z.zoneId === zoneId);
  if (!zone) return [];
  const zoneType = config.zoneTypes.find((t) => t.id === zone.zoneType);
  const refs = activeRefs(state, zone);
  const pins = zonePins(state, zoneId);
  const scope: ItemScope = { kind: "zone", zoneId };
  const out: DerivedItem[] = [];

  for (const baseId of zoneType?.inherits ?? []) {
    const base = config.baseLists.find((b) => b.id === baseId);
    for (const item of base?.items ?? [])
      if (triggered(item, refs))
        out.push({ item, scope, group: baseId, status: statusOf(state, scope, item, pins) });
  }
  const own = config.zoneLists.find((zl) => zl.zoneType === zone.zoneType);
  for (const item of own?.items ?? [])
    if (triggered(item, refs))
      out.push({
        item,
        scope,
        group: item.group ?? zone.zoneType,
        status: statusOf(state, scope, item, pins),
      });
  return out;
}

/** Component items for every non-retired typed pin in a zone — attached PER PIN. */
export function deriveComponentItems(
  config: ChecklistConfig,
  state: SessionStateV2,
  zoneId: string,
): DerivedItem[] {
  const out: DerivedItem[] = [];
  // Proposal search for a component's own satisfy:pin evidence items (fc.comparison →
  // comparison-position, fp.chimney → chimney) spans the whole session: the evidencing
  // pin legitimately lives in another zone (the chimney pin is on an elevation).
  const allPins = state.pins.filter((p) => !p.retired);
  for (const p of zonePins(state, zoneId)) {
    if (p.pinType?.kind !== "component") continue;
    const type = p.pinType.componentType;
    const list = config.componentLists.find((c) => c.types.includes(type));
    if (!list || list.stub) continue;
    const scope: ItemScope = { kind: "pin", pinId: p.pinId };
    // The pin's nickname rides in the group heading so the audit reads
    // "#2 water-treatment — chlorine tank", not three indistinguishable "#N water-treatment".
    const group = `#${p.number} ${type}${p.label ? ` — ${p.label}` : ""}`;
    for (const item of list.items)
      out.push({ item, scope, group, status: statusOf(state, scope, item, allPins) });
  }
  return out;
}

/**
 * Deterministic pin-type priors for the type picker (review §3.4): component types the
 * zone's own checklist references first, then the rest of the library, stubs last.
 * Freeform is a UI affordance, always offered — it is not a component type.
 */
export function suggestedPinTypes(config: ChecklistConfig, zoneType: string): string[] {
  const zt = config.zoneTypes.find((t) => t.id === zoneType);
  const referenced: string[] = [];
  const collect = (items: ChecklistItem[]) => {
    for (const item of items) for (const t of item.pinTypes ?? []) if (!referenced.includes(t)) referenced.push(t);
  };
  for (const baseId of zt?.inherits ?? []) collect(config.baseLists.find((b) => b.id === baseId)?.items ?? []);
  collect(config.zoneLists.find((zl) => zl.zoneType === zoneType)?.items ?? []);
  const rest = config.componentLists
    .filter((c) => !c.stub)
    .flatMap((c) => c.types)
    .filter((t) => !referenced.includes(t));
  const stubs = config.componentLists
    .filter((c) => c.stub)
    .flatMap((c) => c.types)
    .filter((t) => !referenced.includes(t));
  return [...referenced, ...rest, ...stubs];
}

/** Session items — surface only in the session-close audit (review §3.2). */
export function deriveSessionItems(config: ChecklistConfig, state: SessionStateV2): DerivedItem[] {
  const refs = activeRefs(state, undefined);
  const scope: ItemScope = { kind: "session" };
  const allPins = state.pins.filter((p) => !p.retired);
  return config.sessionItems
    .filter((item) => triggered(item, refs))
    .map((item) => ({ item, scope, group: "session", status: statusOf(state, scope, item, allPins) }));
}

/** Everything the close audit shows for a zone: zone items + per-pin component items. */
export function deriveZoneAudit(
  config: ChecklistConfig,
  state: SessionStateV2,
  zoneId: string,
): DerivedItem[] {
  return [...deriveZoneItems(config, state, zoneId), ...deriveComponentItems(config, state, zoneId)];
}

const unresolvedKinds = new Set(["unresolved", "proposed"]);

export interface AuditGroup {
  key: string;
  items: DerivedItem[];
}

export interface AuditView {
  /** attest: evidence — the Documentation list. */
  documentation: AuditGroup[];
  /** attest: action — the Tests list. Never mixed with Documentation (owner decision). */
  tests: AuditGroup[];
}

/**
 * The rendering rule made data (master §2): Documentation and Tests are separate
 * sections; within each, items group by their rendered-group key in first-appearance
 * order (base lists, then the zone's own sub-groups, then per-pin component groups).
 */
export function buildAuditView(items: DerivedItem[]): AuditView {
  const split = (attest: "evidence" | "action"): AuditGroup[] => {
    const groups: AuditGroup[] = [];
    for (const d of items.filter((d) => d.item.attest === attest)) {
      const g = groups.find((g) => g.key === d.group);
      if (g) g.items.push(d);
      else groups.push({ key: d.group, items: [d] });
    }
    return groups;
  };
  return { documentation: split("evidence"), tests: split("action") };
}

/** The advisory-close snapshot recorded into ZoneClosed (never blocks). */
export function auditSnapshot(items: DerivedItem[]): {
  coreUnresolved: string[];
  standardUnresolved: number;
  naCount: number;
} {
  return {
    coreUnresolved: items
      .filter((d) => d.item.tier === "core" && unresolvedKinds.has(d.status.kind))
      .map((d) => d.item.id),
    standardUnresolved: items.filter(
      (d) => d.item.tier === "standard" && unresolvedKinds.has(d.status.kind),
    ).length,
    naCount: items.filter((d) => d.status.kind === "na").length,
  };
}
