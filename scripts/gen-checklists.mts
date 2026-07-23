/**
 * Regenerate src/config/checklists.generated.ts from docs/CHECKLIST-MASTER.md.
 * Validates against the Zod schema before writing — a malformed master never lands.
 *
 * Usage: npm run gen:checklists   (node 22.18+ runs .mts natively via type stripping)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseMaster, emitModule, MasterParseError } from "./lib/genChecklists.ts";
import { validateChecklistConfig } from "../src/engine/schema/checklistConfig.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const masterPath = join(root, "docs", "CHECKLIST-MASTER.md");
const outPath = join(root, "src", "config", "checklists.generated.ts");

try {
  const config = parseMaster(readFileSync(masterPath, "utf8"));
  const result = validateChecklistConfig(config);
  if (!result.ok) {
    console.error("CHECKLIST-MASTER.md parsed but failed schema validation:");
    for (const err of result.errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  writeFileSync(outPath, emitModule(config));
  const itemCount =
    result.config.baseLists.reduce((n, b) => n + b.items.length, 0) +
    result.config.zoneLists.reduce((n, z) => n + z.items.length, 0) +
    result.config.sessionItems.length +
    result.config.componentLists.reduce((n, c) => n + c.items.length, 0);
  console.log(
    `checklists.generated.ts written: v${result.config.configVersion}, ${itemCount} items, ` +
      `${result.config.componentLists.length} component lists, ${result.config.layers.length} layers`,
  );
} catch (err) {
  if (err instanceof MasterParseError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
