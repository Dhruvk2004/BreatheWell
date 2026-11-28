import { freshness, verdictsAllowed, type Freshness } from "../air/freshness";
import type { HourlyPm } from "../air/hourly";
import { airSummary, type AirSummary } from "../air/summary";
import { weeklyTotals, type SwapTick } from "../impact/emissions";
import type { HomeSetup } from "../libraries/homeSetup";
import { homeTips, type TipId } from "../libraries/tips";
import { airOutHour } from "../rules/airing";
import { isWinter, ruleContext, type Region } from "../rules/context";
import { isSevereDay } from "../rules/severeDay";
import type { Clock } from "../time/clock";
import { orderRows, planPerson, type FamilyPerson, type PersonPlan } from "./people";

/** A family's day as Today and the Demo show it, from code only. */
export interface FamilyDayInput {
  readonly air: HourlyPm;
  readonly fetchedAt: Date;
  readonly clock: Clock;
  readonly region: Region;
  readonly people: readonly FamilyPerson[];
  /** The viewer's row comes first. */
  readonly viewerId: string | null;
  readonly home: HomeSetup;
  readonly ticks: readonly SwapTick[];
}

/** The "Help the air" action: no burning in the smog months, no idling otherwise. */
export type TogetherAction = "no_leaf_burning" | "no_idling_signals";

export interface FamilyDay {
  readonly freshness: Freshness;
  readonly summary: AirSummary;
  /** Rows in display order; empty without fresh-enough data (no chips without air). */
  readonly rows: readonly PersonPlan[];
  /** The three "At home today" tips for this home and band. */
  readonly homeTips: readonly TipId[];
  readonly airOutAt: number | null;
  /** A Severe hour is still ahead today: the GRAP note and indoor-first plans. */
  readonly severeDay: boolean;
  readonly together: TogetherAction;
  readonly week: { readonly co2Kg: number; readonly carTrips: number };
}

const HOME_TIP_COUNT = 3;

/**
 * Plans the whole family against one hourly series and the injected clock (the scenario clock in
 * the demo). Pure: the rules decide every chip and time; templates and Gemini only add words.
 */
export function familyDay(input: FamilyDayInput): FamilyDay {
  const summary = airSummary(input.air, input.clock);
  const state = freshness(input.fetchedAt, input.clock);
  const env = { index: summary.index, clock: input.clock, ctx: ruleContext(input.clock, input.region, false) };
  const now = verdictsAllowed(state) ? summary.now : null;
  const airOutAt = now ? airOutHour(summary.index, summary.date, summary.best?.start ?? null) : null;
  const month = Number(summary.date.slice(5, 7));
  return {
    freshness: state,
    summary,
    rows: now
      ? orderRows(
          input.people.map((p) => planPerson(p, env)),
          input.viewerId,
        )
      : [],
    homeTips: now ? homeTips(input.home, now.band, airOutAt).slice(0, HOME_TIP_COUNT) : [],
    airOutAt,
    // Same "still ahead" rule as the planner's severe-day note (from the next full hour).
    severeDay: now !== null && isSevereDay(summary.index, summary.date, summary.hour + 1),
    together: isWinter(month) ? "no_leaf_burning" : "no_idling_signals",
    week: weeklyTotals(input.ticks),
  };
}
