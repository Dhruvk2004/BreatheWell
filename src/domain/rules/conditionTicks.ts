import type { Condition } from "./groups";

/** "None", "Prefer not to say" and "Not sure" are answers on their own. */
const ALONE: ReadonlySet<Condition> = new Set(["none", "prefer_not", "not_sure"]);

/** True when a stand-alone answer is not mixed with real conditions (the server's check). */
export const conditionsConsistent = (conditions: readonly Condition[]): boolean =>
  conditions.length <= 1 || !conditions.some((c) => ALONE.has(c));

/**
 * The ticks after a change: ticking a stand-alone answer keeps only it; ticking a condition clears
 * the stand-alone answers. `next` is the new list, `before` the old one.
 */
export function toggleConditionTicks<C extends Condition>(next: readonly C[], before: readonly C[]): C[] {
  const added = next.find((c) => !before.includes(c));
  if (added !== undefined && ALONE.has(added)) return [added];
  return next.filter((c) => !ALONE.has(c));
}

/** The real conditions, the ones listed by name where they are shared. */
export const NAMED_CONDITIONS = ["asthma", "copd", "heart", "allergies", "pregnant"] as const satisfies readonly Condition[];
export type NamedCondition = (typeof NAMED_CONDITIONS)[number];

/** Only the real conditions of a list, in the order given. */
export const namedConditions = (conditions: readonly Condition[]): NamedCondition[] =>
  conditions.filter((c): c is NamedCondition => (NAMED_CONDITIONS as readonly Condition[]).includes(c));
