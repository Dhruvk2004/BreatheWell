import type { HourIndex } from "../air/hourly";
import type { Clock } from "../time/clock";
import type { Activity } from "./activities";
import type { RuleContext } from "./context";
import type { Group } from "./groups";
import type { Mode } from "./modes";
import type { Verdict } from "./verdict";

/** What the plan tells the person to do (spec 7.2 `kind`, plus "as planned" for a Go). */
export const SUGGESTIONS = ["as_planned", "move_time", "switch_mode", "protect", "indoor"] as const;
export type Suggestion = (typeof SUGGESTIONS)[number];

/** Code-made notes and checklist items the UI and templates render. */
export const PLAN_NOTES = [
  "winter_caution",
  "severe_day",
  "schools_may_close",
  "keep_inhaler",
  "essential_protect",
  "car_carpool_no_idling",
] as const;
export type PlanNote = (typeof PLAN_NOTES)[number];

/** The person the rules plan for: a member or a dependent, without any name. */
export interface Planned {
  readonly group: Group;
  readonly travel: { readonly main: Mode; readonly others: readonly Mode[] };
}

/** The air and time the rules plan against. */
export interface PlanEnv {
  readonly index: HourIndex;
  readonly clock: Clock;
  readonly ctx: RuleContext;
}

/** The rule result for one activity: the prompt's `rule` object and every chip and time on screen. */
export interface ActivityPlan {
  readonly activityId: string;
  /** The day planned: today, or tomorrow after 21:00 (spec 8.4 step 9). */
  readonly date: string;
  readonly usualHour: number;
  /** The row's chip (design note: chip = verdict at the usual time). */
  readonly verdictAtUsual: Verdict;
  readonly suggestion: Suggestion;
  /** Start hour of the suggested time (move_time), else null. */
  readonly bestTime: number | null;
  /** Verdict after the change (new time or new mode), else null. */
  readonly verdictAtBest: Verdict | null;
  readonly switchTo: Mode | null;
  /** "Tomorrow at {time} looks better" when nothing today is better than Avoid (spec 8.4 step 6). */
  readonly tomorrowBest: number | null;
  readonly notes: readonly PlanNote[];
}

/** The pieces every planner step shares. */
export interface PlanStep {
  readonly activity: Activity;
  readonly person: Planned;
  readonly env: PlanEnv;
  readonly date: string;
  readonly fromHour: number;
  readonly usualHour: number;
}
