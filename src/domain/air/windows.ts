import { bandOfAqi } from "./bands";
import { pointAt, type HourIndex } from "./hourly";

/** Whole-hour window, `end` exclusive: { start: 14, end: 16 } is "2–4 pm". */
export interface HourWindow {
  readonly start: number;
  readonly end: number;
}

/** Outdoor hours the plan uses: starts from 06:00 to 21:00 (spec 8.4 step 2). */
export const DAY_FIRST_HOUR = 6;
export const DAY_LAST_HOUR = 21;

interface Block {
  readonly start: number;
  readonly worst: number;
  readonly sum: number;
}

/** Every 2-hour block inside 06–21 that starts at or after `fromHour` and has data for both hours. */
function blocks(index: HourIndex, date: string, fromHour: number): Block[] {
  const result: Block[] = [];
  for (let start = Math.max(DAY_FIRST_HOUR, fromHour); start + 1 <= DAY_LAST_HOUR; start++) {
    const a = pointAt(index, date, start);
    const b = pointAt(index, date, start + 1);
    if (a && b) result.push({ start, worst: Math.max(a.aqi, b.aqi), sum: a.aqi + b.aqi });
  }
  return result;
}

/**
 * Family best window (spec 8.4 step 7): the 2-hour block in 06–21 with the lowest worst-hour AQI
 * (ties: lower total, then earlier). `fromHour` drops past hours. Null when no block has data.
 */
export function bestWindow(index: HourIndex, date: string, fromHour = DAY_FIRST_HOUR): HourWindow | null {
  const sorted = blocks(index, date, fromHour).sort((x, y) => x.worst - y.worst || x.sum - y.sum || x.start - y.start);
  return sorted.length ? { start: sorted[0].start, end: sorted[0].start + 2 } : null;
}

/** The worst window grows over neighbouring hours in the same band, up to 3 hours ("Worst: 6–9 am"). */
const MAX_WORST_HOURS = 3;

/**
 * Worst window (spec 8.4 step 7): the 2-hour block with the highest worst-hour AQI, extended to an
 * adjacent hour (later first) while that hour is in the same band, up to 3 hours. `fromHour` drops
 * past hours, so a 4 pm view says "Worst: 7–9 pm" rather than a morning already gone.
 */
export function worstWindow(index: HourIndex, date: string, fromHour = DAY_FIRST_HOUR): HourWindow | null {
  const first = Math.max(DAY_FIRST_HOUR, fromHour);
  const sorted = blocks(index, date, first).sort((x, y) => y.worst - x.worst || y.sum - x.sum || x.start - y.start);
  if (!sorted.length) return null;
  const band = bandOfAqi(sorted[0].worst);
  const sameBand = (hour: number) => {
    const p = hour >= first && hour <= DAY_LAST_HOUR ? pointAt(index, date, hour) : undefined;
    return p !== undefined && p.band === band;
  };
  let { start } = sorted[0];
  let end = start + 2;
  if (end - start < MAX_WORST_HOURS && sameBand(end)) end += 1;
  else if (end - start < MAX_WORST_HOURS && sameBand(start - 1)) start -= 1;
  return { start, end };
}
