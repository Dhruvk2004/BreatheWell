import type { PersonPlan } from "@/domain/family/people";
import type { Verdict } from "@/domain/rules/verdict";
import type { Lang } from "@/domain/time/format";
import { rowLine } from "../plan/template";

/**
 * Breezy's fallback: "I can't think right now.
 * Here are today's basics:" and each person's row from the rules, in code words (the template
 * plan's row line). Nothing here is Gemini text.
 */
export interface BasicsRow {
  readonly id: string;
  readonly verdict: Verdict;
  readonly line: string;
}

/** One row per planned person, in Today's order; people without a planned activity are left out. */
export function basicsRows(rows: readonly PersonPlan[], lang: Lang): BasicsRow[] {
  return rows.flatMap(({ person, headline }) => {
    if (!headline) return [];
    const input = { type: headline.activity.type, usual: headline.activity.usual, mainMode: person.travel.main, plan: headline.plan };
    return [{ id: person.id, verdict: headline.plan.verdictAtUsual, line: rowLine(input, lang) }];
  });
}
