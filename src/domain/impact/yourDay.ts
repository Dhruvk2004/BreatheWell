import type { HourIndex } from "../air/hourly";
import type { PersonPlan } from "../family/people";
import { cigarettesPerDay, type CigaretteFigure } from "./cigarettes";
import { avoidedBySwap } from "./emissions";
import { afterOutings, dayPm25, exposureSchedule, exposureToday, outsideAllDay } from "./exposure";

/**
 * Learn's "Your choices today" for a signed-in adult (spec 10.11 item 1, 7.4): the day outside all
 * day against the day with the plan, both as whole-day cigarette figures, and the CO₂ the plan's
 * switch avoids for the air. Adults only (the caller never passes a dependent); null without a
 * full day of air data.
 */
export interface YourDay {
  readonly outside: CigaretteFigure;
  readonly withPlan: CigaretteFigure;
  /** kg CO₂ avoided today by the plan's mode switch (0 when there is none). */
  readonly co2Kg: number;
}

export function yourDay(row: PersonPlan, index: HourIndex, date: string, purifierRoom: boolean): YourDay | null {
  const pm25 = dayPm25(index, date);
  if (!pm25) return null;
  const { activities, travel } = row.person;
  const plans = row.items.map((i) => i.plan);
  const withPlan = exposureToday(pm25, exposureSchedule(afterOutings(activities, travel.main, plans), { purifierRoom }));
  const co2Kg = plans.reduce((sum, p) => sum + (p.switchTo ? avoidedBySwap(travel.main, p.switchTo, travel.tripLength).co2Kg : 0), 0);
  return { outside: cigarettesPerDay(outsideAllDay(pm25)), withPlan: cigarettesPerDay(withPlan), co2Kg };
}
