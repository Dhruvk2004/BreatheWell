import type { Band } from "@/domain/air/bands";
import type { HourPoint } from "@/domain/air/hourly";

/** A stretch of consecutive hours in one band, `end` exclusive. */
export interface BandRun {
  readonly band: Band;
  readonly start: number;
  readonly end: number;
}

/** Today's hours grouped into runs of the same band, for the strip's one-sentence label. Gaps end a run. */
export function bandRuns(today: readonly (HourPoint | null)[]): BandRun[] {
  const runs: BandRun[] = [];
  today.forEach((point, hour) => {
    if (!point) return;
    const last = runs.at(-1);
    if (last && last.band === point.band && last.end === hour) runs[runs.length - 1] = { ...last, end: hour + 1 };
    else runs.push({ band: point.band, start: hour, end: hour + 1 });
  });
  return runs;
}

/** The bands that appear today, in scale order, for the legend. */
export function bandsPresent(today: readonly (HourPoint | null)[], order: readonly Band[]): Band[] {
  const seen = new Set(today.flatMap((p) => (p ? [p.band] : [])));
  return order.filter((band) => seen.has(band));
}
