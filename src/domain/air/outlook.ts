import { worstBand, type Band } from "./bands";
import { indexHours, type HourPoint } from "./hourly";
import { bestWindow, DAY_FIRST_HOUR, DAY_LAST_HOUR, type HourWindow } from "./windows";
import { addDays, localTime, weekdayOf, type Clock, type Weekday } from "../time/clock";

export interface DayOutlook {
  readonly date: string;
  readonly weekday: Weekday;
  /** Band of the day's worst outdoor hour (06–21). */
  readonly worstBand: Band;
  /** Best 2-hour window (06–21); for today only hours still ahead. Null if none is left. */
  readonly best: HourWindow | null;
}

/** Up to 5 days, from today. */
export const OUTLOOK_DAYS = 5;

/**
 * The "Next 5 days" outlook, computed from the hourly forecast because the air-quality API has
 * no daily variables. One entry per day that has outdoor-hour data, starting today, up to 5 days.
 * Code only; labelled "Forecast; may change" in the UI.
 */
export function outlook(points: readonly HourPoint[], clock: Clock, days = OUTLOOK_DAYS): DayOutlook[] {
  const index = indexHours(points);
  const today = localTime(clock);
  const result: DayOutlook[] = [];
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(today.date, offset);
    const worst = worstBand(
      points.filter((p) => p.date === date && p.hour >= DAY_FIRST_HOUR && p.hour <= DAY_LAST_HOUR).map((p) => p.band),
    );
    if (!worst) continue;
    const fromHour = offset === 0 ? today.hour + 1 : DAY_FIRST_HOUR;
    result.push({ date, weekday: weekdayOf(date), worstBand: worst, best: bestWindow(index, date, fromHour) });
  }
  return result;
}
