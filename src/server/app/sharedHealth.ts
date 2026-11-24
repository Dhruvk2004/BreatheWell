import { canSeeHealth } from "@/domain/family/permissions";
import { namedConditions, type NamedCondition } from "@/domain/rules/conditionTicks";
import { dbOf, type AppDeps } from "../deps";
import { paths } from "../repos/paths";
import { healthRecord, parsed } from "../repos/records";
import type { InFamily } from "./guards";

/**
 * The health condition names this viewer may see on a person's plan: an adult's
 * only as they chose to share them (the same check as the security rules, 9.2); a dependent's
 * ticks are seen by every adult in the family.
 */
export async function visibleConditions(viewer: InFamily, personId: string, deps: AppDeps): Promise<NamedCondition[]> {
  const dependent = viewer.bundle.dependents.find((d) => d.id === personId);
  if (dependent) return namedConditions(dependent.record.conditions);
  const health = parsed(healthRecord, await dbOf(deps).get(paths.health(personId)));
  if (!health || !canSeeHealth(health.shareWith, personId, viewer.uid, viewer.bundle.family)) return [];
  return namedConditions(health.conditions);
}
