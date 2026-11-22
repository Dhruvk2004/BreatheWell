import { judgeAt, type HourJudgement } from "./bestHour";
import { safestSwitch, type Mode } from "./modes";
import type { PlanNote, PlanStep, Suggestion } from "./plan";
import { judgeFor } from "./judge";
import { isSevereDay } from "./severeDay";
import type { Verdict } from "./verdict";

interface TripOutcome {
  readonly suggestion: Suggestion;
  readonly bestTime: null;
  readonly verdictAtBest: Verdict | null;
  readonly switchTo: Mode | null;
  readonly tomorrowBest: null;
  readonly extraNotes: PlanNote[];
}

const trip = (suggestion: Suggestion, verdictAtBest: Verdict | null, switchTo: Mode | null, extraNotes: PlanNote[] = []): TripOutcome => ({
  suggestion,
  bestTime: null,
  verdictAtBest,
  switchTo,
  tomorrowBest: null,
  extraNotes,
});

/**
 * School, college and office trips (spec 8.3 override 1): never "skip it". On Avoid, switch to the
 * safest mode the person can use (shared enclosed modes first) and re-judge it; if that is still
 * Avoid, or there is no safer mode, present it as Care with the protect tips. A child is never
 * told to skip school; on a Severe day the note says schools may close. A switch to the own car
 * always carries the "carpool / no idling" note.
 */
export function planEssentialTrip(step: PlanStep, atUsual: HourJudgement): TripOutcome {
  if (atUsual.verdict === "go") return trip("as_planned", null, null);
  if (atUsual.verdict === "care") return trip("protect", null, null);
  const severe: PlanNote[] = isSevereDay(step.env.index, step.date, step.fromHour) ? ["schools_may_close"] : [];
  const switchTo = safestSwitch(step.person.travel.main, step.person.travel.others);
  if (!switchTo) return trip("protect", "care", null, ["essential_protect", ...severe]);
  const after = judgeAt(judgeFor(step, switchTo), step.date, step.usualHour);
  const stillAvoid = !after || after.verdict === "avoid";
  const car: PlanNote[] = switchTo === "car" ? ["car_carpool_no_idling"] : [];
  return trip("switch_mode", stillAvoid ? "care" : after.verdict, switchTo, [
    ...(stillAvoid ? ["essential_protect" as const] : []),
    ...car,
    ...severe,
  ]);
}
