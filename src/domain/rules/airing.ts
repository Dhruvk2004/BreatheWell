import { bandRank, worstBand, type Band } from "../air/bands";
import { pointAt, type HourIndex } from "../air/hourly";

/** The morning hours compared against the best hour. */
const MORNING_HOURS = [6, 7, 8, 9];

/** The worst band of a date's morning (06–09), or null without data. */
function morningBand(index: HourIndex, date: string): Band | null {
  return worstBand(MORNING_HOURS.map((h) => pointAt(index, date, h)?.band).filter((b): b is Band => b !== undefined));
}

/**
 * "Open windows for 15 minutes at {best hour}" only if the best hour's band is at least one band
 * better than the morning's; otherwise null, and the tip is "keep windows shut today".
 */
export function airOutHour(index: HourIndex, date: string, bestHour: number | null): number | null {
  if (bestHour === null) return null;
  const best = pointAt(index, date, bestHour);
  const morning = morningBand(index, date);
  if (!best || !morning) return null;
  return bandRank(morning) - bandRank(best.band) >= 1 ? bestHour : null;
}
