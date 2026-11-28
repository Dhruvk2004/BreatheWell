import { bandRank, type Band } from "../air/bands";
import { pointAt, type HourIndex } from "../air/hourly";
import { DAY_FIRST_HOUR, DAY_LAST_HOUR } from "../air/windows";

/** The bands of a date's outdoor hours (06–21, from `fromHour` on) that have data. */
function daytimeBands(index: HourIndex, date: string, fromHour = DAY_FIRST_HOUR): Band[] {
  const bands: Band[] = [];
  for (let h = Math.max(DAY_FIRST_HOUR, fromHour); h <= DAY_LAST_HOUR; h++) {
    const point = pointAt(index, date, h);
    if (point) bands.push(point.band);
  }
  return bands;
}

/**
 * A Severe day: the model band reaches Severe in an outdoor hour (06–21)
 * still ahead, i.e. from `fromHour` (the planner's next full hour) on. Then every non-essential
 * outdoor activity is Avoid with an indoor alternative. Hours already past do not count, so once a
 * Severe morning has cleared the plan follows the hourly verdicts again.
 */
export function isSevereDay(index: HourIndex, date: string, fromHour = DAY_FIRST_HOUR): boolean {
  return daytimeBands(index, date, fromHour).includes("severe");
}

/** True when any outdoor hour of the date is at least the given band. */
export function reachesBand(index: HourIndex, date: string, band: Band): boolean {
  return daytimeBands(index, date).some((b) => bandRank(b) >= bandRank(band));
}
