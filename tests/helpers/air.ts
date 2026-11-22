import type { Band } from "@/domain/air/bands";
import { hourPoints, indexHours, type HourIndex, type HourlyAir, type HourlyPm } from "@/domain/air/hourly";
import type { HourlyWeather } from "@/domain/air/weatherWhy";
import { ruleContext, type Region } from "@/domain/rules/context";
import type { PlanEnv } from "@/domain/rules/plan";
import type { Clock } from "@/domain/time/clock";

/** An IST clock at a local date-time, e.g. istClock("2024-11-18T06:10"). */
export const istClock = (local: string): Clock => ({ now: new Date(`${local}:00+05:30`), timeZone: "Asia/Kolkata" });

/** A PM2.5 value well inside each band (PM10 left out, so PM2.5 sets the AQI). */
export const PM25_IN: Readonly<Record<Band, number>> = { good: 15, satisfactory: 45, moderate: 75, poor: 105, very_poor: 200, severe: 300 };

/** 24 hourly PM2.5 values for one date (missing hours as null). */
export function daySeries(date: string, pm25: readonly (number | null)[]): HourlyPm {
  const time = pm25.map((_, h) => `${date}T${String(h).padStart(2, "0")}:00`);
  return { time, pm25, pm10: pm25.map(() => null) };
}

/** Joins several day series. */
export const joinSeries = (...days: HourlyPm[]): HourlyPm => ({
  time: days.flatMap((d) => d.time),
  pm25: days.flatMap((d) => d.pm25),
  pm10: days.flatMap((d) => d.pm10),
});

/** A whole day in one band, with exceptions per hour. */
export function bandDay(date: string, band: Band, overrides: Readonly<Record<number, Band>> = {}): HourlyPm {
  return daySeries(
    date,
    Array.from({ length: 24 }, (_, h) => PM25_IN[overrides[h] ?? band]),
  );
}

export const indexOf = (series: HourlyPm): HourIndex => indexHours(hourPoints(series));

/** A plan environment over a series at a local time and region. */
export function envFor(series: HourlyPm, local: string, region: Region = "india", hasStation = false): PlanEnv {
  const clock = istClock(local);
  return { index: indexOf(series), clock, ctx: ruleContext(clock, region, hasStation) };
}

/** A full HourlyAir (the other pollutants filled with fixed values) from a PM series. */
export const airOf = (series: HourlyPm): HourlyAir => ({
  ...series,
  no2: series.time.map(() => 40),
  o3: series.time.map(() => 12),
  co: series.time.map(() => 2100),
  so2: series.time.map(() => null),
});

/** Hourly weather on the same time axis: calm and cold by default. */
export const weatherOf = (series: HourlyPm, windKmh = 1, tempC = 12): HourlyWeather => ({
  time: series.time,
  windKmh: series.time.map(() => windKmh),
  tempC: series.time.map(() => tempC),
  humidity: series.time.map(() => 80),
});
