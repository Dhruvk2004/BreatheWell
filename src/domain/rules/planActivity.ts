import { DAY_LAST_HOUR } from "../air/windows";
import { addDays, localTime, parseHhMm } from "../time";
import { isEssential, type Activity } from "./activities";
import { bestHour, candidateHours, judgeAt, worthMoving, type HourJudgement } from "./bestHour";
import { contextOn, winterCautionApplies } from "./context";
import { planEssentialTrip } from "./essentialTrip";
import { judgeFor } from "./judge";
import type { ActivityPlan, PlanEnv, Planned, PlanNote, PlanStep, Suggestion } from "./plan";
import { isSevereDay, reachesBand } from "./severeDay";

/** Tomorrow's best non-Avoid start hour for the activity, or null. */
export function tomorrowBest(step: PlanStep): number | null {
  const tomorrow = addDays(step.date, 1);
  if (isSevereDay(step.env.index, tomorrow)) return null;
  const env = { ...step.env, ctx: contextOn(step.env.ctx, tomorrow) };
  const best = bestHour(judgeFor({ ...step, env }), tomorrow, candidateHours("any", step.usualHour, 0), step.usualHour);
  return best && best.verdict !== "avoid" ? best.hour : null;
}

function notesFor(step: PlanStep): PlanNote[] {
  const notes: PlanNote[] = [];
  const { group } = step.person;
  const caution = winterCautionApplies(group, step.env.ctx);
  if (caution) notes.push("winter_caution");
  if (group === "extra" && reachesBand(step.env.index, step.date, caution ? "moderate" : "poor")) notes.push("keep_inhaler");
  return notes;
}

type Outcome = Pick<ActivityPlan, "suggestion" | "bestTime" | "verdictAtBest" | "switchTo" | "tomorrowBest"> & { extraNotes?: PlanNote[] };

const outcome = (suggestion: Suggestion, rest: Partial<Outcome> = {}): Outcome => ({
  suggestion,
  bestTime: null,
  verdictAtBest: null,
  switchTo: null,
  tomorrowBest: null,
  ...rest,
});

/** Walks, play, sport and errands: move to a better hour, stay in, or go with care. */
function planFlexible(step: PlanStep, atUsual: HourJudgement): Outcome {
  if (isSevereDay(step.env.index, step.date, step.fromHour))
    return outcome("indoor", { tomorrowBest: tomorrowBest(step), extraNotes: ["severe_day"] });
  const hours = candidateHours(step.activity.flex, step.usualHour, step.fromHour);
  const best = step.activity.flex === "fixed" ? null : bestHour(judgeFor(step), step.date, hours, step.usualHour);
  if (best && worthMoving(best, atUsual)) return outcome("move_time", { bestTime: best.hour, verdictAtBest: best.verdict });
  if (atUsual.verdict === "avoid") return outcome("indoor", { tomorrowBest: tomorrowBest(step) });
  return outcome(atUsual.verdict === "care" ? "protect" : "as_planned");
}

/** Today, or tomorrow once it is past 21:00; candidates start at the next full hour. */
function planDay(env: PlanEnv): { date: string; fromHour: number } {
  const local = localTime(env.clock);
  return local.hour >= DAY_LAST_HOUR ? { date: addDays(local.date, 1), fromHour: 0 } : { date: local.date, fromHour: local.hour + 1 };
}

/**
 * The rule result for one activity: the verdict at the usual time and what to change.
 * Pure; `env.clock` is the injected clock (the real time live, `scenarioNow` in recorded demos).
 * The winter caution is judged on the planned date (tomorrow after 21:00), not the clock's date.
 * Null when there is no air data for the usual hour (no verdict).
 */
export function planActivity(person: Planned, activity: Activity, env: PlanEnv): ActivityPlan | null {
  const { date, fromHour } = planDay(env);
  const usualHour = parseHhMm(activity.usual).hour;
  const step: PlanStep = { activity, person, env: { ...env, ctx: contextOn(env.ctx, date) }, date, fromHour, usualHour };
  const judged = judgeAt(judgeFor(step), date, usualHour);
  if (!judged) return null;
  const essential = isEssential(activity.type);
  const severeNonEssential = !essential && isSevereDay(env.index, date, fromHour);
  const atUsual = severeNonEssential ? { ...judged, verdict: "avoid" as const } : judged;
  const result = essential ? planEssentialTrip(step, atUsual) : planFlexible(step, atUsual);
  const { extraNotes = [], ...rest } = result;
  return { activityId: activity.id, date, usualHour, verdictAtUsual: atUsual.verdict, ...rest, notes: [...notesFor(step), ...extraNotes] };
}
