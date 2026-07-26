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

const stripTicks = (s: string) => s.replace(/`/g, "").trim();

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
  const inner = stripTicks(cell);
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
  const id = stripTicks(col("id") ?? "");
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
function parseTaggedHeading(line: string, n: number): { ids: string[]; note?: string; inherits?: string } {
  // v1.4 component inheritance: "### `child` — inherits `parent`". The clause MUST be
  // stripped before ids are collected — otherwise the parent reads as a second id on the
  // heading, which is the existing syntax for a *shared* list (`smoke-alarm` / `co-alarm`),
  // and the two types would merge into one list instead of one inheriting the other.
  // The guard below turns that into a clear error; without it the failure still surfaces,
  // but as a confusing "duplicate component type" from the validator three steps later.
  const inheritsMatch = line.match(/[—-]\s*inherits\s+`([^`]+)`\s*$/);
  const head = inheritsMatch ? line.slice(0, line.indexOf(inheritsMatch[0])) : line;
  const ids = [...head.matchAll(/`([^`]+)`/g)].map((m) => m[1]!.trim());
  if (!ids.length) throw new MasterParseError(n, `heading names no backticked id: ${line}`);
  const note = head.match(/\(([^)]+)\)\s*$/)?.[1];
  const inherits = inheritsMatch?.[1]!.trim();
  if (inherits && ids.length !== 1)
    throw new MasterParseError(n, `an inheriting component heading must name exactly one id: ${line}`);
  return { ids, ...(note ? { note } : {}), ...(inherits ? { inherits } : {}) };
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
    zoneAttributes: [],
    zoneTypes: [],
    baseLists: [],
    zoneLists: [],
    sessionItems: [],
    componentLists: [],
    naReasons: [],
    layers: [],
  };

  type Section =
    | "none" | "taxonomy" | "base" | "zone" | "session" | "component" | "stubs"
    | "flags" | "attrs" | "na" | "layers";
  let section: Section = "none";
  let currentList: { ids: string[]; note?: string; inherits?: string } | null = null;
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
      const stubIds = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]!.trim());
      for (const id of stubIds) cfg.componentLists!.push({ types: [id], stub: true, items: [] });
      i++;
      continue;
    }

    // Bold sub-headings inside a zone section are rendered-group keys (utility).
    const bold = line.match(/^\*\*([^*]+)\*\*$/);
    if (bold && section === "zone" && currentList) {
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
            id: stripTicks(row.cells[0] ?? ""),
            typicalLabels: (row.cells[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
            inherits: (row.cells[2] ?? "").split(",").map((s) => stripTicks(s)).filter(Boolean),
          });
      } else if (section === "base" || section === "zone" || section === "component" || section === "session") {
        checkItemHeader(table);
        const items = table.rows.map((row) =>
          parseItemRow(table, row, section === "zone" ? currentGroup : undefined),
        );
        if (section === "session") {
          cfg.sessionItems!.push(...items);
        } else if (!currentList) {
          throw new MasterParseError(table.line, "item table outside a ### heading");
        } else if (section === "base") {
          if (currentList.ids.length !== 1)
            throw new MasterParseError(table.line, "base list heading must name exactly one id");
          cfg.baseLists!.push({ id: currentList.ids[0]!, items });
          currentList = null;
        } else if (section === "zone") {
          // Utility's grouped tables arrive one sub-heading at a time — merge per zone type.
          const zoneType = currentList.ids[0]!;
          const existing = cfg.zoneLists!.find((z) => z.zoneType === zoneType);
          if (existing) existing.items.push(...items);
          else cfg.zoneLists!.push({ zoneType, items });
        } else {
          const entry: NonNullable<ChecklistConfigInput["componentLists"]>[number] = {
            types: currentList.ids,
            items,
          };
          if (currentList.note) entry.note = currentList.note;
          if (currentList.inherits) entry.inherits = currentList.inherits;
          cfg.componentLists!.push(entry);
          currentList = null;
        }
      } else if (section === "flags") {
        if (table.header.join("|") !== "id|label|intake source")
          throw new MasterParseError(table.line, `unexpected property-flags header: ${table.header.join(" | ")}`);
        for (const row of table.rows)
          cfg.propertyFlags!.push({
            id: stripTicks(row.cells[0] ?? ""),
            label: (row.cells[1] ?? "").trim(),
            intakeSource: (row.cells[2] ?? "").trim(),
          });
      } else if (section === "attrs") {
        if (table.header.join("|") !== "id|label|askatcreation")
          throw new MasterParseError(table.line, `unexpected zone-attributes header: ${table.header.join(" | ")}`);
        for (const row of table.rows) {
          const ask = (row.cells[2] ?? "").trim().toLowerCase();
          if (!ask.startsWith("yes") && !ask.startsWith("no"))
            throw new MasterParseError(row.line, `askAtCreation must start with yes/no: '${row.cells[2]}'`);
          cfg.zoneAttributes!.push({
            id: stripTicks(row.cells[0] ?? ""),
            label: (row.cells[1] ?? "").trim(),
            askAtCreation: ask.startsWith("yes"),
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
            id: stripTicks(row.cells[0] ?? ""),
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
            id: stripTicks(row.cells[0] ?? ""),
            label: (row.cells[1] ?? "").trim(),
            predicate,
          });
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
