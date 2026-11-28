import type { Band } from "../air/bands";
import { freshness, type Freshness } from "../air/freshness";
import type { HourlyAir, HourPoint } from "../air/hourly";
import { morningWeather, pollutantsAt, type MorningWeather, type PollutantValue } from "../air/pollutants";
import { airSummary, type AirSummary } from "../air/summary";
import type { HourlyWeather } from "../air/weatherWhy";
import type { City } from "../geo/cities";
import { cigarettesPerDay, type CigaretteFigure } from "../impact/cigarettes";
import { airNowSwap } from "../impact/emissions";
import { dayPm25, outsideAllDay } from "../impact/exposure";
import { bandTips, type TipId } from "../libraries/tips";
import { airOutHour } from "../rules/airing";
import { ruleContext, type Region } from "../rules/context";
import type { Mode } from "../rules/modes";
import { whoShouldTakeCare, type CareRow } from "../rules/publicAdvice";
import type { Clock } from "../time/clock";

/** Everything Air now needs, from the place's hourly data and the injected clock. */
export interface AirNowInput {
  readonly air: HourlyAir;
  readonly weather: HourlyWeather;
  readonly fetchedAt: Date;
  readonly clock: Clock;
  readonly region: Region;
  /** The listed city at the place, or null. */
  readonly city: City | null;
}

/** The band card's reading: the hourly estimate "now". */
export interface Reading {
  /** The local hour of the reading, "2024-11-18T06:00". */
  readonly time: string;
  readonly aqi: number;
  readonly band: Band;
  readonly main: HourPoint["main"];
}

/** Air now's content. Without fresh-enough data there is no reading and no advice. */
export interface AirNowModel {
  readonly freshness: Freshness;
  readonly summary: AirSummary;
  readonly reading: Reading | null;
  readonly care: readonly CareRow[];
  readonly tips: readonly TipId[];
  readonly airOutAt: number | null;
  readonly swap: { readonly mode: Mode; readonly co2Kg: number };
  readonly morning: MorningWeather | null;
  readonly pollutants: readonly PollutantValue[];
  /** Outside all day today, for the collapsed "For adults: the numbers" panel only. */
  readonly cigarettes: CigaretteFigure | null;
  /** Delhi NCR: "Official stations may read higher". */
  readonly stationNote: boolean;
  readonly outsideIndia: boolean;
}

function readingOf(summary: AirSummary, state: Freshness): Reading | null {
  if (state === "stale" || !summary.now) return null;
  return { time: summary.now.time, aqi: summary.now.aqi, band: summary.now.band, main: summary.now.main };
}

function dayCigarettes(summary: AirSummary): CigaretteFigure | null {
  const pm25 = dayPm25(summary.index, summary.date);
  return pm25 ? cigarettesPerDay(outsideAllDay(pm25)) : null;
}

/**
 * Builds Air now from code only (rules and checked libraries; no Gemini on public pages).
 * Pure: the clock is injected, so the same function serves live pages and tests.
 */
export function airNow(input: AirNowInput): AirNowModel {
  const summary = airSummary(input.air, input.clock);
  const state = freshness(input.fetchedAt, input.clock);
  const reading = readingOf(summary, state);
  const ctx = ruleContext(input.clock, input.region, false);
  const airOutAt = reading ? airOutHour(summary.index, summary.date, summary.best?.start ?? null) : null;
  const swap = airNowSwap(input.city?.metro ?? false);
  return {
    freshness: state,
    summary,
    reading,
    care: reading ? whoShouldTakeCare(reading.band, ctx) : [],
    tips: reading ? bandTips(reading.band, airOutAt) : [],
    airOutAt,
    swap: { mode: swap.swap, co2Kg: swap.avoided.co2Kg },
    morning: morningWeather(input.weather, summary.date),
    pollutants: reading ? pollutantsAt(input.air, reading.time) : [],
    cigarettes: reading ? dayCigarettes(summary) : null,
    stationNote: input.region !== "outside_india" && (input.city?.ncr ?? false),
    outsideIndia: input.region === "outside_india",
  };
}
