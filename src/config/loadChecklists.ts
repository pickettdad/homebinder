/**
 * Checklist config loader seam — mirrors loadRoute.ts. Callers get a validated config;
 * externalizing to a fetched JSON later is a loader swap, not a remodel.
 */
import { checklistsBaseline } from "./checklists.generated";
import { validateChecklistConfig, type ChecklistConfig } from "../engine/schema/checklistConfig";

export function loadChecklists(): ChecklistConfig {
  const result = validateChecklistConfig(checklistsBaseline);
  if (!result.ok) {
    // Fail closed at startup with readable errors — a bad generate cannot brick silently.
    throw new Error(`checklist config invalid:\n${result.errors.join("\n")}`);
  }
  return result.config;
}
