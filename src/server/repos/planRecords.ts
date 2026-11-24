import { z } from "zod";
import { MODES } from "@/domain/rules/modes";
import { SUGGESTIONS } from "@/domain/rules/plan";
import { LANGS } from "@/domain/time/format";
import { planText } from "@/ai/plan/schema";

/**
 * Stored family plans (spec 9.1 `plans/{date}` and `plans/{date}/members/{id}`). Gemini's words are
 * stored with their `{m1}` tokens and the token map, so names are filled in from the current
 * family on every read; each item keeps the rule result it was written for, so an item whose rule
 * changed since (a band change during the day) shows its template instead.
 */
const text = planText;
const verdict = z.enum(["go", "care", "avoid"]);

export const ruleSnapshot = z.object({
  verdictAtUsual: verdict,
  suggestion: z.enum(SUGGESTIONS),
  bestTime: z.number().nullable(),
  switchTo: z.enum(MODES).nullable(),
});

const words = z.object({ doThis: text, why: text.optional(), factId: z.string().optional() });

export const sectionRecord = z.object({
  line: z.object({ text, activityId: z.string(), rule: ruleSnapshot }).nullable().default(null),
  items: z.record(z.string(), words.extend({ rule: ruleSnapshot })).default({}),
  swap: words.extend({ altId: z.string() }).nullable().default(null),
});

/** The plan doc; every field has a default, because a member change may create it with `stale` only. */
export const planRecord = z.object({
  source: z.enum(["gemini", "template"]).nullable().default(null),
  generatedAt: z.string().nullable().default(null),
  generatingSince: z.string().nullable().default(null),
  generations: z.number().int().min(0).default(0),
  stale: z.boolean().default(false),
  outcome: z.string().nullable().default(null),
  languages: z.array(z.enum(LANGS)).default([]),
  tokens: z.record(z.string(), z.string()).default({}),
  home: z.array(z.object({ tipId: z.string(), doThis: text, why: text.optional() })).default([]),
  together: z.object({ altId: z.string(), doThis: text }).nullable().default(null),
});

export type RuleSnapshot = z.infer<typeof ruleSnapshot>;
export type SectionRecord = z.infer<typeof sectionRecord>;
export type PlanRecord = z.infer<typeof planRecord>;

/** A stored plan and its sections by person id. */
export interface StoredPlan {
  readonly plan: PlanRecord;
  readonly sections: Readonly<Record<string, SectionRecord>>;
}
