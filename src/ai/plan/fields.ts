import { contradictions, type RuleFacts } from "@/ai/shared/contradiction";
import type { ClockTime } from "@/ai/shared/times";
import { checkText, LENGTH_CAPS } from "@/ai/shared/validate";
import { kidCardProblems } from "@/domain/libraries/kid";
import type { Lang } from "@/domain/time/format";
import { parseHhMm } from "@/domain/time/format";
import type { PlanInputActivity, PlanText } from "./schema";
import { PLAN_TOKEN } from "./tokens";

/**
 * One text field of the plan reply, checked in every family language: the shared
 * validator (length after names are filled in, language, numbers, banned content), the concrete
 * contradiction checks for an activity, and the kid-card checks for a dependent's text.
 */
export type FieldCap = keyof typeof LENGTH_CAPS;

export interface FieldContext {
  readonly languages: readonly Lang[];
  readonly allowedTimes: readonly ClockTime[];
  /** Every name and alias in the family: Gemini never received one, so any of them is a leak. */
  readonly names: readonly string[];
  /** Token → name, to measure the line as it will be shown. */
  readonly nameOf: Readonly<Record<string, string>>;
}

export interface FieldSpec {
  readonly cap: FieldCap;
  readonly forDependent: boolean;
  readonly rule?: RuleFacts;
}

/** The text as shown: tokens filled in with names (used for the length cap). */
export const filled = (text: string, nameOf: Readonly<Record<string, string>>): string =>
  text.replace(PLAN_TOKEN, (whole, token: string) => nameOf[token] ?? whole);

/** Reasons one language of a field is rejected; empty when it may be shown. */
function problemsIn(raw: string, lang: Lang, spec: FieldSpec, ctx: FieldContext): string[] {
  const tokens = [...raw.matchAll(PLAN_TOKEN)].map((m) => m[1]);
  const reasons: string[] = tokens.some((t) => !(t in ctx.nameOf)) ? ["unknown_token"] : [];
  const shown = filled(raw, ctx.nameOf).trim();
  if ([...shown].length > LENGTH_CAPS[spec.cap][lang]) reasons.push("too_long");
  const rules = {
    lang,
    maxLength: Number.MAX_SAFE_INTEGER,
    allowedTimes: ctx.allowedTimes,
    names: ctx.names,
    forDependent: spec.forDependent,
  };
  reasons.push(...checkText(raw, rules));
  if (spec.rule) reasons.push(...contradictions(raw, spec.rule));
  if (spec.forDependent) reasons.push(...kidCardProblems(raw.replace(PLAN_TOKEN, " ")).map((p) => `kid_${p}`));
  return reasons;
}

/**
 * The field when every family language is present and passes; otherwise null with the reasons
 * (outcome codes for the log, never the text).
 */
export function checkField(text: PlanText | undefined, spec: FieldSpec, ctx: FieldContext): { text: PlanText | null; reasons: string[] } {
  if (!text) return { text: null, reasons: ["missing"] };
  const reasons = ctx.languages.flatMap((lang) => {
    const value = text[lang]?.trim();
    return value ? problemsIn(value, lang, spec, ctx) : ["missing_language"];
  });
  if (reasons.length > 0) return { text: null, reasons: [...new Set(reasons)] };
  return { text: Object.fromEntries(ctx.languages.map((lang) => [lang, (text[lang] as string).trim()])), reasons: [] };
}

/** The rule facts an activity's text is checked against. */
export function ruleFactsOf(activity: PlanInputActivity): RuleFacts {
  const usual = parseHhMm(activity.usual);
  return {
    verdictAtUsual: activity.rule.verdictAtUsual,
    suggestion: activity.rule.suggestion,
    usualHour: usual.hour,
    usualMinute: usual.minute,
    bestTime: activity.rule.bestTime === null ? null : parseHhMm(activity.rule.bestTime).hour,
    switchTo: activity.rule.switchTo,
  };
}

/** Counts outcomes while fields are checked. */
export class Tally {
  passed = 0;
  failed = 0;
  readonly reasons: string[] = [];
  fail(reason: string): null {
    this.failed += 1;
    this.reasons.push(reason);
    return null;
  }
  field(text: PlanText | undefined, spec: FieldSpec, ctx: FieldContext): PlanText | null {
    const result = checkField(text, spec, ctx);
    if (!result.text) {
      this.failed += 1;
      this.reasons.push(...result.reasons);
    } else this.passed += 1;
    return result.text;
  }
}
