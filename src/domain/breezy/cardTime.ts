import type { HourIndex } from "../air/hourly";
import { DAY_FIRST_HOUR, DAY_LAST_HOUR } from "../air/windows";
import type { Judge } from "../rules/bestHour";
import { bestHour, candidateHours, judgeAt } from "../rules/bestHour";
import { contextOn, type RuleContext } from "../rules/context";
import type { Group } from "../rules/groups";
import type { Mode } from "../rules/modes";
import { isSevereDay } from "../rules/severeDay";
import type { Verdict } from "../rules/verdict";
import { breezyIntensity, breezySpan, type BreezyActivity } from "./activity";

/**
 * The rules re-run for a time Breezy proposes: the card's verdict chip comes from here,
 * never from Gemini. A card for an Avoid hour is moved to the best non-Avoid hour of that day, or
 * dropped when there is none; a past hour or one outside 06:00–21:00 is treated the same way. On a
 * Severe day every non-essential card is dropped, as the plan keeps everyone indoors.
 */
export interface CardTimeInput {
  readonly index: HourIndex;
  readonly group: Group;
  readonly ctx: RuleContext;
  readonly activity: BreezyActivity;
  readonly mode: Mode;
  /** The card's date, "YYYY-MM-DD". */
  readonly date: string;
  readonly hour: number;
  /** The first hour that may still be suggested on that date (the next full hour today, 0 tomorrow). */
  readonly fromHour: number;
}

export type CardTime =
  | { readonly kind: "keep"; readonly hour: number; readonly verdict: Verdict }
  | { readonly kind: "moved"; readonly hour: number; readonly verdict: Verdict }
  | { readonly kind: "drop" };

function judgeOf(input: CardTimeInput): Judge {
  return {
    index: input.index,
    group: input.group,
    ctx: contextOn(input.ctx, input.date),
    intensity: breezyIntensity(input.activity, input.mode),
    span: breezySpan(input.activity),
  };
}

/** True when the hour may be planned at all: inside the day and not in the past. */
const plannable = (hour: number, fromHour: number): boolean => hour >= DAY_FIRST_HOUR && hour <= DAY_LAST_HOUR && hour >= fromHour;

/**
 * A Severe hour still ahead that day makes every non-essential outing Avoid (spec 8.3 override 2),
 * as in the plan; only `travel` (a trip that has to happen) is judged hour by hour.
 */
const severeDay = (input: CardTimeInput): boolean => input.activity !== "travel" && isSevereDay(input.index, input.date, input.fromHour);

/** The best non-Avoid start hour for the activity on that date (nearest to `hour` on ties), or null. */
export function bestCardTime(input: CardTimeInput): { hour: number; verdict: Verdict } | null {
  if (severeDay(input)) return null;
  const best = bestHour(judgeOf(input), input.date, candidateHours("any", input.hour, input.fromHour), input.hour);
  return best && best.verdict !== "avoid" ? { hour: best.hour, verdict: best.verdict } : null;
}

/** Keeps, moves or drops a proposed time. Pure. */
export function checkCardTime(input: CardTimeInput): CardTime {
  if (severeDay(input)) return { kind: "drop" };
  const asked = plannable(input.hour, input.fromHour) ? judgeAt(judgeOf(input), input.date, input.hour) : null;
  if (asked && asked.verdict !== "avoid") return { kind: "keep", hour: asked.hour, verdict: asked.verdict };
  const best = bestCardTime(input);
  return best ? { kind: "moved", ...best } : { kind: "drop" };
}
