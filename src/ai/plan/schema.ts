import { z } from "zod";
import type { Band } from "@/domain/air/bands";
import type { PmPollutant } from "@/domain/air/aqi";
import type { WeatherWhy } from "@/domain/air/weatherWhy";
import type { HomeSetup } from "@/domain/libraries/homeSetup";
import type { ActivityType } from "@/domain/rules/activities";
import type { AgeGroup, CareTag } from "@/domain/rules/groups";
import type { Mode } from "@/domain/rules/modes";
import { SUGGESTIONS, type Suggestion } from "@/domain/rules/plan";
import type { Verdict } from "@/domain/rules/verdict";
import type { Lang } from "@/domain/time/format";

/**
 * The family plan's prompt input and Gemini's structured output. The input is built by
 * code and pseudonymised (`m1`…, `d1`…, `a1`…); the output schema is sent to Gemini as its response
 * schema and checks the reply. Every text field is `{ en?, hi? }` with exactly the family's languages.
 */
export const PLAN_TEXT_MAX = 300;
/** Spec 7.2 caps; the schema accepts a few more, and the validator keeps only the first ones. */
export const MAX_ITEMS = 4;
export const MAX_HOME_TIPS = 3;

/** One text field: `{ en?, hi? }` (also the stored form, `server/repos/planRecords.ts`). */
export const planText = z.object({ en: z.string().max(PLAN_TEXT_MAX).optional(), hi: z.string().max(PLAN_TEXT_MAX).optional() });
const text = planText;
const id = z.string().max(40);

const item = z.object({
  activityId: id,
  kind: z.enum(SUGGESTIONS),
  doThis: text,
  why: text.optional(),
  factId: id.optional(),
});

const swap = z.object({ altId: id, doThis: text, why: text.optional(), factId: id.optional() });

const member = z.object({
  memberId: id,
  /** The Today row's one line (EN ≤ 45, HI ≤ 40 characters). */
  line: text,
  items: z.array(item).max(10),
  swap: swap.optional(),
});

export const planOutputSchema = z.object({
  members: z.array(member).max(10),
  home: z.array(z.object({ tipId: id, doThis: text, why: text.optional() })).max(10),
  together: z.object({ altId: id, doThis: text }).optional(),
});

export type PlanText = z.infer<typeof text>;
export type PlanOutput = z.infer<typeof planOutputSchema>;
export type PlanOutputMember = PlanOutput["members"][number];
export type PlanOutputItem = PlanOutputMember["items"][number];

/** One activity in the prompt: its token, type, usual time and the rule result (never changed by Gemini). */
export interface PlanInputActivity {
  readonly id: string;
  readonly type: ActivityType;
  /** "06:30" */
  readonly usual: string;
  readonly hourBand: "early_morning" | "morning" | "afternoon" | "evening" | "night";
  readonly rule: {
    readonly verdictAtUsual: Verdict;
    readonly suggestion: Suggestion;
    /** "15:00", or null. */
    readonly bestTime: string | null;
    readonly verdictAtBest: Verdict | null;
    readonly switchTo: Mode | null;
  };
}

/** A member (`m1`) or dependent (`d1`) with no name, no uid and no condition names. */
export interface PlanInputPerson {
  readonly id: string;
  readonly role: "adult" | "grandparent" | "child" | "teen";
  readonly ageGroup: AgeGroup;
  readonly care: CareTag;
  /** Adults only; a dependent's card language is never sent. */
  readonly language?: Lang;
  readonly travel: Mode;
  readonly activities: readonly PlanInputActivity[];
  /** The alternatives code allows for this person; Gemini picks at most one. */
  readonly alternatives: readonly string[];
}

export interface PlanInput {
  readonly date: string;
  readonly place: string;
  readonly air: {
    readonly nowBand: Band;
    readonly avg24Band: Band | null;
    readonly mainPollutant: PmPollutant;
    /** "14:00-16:00", or null when the forecast is too short. */
    readonly bestWindow: string | null;
    readonly worstWindow: string | null;
    readonly weatherWhy: WeatherWhy | null;
  };
  readonly home: HomeSetup;
  readonly members: readonly PlanInputPerson[];
  readonly languages: readonly Lang[];
  readonly allowedTips: readonly string[];
  /** The "Help the air" action code chose for today; Gemini only words it. */
  readonly together: string;
  readonly allowedAlternatives: readonly string[];
  readonly allowedFacts: readonly string[];
}
