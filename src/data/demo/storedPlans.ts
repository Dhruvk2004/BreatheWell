import { z } from "zod";
import { SCENARIO_IDS, type ScenarioId } from "@/data/recorded/scenarios";
import { planRecord, sectionRecord, type StoredPlan } from "@/server/repos/planRecords";
import stored from "./storedPlans.json";

/**
 * The demo's stored 6 am Gemini plans (spec 10.3, 7.8: 0 live calls on page view), written once by
 * `npm run demo:record-plans` with a real key, the same prompt and the same validator as families.
 * Empty until a key exists: the demo then shows the template, labelled "Simple plan".
 */
const storedDemoPlan = z.object({
  recordedOn: z.string(),
  model: z.string(),
  promptVersion: z.number(),
  plan: planRecord,
  sections: z.record(z.string(), sectionRecord),
});

export type StoredDemoPlan = z.infer<typeof storedDemoPlan>;

const file = z.partialRecord(z.enum(SCENARIO_IDS), storedDemoPlan).parse(stored);

/** A recorded scenario's stored plan, or null when none was recorded. */
export function storedDemoPlanFor(scenario: string): StoredPlan | null {
  const entry = (SCENARIO_IDS as readonly string[]).includes(scenario) ? file[scenario as ScenarioId] : undefined;
  return entry ? { plan: entry.plan, sections: entry.sections } : null;
}

/** Every stored plan with its scenario (for the release-blocker tests). */
export const storedDemoPlans = (): [ScenarioId, StoredDemoPlan][] =>
  Object.entries(file).flatMap(([id, plan]) => (plan ? [[id as ScenarioId, plan] as [ScenarioId, StoredDemoPlan]] : []));
