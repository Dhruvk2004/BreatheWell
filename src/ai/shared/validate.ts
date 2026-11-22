import type { Lang } from "@/domain/time/format";
import { banProblems, type BanProblem } from "./banned";
import { contradictions, type ContradictionProblem, type RuleFacts } from "./contradiction";
import { inLanguage } from "./language";
import { normaliseNumbers } from "./normalise";
import { numberProblems, type NumberProblem } from "./numbers";
import { nfc } from "./text";
import type { ClockTime } from "./times";

/**
 * The semantic validator (spec 7.1) for every Gemini text field: length, language, numbers, banned
 * content and, for plan items, the contradiction checks. An empty list means the text may be shown;
 * anything else falls back to the template (and is logged as `invalid:<reason>`, never the text).
 */
export type Rejection = "too_long" | "wrong_language" | NumberProblem | BanProblem | ContradictionProblem;

export interface FieldRules {
  readonly lang: Lang;
  readonly maxLength: number;
  /** Times the input allows: usual times, best times and window ends. */
  readonly allowedTimes: readonly ClockTime[];
  /** Every member's and dependent's name and the viewer's aliases. */
  readonly names: readonly string[];
  readonly forDependent: boolean;
}

/** Length caps by field and language (design round 2: Today rows EN ≤ 45, HI ≤ 40; doThis EN ≤ 110, HI ≤ 90). */
export const LENGTH_CAPS = {
  rowLine: { en: 45, hi: 40 },
  doThis: { en: 110, hi: 90 },
  why: { en: 100, hi: 100 },
  summary: { en: 140, hi: 140 },
} as const;

/** Every reason a text field is rejected. */
export function checkText(raw: string, rules: FieldRules): Rejection[] {
  const text = nfc(raw).trim();
  const problems: Rejection[] = [];
  if ([...text].length > rules.maxLength) problems.push("too_long");
  if (!inLanguage(text, rules.lang)) problems.push("wrong_language");
  problems.push(...numberProblems(text, rules.allowedTimes));
  // Bans run on normalised numbers too, so "दो पफ" is caught like "2 puffs".
  problems.push(...banProblems(normaliseNumbers(text), { names: rules.names, forDependent: rules.forDependent }));
  return problems;
}

/** A plan item's `doThis`: the field checks plus the contradiction checks against its rule. */
export function checkPlanItem(doThis: string, rule: RuleFacts, rules: FieldRules): Rejection[] {
  return [...checkText(doThis, rules), ...contradictions(doThis, rule)];
}

/** True when the text passes. */
export const isValidText = (raw: string, rules: FieldRules): boolean => checkText(raw, rules).length === 0;

/** Ids Gemini returned that were not in the input lists (spec 7.1: `memberId`, `factId`, `tipId`, `altId`). */
export function unknownIds(returned: readonly string[], allowed: readonly string[]): string[] {
  return returned.filter((id) => !allowed.includes(id));
}
