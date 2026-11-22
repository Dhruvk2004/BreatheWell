import { aqiFromPm, type PmPollutant } from "./aqi";
import type { Band } from "./bands";
import { addDays, localTime, type Clock } from "../time/clock";

/** Hourly PM series in the place's local time ("2024-11-18T06:00"), as Open-Meteo returns it. */
export interface HourlyPm {
  readonly time: readonly string[];
  readonly pm25: readonly (number | null)[];
  readonly pm10: readonly (number | null)[];
}

/** Every pollutant the air card shows (spec F2): µg/m³, CO included (shown in mg/m³ by the UI). */
export interface HourlyAir extends HourlyPm {
  readonly no2: readonly (number | null)[];
  readonly o3: readonly (number | null)[];
  readonly co: readonly (number | null)[];
  readonly so2: readonly (number | null)[];
}

/** One hour with an AQI estimate. Hours with no PM data are left out. */
export interface HourPoint {
  readonly time: string;
  readonly date: string;
  readonly hour: number;
  readonly aqi: number;
  readonly band: Band;
  readonly main: PmPollutant;
  readonly pm25: number | null;
  readonly pm10: number | null;
}

/** Hourly AQI estimates from the hourly PM series (spec 8.4 step 1). */
export function hourPoints(series: HourlyPm): HourPoint[] {
  return series.time.flatMap((time, i) => {
    const pm25 = series.pm25[i] ?? null;
    const pm10 = series.pm10[i] ?? null;
    const result = aqiFromPm({ pm25, pm10 });
    if (!result) return [];
    const point: HourPoint = { time, date: time.slice(0, 10), hour: Number(time.slice(11, 13)), pm25, pm10, ...result };
    return [point];
  });
}

/** Fast lookup of a point by date and hour. */
export type HourIndex = ReadonlyMap<string, HourPoint>;

const key = (date: string, hour: number) => `${date}T${String(hour).padStart(2, "0")}`;

/** Indexes points by date and hour. */
export function indexHours(points: readonly HourPoint[]): HourIndex {
  return new Map(points.map((p) => [key(p.date, p.hour), p]));
}

/** The point for a date and hour, if there is data. */
export const pointAt = (index: HourIndex, date: string, hour: number): HourPoint | undefined => index.get(key(date, hour));

/** "Now" = the hourly estimate for the clock's current local hour (spec 8.1). */
export function nowPoint(index: HourIndex, clock: Clock): HourPoint | undefined {
  const local = localTime(clock);
  return pointAt(index, local.date, local.hour);
}

/** At least 16 of 24 hours, as CPCB requires for a 24-hour average. */
const MIN_HOURS_24 = 16;

/**
 * The 24-hour CPCB-style AQI: the mean PM2.5 and PM10 over the 24 hours ending at the clock's hour,
 * then the AQI of those means (spec 8.1 "24-hour average"). Null with fewer than 16 hours of data.
 */
export function average24Aqi(series: HourlyPm, clock: Clock): number | null {
  const local = localTime(clock);
  const end = key(local.date, local.hour);
  const start = key(addDays(local.date, -1), local.hour);
  const rows = series.time.map((t, i) => ({ k: t.slice(0, 13), pm25: series.pm25[i], pm10: series.pm10[i] }));
  const window = rows.filter((r) => r.k > start && r.k <= end);
  const mean = (values: (number | null | undefined)[]) => {
    const present = values.filter((v): v is number => typeof v === "number");
    return present.length >= MIN_HOURS_24 ? present.reduce((a, b) => a + b, 0) / present.length : null;
  };
  return aqiFromPm({ pm25: mean(window.map((r) => r.pm25)), pm10: mean(window.map((r) => r.pm10)) })?.aqi ?? null;
}

/** Hours that hold at least `minFuture` hours after the clock's hour (spec 5.11 "forecast too short"). */
export function hasEnoughForecast(points: readonly HourPoint[], clock: Clock, minFuture = 6): boolean {
  const local = localTime(clock);
  const now = key(local.date, local.hour);
  return points.filter((p) => key(p.date, p.hour) > now).length >= minFuture;
}
