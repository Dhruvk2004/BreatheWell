import { addDays, localTime, type Clock } from "../time/clock";
import {
  average24Aqi,
  hasEnoughForecast,
  hourPoints,
  indexHours,
  nowPoint,
  pointAt,
  type HourIndex,
  type HourlyPm,
  type HourPoint,
} from "./hourly";
import { outlook, type DayOutlook } from "./outlook";
import { bestWindow, DAY_FIRST_HOUR, DAY_LAST_HOUR, worstWindow, type HourWindow } from "./windows";

/** Which day the best and worst windows describe, as the band card says it (design 10.2, 10.3). */
export type WindowDay = "today" | "rest_of_today" | "tomorrow";

/** The family-level reading of a place's hourly air at the clock's time (spec 8.1, 8.4). */
export interface AirSummary {
  readonly index: HourIndex;
  /** The clock's local date. */
  readonly date: string;
  readonly hour: number;
  /** The hourly estimate for the current hour, or null without data. */
  readonly now: HourPoint | null;
  /** The 24-hour CPCB-style AQI (shown smaller, labelled "24-h average"). */
  readonly avg24: number | null;
  /** False with fewer than 6 future hours: "Best time: not available today" (spec 5.11). */
  readonly enoughForecast: boolean;
  readonly windowDay: WindowDay;
  readonly best: HourWindow | null;
  readonly worst: HourWindow | null;
  /** Today's 24 hours (missing hours as null), for the hour strip and its table. */
  readonly today: readonly (HourPoint | null)[];
  readonly outlook: readonly DayOutlook[];
}

/** Today from the current hour (the whole day at 6 am), or tomorrow once it is past 21:00 (spec 8.4 step 9). */
function windowDay(date: string, hour: number): { day: WindowDay; date: string; fromHour: number } {
  if (hour >= DAY_LAST_HOUR) return { day: "tomorrow", date: addDays(date, 1), fromHour: DAY_FIRST_HOUR };
  return { day: hour <= DAY_FIRST_HOUR ? "today" : "rest_of_today", date, fromHour: hour };
}

/**
 * Builds the summary every public screen starts from: now, the 24-hour average, the best and worst
 * windows still ahead, today's 24 hours and the 5-day outlook. Pure; the clock is injected.
 */
export function airSummary(series: HourlyPm, clock: Clock): AirSummary {
  const points = hourPoints(series);
  const index = indexHours(points);
  const local = localTime(clock);
  const enoughForecast = hasEnoughForecast(points, clock);
  const span = windowDay(local.date, local.hour);
  return {
    index,
    date: local.date,
    hour: local.hour,
    now: nowPoint(index, clock) ?? null,
    avg24: average24Aqi(series, clock),
    enoughForecast,
    windowDay: span.day,
    best: enoughForecast ? bestWindow(index, span.date, span.fromHour) : null,
    worst: enoughForecast ? worstWindow(index, span.date, span.fromHour) : null,
    today: Array.from({ length: 24 }, (_, h) => pointAt(index, local.date, h) ?? null),
    outlook: outlook(points, clock),
  };
}
