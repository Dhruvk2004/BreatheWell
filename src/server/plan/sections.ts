import type { ValidPlan } from "@/ai/plan/validate";
import type { PersonPlan } from "@/domain/family/people";
import type { ActivityPlan } from "@/domain/rules/plan";
import type { RuleSnapshot, SectionRecord } from "../repos/planRecords";

/** The rule facts an item's words were written for (spec 7.2: a changed rule shows the template). */
export const snapshotOf = (plan: ActivityPlan): RuleSnapshot => ({
  verdictAtUsual: plan.verdictAtUsual,
  suggestion: plan.suggestion,
  bestTime: plan.bestTime,
  switchTo: plan.switchTo,
});

/** True when the rule result is still the one the words were written for. */
export const sameRule = (a: RuleSnapshot, b: RuleSnapshot): boolean =>
  a.verdictAtUsual === b.verdictAtUsual && a.suggestion === b.suggestion && a.bestTime === b.bestTime && a.switchTo === b.switchTo;

/** One stored section per planned person, each item with its rule snapshot (spec 9.1). */
export function sectionsOf(plan: ValidPlan, rows: readonly PersonPlan[]): Record<string, SectionRecord> {
  const sections: Record<string, SectionRecord> = {};
  for (const row of rows) {
    const words = plan.people[row.person.id];
    if (!words) continue;
    const items: SectionRecord["items"] = {};
    for (const { activity, plan: rule } of row.items) {
      const item = words.items[activity.id];
      if (item) items[activity.id] = { ...item, rule: snapshotOf(rule) };
    }
    const headline = row.headline;
    const line = words.line && headline ? { text: words.line, activityId: headline.activity.id, rule: snapshotOf(headline.plan) } : null;
    sections[row.person.id] = { line, items, swap: words.swap };
  }
  return sections;
}
