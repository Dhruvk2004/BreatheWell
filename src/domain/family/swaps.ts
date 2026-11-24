import type { Band } from "../air/bands";
import { pointAt } from "../air/hourly";
import type { AirSummary } from "../air/summary";
import { eligibleAlternatives, type Alternative } from "../libraries/alternatives";
import type { HomeSetup } from "../libraries/homeSetup";
import type { FamilyPerson } from "./people";

/** The band of the day's best window (its first hour), else the band now; null without data. */
export function bestBand(summary: AirSummary): Band | null {
  const best = summary.best ? pointAt(summary.index, summary.date, summary.best.start) : undefined;
  return best?.band ?? summary.now?.band ?? null;
}

/**
 * The swaps code allows one person today: travel swaps from their usual mode to a
 * mode they can use, routine and home actions that fit. Gemini may pick one and word it; without
 * Gemini the first one is the template swap. Empty when nothing fits (a swap is never forced).
 */
export function swapOptions(person: FamilyPerson, summary: AirSummary, home: HomeSetup, severeDay: boolean): Alternative[] {
  const band = bestBand(summary);
  if (!band) return [];
  return eligibleAlternatives({
    main: person.travel.main,
    options: person.travel.others,
    tripLength: person.travel.tripLength,
    activities: person.activities.map((a) => a.type),
    home,
    bestBand: band,
    severeDay,
  });
}
