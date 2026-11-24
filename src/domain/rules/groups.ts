/** Sensitivity groups: the strictest that applies. */
export type Group = "everyday" | "sensitive" | "extra";

/** Adults choose 18–59 or 60+; dependents are Under 13 or 13–17. */
export type AdultAgeGroup = "18to59" | "60plus";
export type DependentAgeGroup = "under13" | "13to17";
export type AgeGroup = AdultAgeGroup | DependentAgeGroup;

/** Health ticks across adults (6.1) and dependents (6.2). Every one is optional. */
export type Condition = "asthma" | "copd" | "heart" | "allergies" | "pregnant" | "not_sure" | "none" | "prefer_not";

/** The tag the family sees and Gemini receives instead of condition names. */
export type CareTag = "none" | "sensitive" | "extra";

const EXTRA: readonly Condition[] = ["asthma", "copd", "heart"];
const SENSITIVE_CONDITIONS: readonly Condition[] = ["allergies", "pregnant", "not_sure"];
const SENSITIVE_AGES: readonly AgeGroup[] = ["under13", "60plus"];

/**
 * The sensitivity group: Extra care for asthma, lung or heart conditions (any age); Sensitive for
 * under 13, 60+, pregnancy, allergies or "Not sure"; otherwise Everyday ("prefer not to say" assumes no illness).
 */
export function sensitivityGroup(ageGroup: AgeGroup, conditions: readonly Condition[]): Group {
  if (conditions.some((c) => EXTRA.includes(c))) return "extra";
  if (SENSITIVE_AGES.includes(ageGroup) || conditions.some((c) => SENSITIVE_CONDITIONS.includes(c))) return "sensitive";
  return "everyday";
}

/** The care tag for a group. */
export function careTagOf(group: Group): CareTag {
  return group === "everyday" ? "none" : group;
}
