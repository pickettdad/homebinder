/**
 * CHECKLIST-MASTER.md → ChecklistConfig generator (pure functions, no I/O).
 *
 * Parses the v1.1 table dialect (master §0) and emits src/config/checklists.generated.ts.
 * FAIL CLOSED: any row, header, or cell the dialect doesn't declare is an error naming
 * the line — a malformed master must never generate silently-wrong config.
 *
 * Two dialect decisions implemented here pending master ratification (recorded in
 * CHECKLIST-MASTER-REVIEW.md, v1.1 intake):
 * - Trigger cells sub-parse `a|b` as anyOf with namespace-prefix inheritance
 *   (`property.gas|propane` ≡ anyOf(property.gas, property.propane)); `—` = no trigger.
 * - A zone's bold sub-headings (utility) are rendered-group keys; items carry `group`.
 */
import type { ChecklistConfigInput } from "../../src/engine/schema/checklistConfig.ts";

type ItemInput = NonNullable<ChecklistConfigInput["sessionItems"]>[number];

export class MasterParseError extends Error {
  constructor(line: number, message: string) {
    super(`CHECKLIST-MASTER.md:${line + 1}: ${message}`);
    this.name = "MasterParseError";
  }
}

/** Split a markdown table row on unescaped pipes; unescape \| in cells. */
function splitRow(raw: string, line: number): string[] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|"))
    throw new MasterParseError(line, `table row must start and end with '|': ${raw}`);
  const cells: string[] = [];
  let cell = "";
  for (let i = 1; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "\\" && trimmed[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (ch === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  return cells;
}

const isSeparatorRow = (cells: string[]) => cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "---");

interface Table {
  header: string[];
  rows: { cells: string[]; line: number }[];
  line: number;
}

/** Read one markdown table starting at lines[start] (the header row). */
function readTable(lines: string[], start: number): { table: Table; next: number } {
  const header = splitRow(lines[start]!, start).map((h) => h.toLowerCase());
  const sepLine = start + 1;
  if (sepLine >= lines.length || !isSeparatorRow(splitRow(lines[sepLine]!, sepLine)))
    throw new MasterParseError(start, "table header not followed by a separator row");
  const rows: Table["rows"] = [];
  let i = sepLine + 1;
  while (i < lines.length && lines[i]!.trim().startsWith("|")) {
    rows.push({ cells: splitRow(lines[i]!, i), line: i });
    i++;
  }
  if (!rows.length) throw new MasterParseError(start, "table has no data rows");
  return { table: { header, rows, line: start }, next: i };
}

const ITEM_HEADERS: readonly string[][] = [
  ["id", "text", "satisfy", "tier", "attest"],
  ["id", "text", "satisfy", "tier", "attest", "scope"],
  ["id", "text", "satisfy", "tier", "attest", "trigger"],
  ["id", "text", "satisfy", "tier", "attest", "scope", "trigger"],
];

function checkItemHeader(table: Table): void {
  const ok = ITEM_HEADERS.some(
    (h) => h.length === table.header.length && h.every((c, i) => table.header[i] === c),
  );
  if (!ok)
    throw new MasterParseError(
      table.line,
      `item table header must be 'id | text | satisfy | tier | attest [| scope] [| trigger]', got: ${table.header.join(" | ")}`,
    );
}

/**
 * Strip backticks and ASTERISK emphasis from a cell before reading it as an id.
 * v1.6.1 authored the new inherits entry as `**mechanical-base**`; unstripped, the asterisks
 * became part of the id and thirteen zone types inherited a base list that did not exist.
 *
 * UNDERSCORES ARE NOT STRIPPED. Zone-attribute and property-flag ids are snake_case
 * (`has_stairs`, `exterior_wall`, `wood_heat`), so stripping `_` silently renamed them to
 * `hasstairs` / `exteriorwall`. That regression shipped, and no test caught it because the
 * generator corrupted the Table B id AND the `zone.has_stairs` trigger ref identically —
 * the config stayed self-consistent and drift stayed clean. Only the literal id was wrong.
 * Underscore emphasis (`_like this_`) is therefore not supported in id cells; asterisks are.
 */
/**
 * Read a parsed cell literally: strip backticks only.
 *
 * v1.7 §0 BANS markdown emphasis in parsed cells, so emphasis is now REJECTED rather than
 * stripped. The history is the argument: v1.6.1 authored `**mechanical-base**`, which forced
 * a stripper into this function, and a stripper broad enough to remove `**` was broad enough
 * to remove `_` — which silently renamed `has_stairs` to `hasstairs` and shipped. Failing
 * closed on emphasis removes the reason the stripper existed.
 */
function stripTicks(s: string, line = 0): string {
  const bare = s.replace(/`/g, "").trim();
  // Rejected UNCONDITIONALLY, and underscores are never stripped: `has_stairs` is a real id.
  // The first version of this ban still stripped `_` on the no-line path, which reproduced
  // the exact corruption the ban exists to prevent — caught only because Table B's ids became
  // unresolvable to a gate. Emphasis is an error; snake_case is data.
  if (/\*/.test(bare)) throw new MasterParseError(line, `no markdown emphasis in parsed cells (v1.7 §0): '${s.trim()}'`);
  return bare;
}

function parseSatisfy(cell: string, line: number): Pick<ItemInput, "satisfy" | "pinTypes" | "unit" | "options"> {
  const pin = cell.match(/^pin `([^`]+)`$/);
  if (pin) {
    const types = pin[1]!.split("|").map((t) => t.trim());
    if (types.some((t) => !t)) throw new MasterParseError(line, `empty pin-type alternative in: ${cell}`);
    return { satisfy: "pin", pinTypes: types };
  }
  const measure = cell.match(/^measure(?: \(([^)]+)\))?$/);
  if (measure) return measure[1] ? { satisfy: "measure", unit: measure[1] } : { satisfy: "measure" };
  // Master v1.3: `choice (a|b|c)` — options inline, mirroring `measure (unit)`. The cell
  // arrives with markdown pipe-escapes intact (`a\|b`), since a literal `|` inside a table
  // cell must be escaped; strip the backslashes here so option text is what was authored.
  const choice = cell.match(/^choice \(([^)]+)\)$/);
  if (choice) {
    const options = choice[1]!
      .split(/(?<!\\)\|/)
      .map((o) => o.replace(/\\\|/g, "|").trim());
    if (options.some((o) => !o)) throw new MasterParseError(line, `empty choice option in: ${cell}`);
    if (options.length < 2) throw new MasterParseError(line, `choice needs 2+ options: ${cell}`);
    if (new Set(options).size !== options.length)
      throw new MasterParseError(line, `duplicate choice option in: ${cell}`);
    return { satisfy: "choice", options };
  }
  if (cell === "check" || cell === "note" || cell === "photo") return { satisfy: cell };
  throw new MasterParseError(line, `unparseable satisfy cell: '${cell}'`);
}

/**
 * `—` = no trigger. Otherwise a backticked ref list: `property.gas|propane` means
 * anyOf(property.gas, property.propane) — alternatives after the first inherit its
 * namespace prefix when they carry no dot of their own.
 */
function parseTrigger(cell: string, line: number): ItemInput["trigger"] {
  if (cell === "—" || cell === "-" || cell === "") return undefined;
  const inner = stripTicks(cell, line);
  const parts = inner.split("|").map((p) => p.trim());
  if (parts.some((p) => !p)) throw new MasterParseError(line, `empty trigger alternative in: ${cell}`);
  const first = parts[0]!;
  const dot = first.indexOf(".");
  if (dot <= 0) throw new MasterParseError(line, `trigger ref '${first}' lacks a property./zone./pin. namespace`);
  const ns = first.slice(0, dot);
  const refs = parts.map((p) => (p.includes(".") ? p : `${ns}.${p}`));
  return { anyOf: refs };
}

function parseScope(cell: string, line: number): string[] {
  const tags = cell.split(",").map((t) => t.trim()).filter(Boolean);
  if (!tags.length) throw new MasterParseError(line, "empty scope cell");
  return tags;
}

function parseItemRow(table: Table, row: { cells: string[]; line: number }, group?: string): ItemInput {
  const { cells, line } = row;
  if (cells.length !== table.header.length)
    throw new MasterParseError(line, `row has ${cells.length} cells, header has ${table.header.length}`);
  const col = (name: string) => {
    const idx = table.header.indexOf(name);
    return idx === -1 ? undefined : cells[idx];
  };
  const id = stripTicks(col("id") ?? "", line);
  if (!id) throw new MasterParseError(line, "empty id cell");
  const text = (col("text") ?? "").trim();
  if (!text) throw new MasterParseError(line, `item ${id}: empty text cell`);
  const tier = col("tier");
  if (tier !== "core" && tier !== "standard") throw new MasterParseError(line, `item ${id}: bad tier '${tier}'`);
  const attest = col("attest");
  if (attest !== "evidence" && attest !== "action")
    throw new MasterParseError(line, `item ${id}: bad attest '${attest}'`);
  const scopeCell = col("scope");
  const triggerCell = col("trigger");
  const item: ItemInput = {
    id,
    text,
    ...parseSatisfy(col("satisfy") ?? "", line),
    tier,
    attest,
    scope: scopeCell !== undefined ? parseScope(scopeCell, line) : ["baseline"],
  };
  const trigger = triggerCell !== undefined ? parseTrigger(triggerCell, line) : undefined;
  if (trigger) item.trigger = trigger;
  if (group) item.group = group;
  return item;
}

/** `### \`utility\` (renders grouped …)` → { ids: ["utility"], note: "renders grouped …" } */
/**
 * Parse a list heading into its id(s) and its modifier clauses.
 *
 * Every clause is backticked, and so are the ids — so each clause MUST be removed before
 * ids are collected. Two ids on a component heading already means a *shared* list
 * (`smoke-alarm` / `co-alarm`), so a leaked clause silently merges unrelated types rather
 * than erroring. The guards below turn those into clear failures instead.
 *
 *   ### `child` — inherits `parent`                                       (v1.4)
 *   ### `mechanical-base` — gated on `zone.attr` (renders grouped by …)   (v1.6.2)
 *
 * The gate clause is NOT anchored at end-of-line: v1.6.2 authors it before the parenthesised
 * rendering note.
 */
function parseTaggedHeading(
  line: string,
  n: number,
): { ids: string[]; note?: string; inherits?: string; gate?: string } {
  const clause = (re: RegExp) => {
    const m = line.match(re);
    return m ? { text: m[0], value: m[1]!.trim() } : null;
  };
  const inheritsC = clause(/[—-]\s*inherits\s+`([^`]+)`/);
  const gateC = clause(/[—-]\s*gated on\s+`([^`]+)`/);

  let head = line;
  for (const c of [inheritsC, gateC]) if (c) head = head.replace(c.text, " ");

  const ids = [...head.matchAll(/`([^`]+)`/g)].map((m) => m[1]!.trim());
  if (!ids.length) throw new MasterParseError(n, `heading names no backticked id: ${line}`);
  const note = head.match(/\(([^)]+)\)\s*$/)?.[1];
  if (inheritsC && ids.length !== 1)
    throw new MasterParseError(n, `an inheriting component heading must name exactly one id: ${line}`);
  // "A list may carry at most one gate" (§0). Two would need an AND the dialect doesn't declare.
  if (gateC && /gated on/.test(head))
    throw new MasterParseError(n, `a list may carry at most one gate: ${line}`);
  return {
    ids,
    ...(note ? { note } : {}),
    ...(inheritsC ? { inherits: inheritsC.value } : {}),
    ...(gateC ? { gate: gateC.value } : {}),
  };
}

export function parseMaster(markdown: string): ChecklistConfigInput {
  const lines = markdown.split("\n");

  const versionMatch = markdown.match(/\*\*Version:\*\*\s*v(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!versionMatch) throw new MasterParseError(0, "no '**Version:** vX.Y[.Z]' header found");
  const configVersion = `${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3] ?? "0"}`;

  const cfg: ChecklistConfigInput = {
    configId: "checklists-baseline",
    configVersion,
    propertyFlags: [],
    naEquivalents: [],
    zoneAttributes: [],
    zoneTypes: [],
    baseLists: [],
    zoneLists: [],
    sessionItems: [],
    componentLists: [],
    componentAliases: [],
    retiredOptions: [],
    measureUnits: [],
    provenance: [],
    naReasons: [],
    layers: [],
  };

  type Section =
    | "none" | "taxonomy" | "base" | "zone" | "session" | "component" | "stubs"
    | "flags" | "attrs" | "na" | "layers" | "aliases" | "retired-options" | "units" | "provenance"
    | "na-equivalents";
  let section: Section = "none";
  let currentList: { ids: string[]; note?: string; inherits?: string; gate?: string } | null = null;
  let currentGroup: string | undefined;

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i]!;
    const line = raw.trim();

    if (line.startsWith("## ")) {
      section =
        /^## 4\./.test(line) ? "taxonomy"
        : /^## 5\./.test(line) ? "base"
        : /^## 6b\./.test(line) ? "session"
        : /^## 6\./.test(line) ? "zone"
        : /^## 7\./.test(line) ? "component"
        : /^## A\./.test(line) ? "flags"
        : /^## B\./.test(line) ? "attrs"
        : /^## C\./.test(line) ? "na"
        : /^## D\./.test(line) ? "layers"
        : /^## E\./.test(line) ? "aliases"
        : /^## G\./.test(line) ? "retired-options"
        : /^## H\./.test(line) ? "units"
        : /^## I\./.test(line) ? "provenance"
        : /^## J\./.test(line) ? "na-equivalents"
        : "none";
      currentList = null;
      currentGroup = undefined;
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      if (section === "component" && /^### Stubs/.test(line)) {
        section = "stubs";
        currentList = null;
      } else if (section === "base" || section === "zone" || section === "component") {
        currentList = parseTaggedHeading(line, i);
        currentGroup = undefined;
      }
      i++;
      continue;
    }

    if (section === "stubs") {
      // Only a PURE id list registers stubs. v1.5 added an explanatory note under the stub
      // line naming the three types it had just promoted out of stubs — and this loop, which
      // took every backticked token in the section, re-registered them as stubs on top of
      // their real sections ("duplicate component type"). A line qualifies only if nothing
      // but ids and separators remains once the backticked ids are removed; prose has words
      // outside the ticks and is skipped.
      const residue = line.replace(/`[^`]+`/g, "").replace(/[·,;.\s]/g, "");
      if (residue === "") {
        const stubIds = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]!.trim());
        for (const id of stubIds) cfg.componentLists!.push({ types: [id], stub: true, items: [] });
      }
      i++;
      continue;
    }

    // Bold sub-headings are rendered-group keys. Zone sections have always used them
    // (utility); v1.6.1 §0 extends them to BASE lists, which mechanical-base needs: it
    // carries 24 items with 20 core, and without sub-headings they collapse into a single
    // rendered group 2.5x over the master's own <=8-core-per-group cap.
    const bold = line.match(/^\*\*([^*]+)\*\*$/);
    if (bold && (section === "zone" || section === "base") && currentList) {
      currentGroup = bold[1]!.trim();
      i++;
      continue;
    }

    if (line.startsWith("|")) {
      const { table, next } = readTable(lines, i);
      i = next;

      if (section === "taxonomy") {
        if (table.header.join("|") !== "type|typical labels|inherits")
          throw new MasterParseError(table.line, `unexpected taxonomy header: ${table.header.join(" | ")}`);
        for (const row of table.rows)
          cfg.zoneTypes!.push({
            id: stripTicks(row.cells[0] ?? "", row.line),
            typicalLabels: (row.cells[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
            inherits: (row.cells[2] ?? "").split(",").map((s) => stripTicks(s, row.line)).filter(Boolean),
          });
      } else if (section === "base" || section === "zone" || section === "component" || section === "session") {
        checkItemHeader(table);
        // Sub-headings are group keys for zone AND base lists (v1.6.1 §0).
        const items = table.rows.map((row) =>
          parseItemRow(table, row, section === "zone" || section === "base" ? currentGroup : undefined),
        );
        if (section === "session") {
          cfg.sessionItems!.push(...items);
        } else if (!currentList) {
          throw new MasterParseError(table.line, "item table outside a ### heading");
        } else if (section === "base") {
          if (currentList.ids.length !== 1)
            throw new MasterParseError(table.line, "base list heading must name exactly one id");
          // Merge, and KEEP currentList: since v1.6.1 a base list may be split across
          // several tables by bold sub-headings (mechanical-base has six). Clearing it after
          // the first table made every following one "outside a ### heading" — the same
          // multi-table shape zone lists have always had.
          const baseId = currentList.ids[0]!;
          const existingBase = cfg.baseLists!.find((b) => b.id === baseId);
          if (existingBase) existingBase.items.push(...items);
          else cfg.baseLists!.push({ id: baseId, items, ...(currentList.gate ? { gate: currentList.gate } : {}) });
        } else if (section === "zone") {
          // Utility's grouped tables arrive one sub-heading at a time — merge per zone type.
          const zoneType = currentList.ids[0]!;
          const existing = cfg.zoneLists!.find((z) => z.zoneType === zoneType);
          if (existing) existing.items.push(...items);
          else cfg.zoneLists!.push({ zoneType, items, ...(currentList.gate ? { gate: currentList.gate } : {}) });
        } else {
          const entry: NonNullable<ChecklistConfigInput["componentLists"]>[number] = {
            types: currentList.ids,
            items,
          };
          if (currentList.note) entry.note = currentList.note;
          if (currentList.inherits) entry.inherits = currentList.inherits;
          if (currentList.gate) entry.gate = currentList.gate;
          cfg.componentLists!.push(entry);
          currentList = null;
        }
      } else if (section === "flags") {
        // 2026-08-08 added a 4th column (`consumers`); both shapes accepted, exactly as
        // Table B's `defaults true for` was, so adopting the column is not a breaking edit
        // for anyone regenerating an older master.
        const flagHeader = table.header.join("|");
        if (flagHeader !== "id|label|intake source" && flagHeader !== "id|label|intake source|consumers")
          throw new MasterParseError(table.line, `unexpected property-flags header: ${table.header.join(" | ")}`);
        for (const row of table.rows) {
          const entry: NonNullable<ChecklistConfigInput["propertyFlags"]>[number] = {
            id: stripTicks(row.cells[0] ?? "", row.line),
            label: (row.cells[1] ?? "").trim(),
          };
          // `—` means NOT ASKED AT INTAKE (v1.12, `flat_roof`). Absent rather than empty:
          // the intake screen renders one group per source, so a flag carrying a sentence
          // about not being asked still renders a live toggle — issue #63's exact shape.
          const srcCell = (row.cells[2] ?? "").trim();
          if (srcCell !== "" && srcCell !== "—" && srcCell !== "-") entry.intakeSource = srcCell;
          const consCell = (row.cells[3] ?? "").trim();
          if (consCell !== "" && consCell !== "—" && consCell !== "-") {
            // Authored as "field, binder" / "field + binder" / "binder". Parsed strictly:
            // an unrecognised word fails the build rather than silently dropping a consumer,
            // because a dropped consumer reads downstream as "declared to have none".
            const parts = consCell
              .split(/[,+/]/)
              .map((p) => stripTicks(p, row.line).trim().toLowerCase())
              .filter(Boolean);
            for (const p of parts)
              if (p !== "field" && p !== "binder")
                throw new MasterParseError(row.line, `unknown flag consumer '${p}' (expected field/binder)`);
            if (!parts.length) throw new MasterParseError(row.line, "empty consumers cell");
            entry.consumers = [...new Set(parts)] as ("field" | "binder")[];
          }
          cfg.propertyFlags!.push(entry);
        }
      } else if (section === "attrs") {
        // v1.6.1 added a 4th column; both shapes accepted so the header change alone
        // isn't a breaking edit for anyone regenerating an older master.
        const attrHeader = table.header.join("|");
        if (attrHeader !== "id|label|askatcreation" && attrHeader !== "id|label|askatcreation|defaults true for")
          throw new MasterParseError(table.line, `unexpected zone-attributes header: ${table.header.join(" | ")}`);
        for (const row of table.rows) {
          const ask = (row.cells[2] ?? "").trim().toLowerCase();
          if (!ask.startsWith("yes") && !ask.startsWith("no"))
            throw new MasterParseError(row.line, `askAtCreation must start with yes/no: '${row.cells[2]}'`);
          const defCell = (row.cells[3] ?? "").trim();
          const defaultsTrueFor =
            defCell === "" || defCell === "—" || defCell === "-"
              ? []
              : defCell.split(",").map((t) => stripTicks(t)).filter(Boolean);
          cfg.zoneAttributes!.push({
            id: stripTicks(row.cells[0] ?? "", row.line),
            label: (row.cells[1] ?? "").trim(),
            askAtCreation: ask.startsWith("yes"),
            defaultsTrueFor,
          });
        }
      } else if (section === "na") {
        if (table.header.join("|") !== "id|label|note|effect")
          throw new MasterParseError(table.line, `unexpected N/A-reasons header: ${table.header.join(" | ")}`);
        for (const row of table.rows) {
          const note = (row.cells[2] ?? "").trim();
          if (note !== "optional" && note !== "recommended")
            throw new MasterParseError(row.line, `N/A note must be optional/recommended: '${note}'`);
          const effect = (row.cells[3] ?? "").trim();
          cfg.naReasons!.push({
            id: stripTicks(row.cells[0] ?? "", row.line),
            label: (row.cells[1] ?? "").trim(),
            note,
            feedsGapList: /gap list/i.test(effect),
            recordsFinding: /finding/i.test(effect),
          });
        }
      } else if (section === "layers") {
        if (table.header.join("|") !== "id|label|predicate")
          throw new MasterParseError(table.line, `unexpected layers header: ${table.header.join(" | ")}`);
        for (const row of table.rows) {
          const pred = (row.cells[2] ?? "").trim();
          let predicate: NonNullable<ChecklistConfigInput["layers"]>[number]["predicate"] = {};
          if (pred === "—" || pred === "-" || pred === "") {
            predicate = {};
          } else if (/^flag\s*=\s*/.test(pred)) {
            const flag = pred.replace(/^flag\s*=\s*/, "").trim();
            if (flag !== "fine" && flag !== "monitor" && flag !== "issue")
              throw new MasterParseError(row.line, `unknown pin flag in layer predicate: '${flag}'`);
            predicate = { flags: [flag] };
          } else if (/^types:\s*/.test(pred)) {
            predicate = {
              componentTypes: pred.replace(/^types:\s*/, "").split(",").map((s) => stripTicks(s)).filter(Boolean),
            };
          } else {
            throw new MasterParseError(row.line, `unparseable layer predicate: '${pred}'`);
          }
          cfg.layers!.push({
            id: stripTicks(row.cells[0] ?? "", row.line),
            label: (row.cells[1] ?? "").trim(),
            predicate,
          });
        }
      } else if (section === "retired-options") {
        if (table.header.join("|") !== "item|retired value|version|replacement|reason")
          throw new MasterParseError(table.line, `unexpected Table G header: ${table.header.join(" | ")}`);
        for (const row of table.rows) {
          const itemId = stripTicks(row.cells[0] ?? "", row.line);
          // The seeded placeholder row exists so the first retirement has a home; skip it.
          if (!itemId || itemId === "—" || itemId === "-") continue;
          // stripTicks, NOT trim. The value must equal the authored option EXACTLY, or the
          // schema's "a retired value must not still be live" check compares `none` against
          // none and can never fire — rule 11b, a check whose two sides cannot disagree has
          // not been passing. Table G was empty until v1.12, so nothing exercised it.
          const value = stripTicks(row.cells[1] ?? "", row.line);
          const replacement = stripTicks(row.cells[3] ?? "", row.line);
          const reason = (row.cells[4] ?? "").trim();
          cfg.retiredOptions!.push({
            itemId,
            value,
            version: (row.cells[2] ?? "").trim(),
            ...(replacement && replacement !== "—" ? { replacement } : {}),
            ...(reason && reason !== "—" ? { reason } : {}),
          });
        }
      } else if (section === "provenance") {
        if (table.header.join("|") !== "item|value derived from|source artifact item")
          throw new MasterParseError(table.line, `unexpected Table I header: ${table.header.join(" | ")}`);
        for (const row of table.rows) {
          const itemId = stripTicks(row.cells[0] ?? "", row.line);
          if (!itemId || itemId === "—") continue;
          // The source cell may carry a parenthetical note — "`wt.nameplate` *(inherited)*" —
          // so read the backticked id rather than the whole cell.
          const src = (row.cells[2] ?? "").match(/`([^`]+)`/)?.[1]?.trim() ?? "";
          if (!src) throw new MasterParseError(row.line, `Table I: ${itemId} names no source item`);
          cfg.provenance!.push({ itemId, derivedFrom: (row.cells[1] ?? "").trim(), sourceItemId: src });
        }
      } else if (section === "na-equivalents") {
        // Table J (v1.12) — an option value whose consequence is an N/A reason's. Parsed here;
        // the three referential checks are the schema's, beside Table G's and Table I's.
        if (table.header.join("|") !== "item|option value|equivalent n/a reason|consequence")
          throw new MasterParseError(table.line, `unexpected Table J header: ${table.header.join(" | ")}`);
        for (const row of table.rows) {
          const itemId = stripTicks(row.cells[0] ?? "", row.line);
          const value = stripTicks(row.cells[1] ?? "", row.line);
          const reasonId = stripTicks(row.cells[2] ?? "", row.line);
          if (!itemId || !value || !reasonId)
            throw new MasterParseError(row.line, "Table J needs item, option value and reason id");
          cfg.naEquivalents!.push({ itemId, value, reasonId });
        }
      } else if (section === "units") {
        if (table.header.join("|") !== "unit|means|used by")
          throw new MasterParseError(table.line, `unexpected Table H header: ${table.header.join(" | ")}`);
        for (const row of table.rows) {
          const unit = stripTicks(row.cells[0] ?? "", row.line);
          if (!unit || unit === "—") continue;
          cfg.measureUnits!.push({ unit, means: (row.cells[1] ?? "").trim() });
        }
      } else if (section === "aliases") {
        // Table E (v1.5): search-only synonyms. The alias cell is free text — the authored
        // terms carry spaces and capitals ("hot water tank", "UV") — so it is NOT stripTicks'd
        // into an id shape; only the target is a backticked component type.
        if (table.header.join("|") !== "alias|resolves to")
          throw new MasterParseError(table.line, `unexpected aliases header: ${table.header.join(" | ")}`);
        for (const row of table.rows) {
          const alias = (row.cells[0] ?? "").trim();
          const type = stripTicks(row.cells[1] ?? "");
          if (!alias) throw new MasterParseError(row.line, "empty alias cell");
          if (!type) throw new MasterParseError(row.line, `alias '${alias}' resolves to nothing`);
          cfg.componentAliases!.push({ alias, type });
        }
      } else {
        // Tables in prose sections (§0 dialect examples, changelog) are not config — skip.
      }
      continue;
    }

    i++;
  }

  return cfg;
}

const GENERATED_HEADER = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source of truth: docs/CHECKLIST-MASTER.md (human-edited, versioned).
 * Regenerate with: npm run gen:checklists
 * CI fails if this file does not byte-match a fresh regeneration (tests/engine/checklists.test.ts).
 */
import type { ChecklistConfigInput } from "../engine/schema/checklistConfig";

export const checklistsBaseline: ChecklistConfigInput = `;

export function emitModule(cfg: ChecklistConfigInput): string {
  return `${GENERATED_HEADER}${JSON.stringify(cfg, null, 2)};\n`;
}
