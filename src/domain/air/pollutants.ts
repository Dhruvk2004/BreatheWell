import type { HourlyAir } from "./hourly";
import type { HourlyWeather } from "./weatherWhy";
import { weatherWhy, type WeatherWhy } from "./weatherWhy";

/** The six pollutants on the Air now accordion, in display order. */
export const POLLUTANTS = ["pm25", "pm10", "no2", "o3", "co", "so2"] as const;
export type Pollutant = (typeof POLLUTANTS)[number];

/** One pollutant's hourly value with its unit: µg/m³, except CO in mg/m³ (Open-Meteo gives µg/m³). */
export interface PollutantValue {
  readonly pollutant: Pollutant;
  readonly value: number;
  readonly unit: "µg/m³" | "mg/m³";
}

const SERIES: Readonly<Record<Pollutant, keyof HourlyAir>> = { pm25: "pm25", pm10: "pm10", no2: "no2", o3: "o3", co: "co", so2: "so2" };

/** Whole µg/m³, CO to one decimal in mg/m³ ("2.1 mg/m³"). */
const shown = (pollutant: Pollutant, raw: number): PollutantValue =>
  pollutant === "co"
    ? { pollutant, value: Math.round(raw / 100) / 10, unit: "mg/m³" }
    : { pollutant, value: Math.round(raw), unit: "µg/m³" };

/** The pollutant values at one local hour ("2024-11-18T06:00"); missing ones are left out. */
export function pollutantsAt(air: HourlyAir, time: string): PollutantValue[] {
  const i = air.time.indexOf(time);
  if (i < 0) return [];
  return POLLUTANTS.flatMap((p) => {
    const raw = (air[SERIES[p]] as readonly (number | null)[])[i];
    return typeof raw === "number" ? [shown(p, raw)] : [];
  });
}

/** The morning weather behind "Why are mornings worst?". */
export interface MorningWeather {
  readonly windKmh: number;
  readonly tempC: number;
  readonly why: WeatherWhy;
}

/** The hour the explainer reads: 6 am, when smoke sits lowest on a winter morning. */
export const MORNING_HOUR = 6;

/** Wind and temperature at 6 am on a date, rounded as shown ("Wind 0.5 km/h, 12 °C"), or null. */
export function morningWeather(weather: HourlyWeather, date: string): MorningWeather | null {
  const i = weather.time.indexOf(`${date}T0${MORNING_HOUR}:00`);
  const wind = weather.windKmh[i];
  const temp = weather.tempC[i];
  if (i < 0 || typeof wind !== "number" || typeof temp !== "number") return null;
  return { windKmh: Math.round(wind * 10) / 10, tempC: Math.round(temp), why: weatherWhy(wind, temp) };
}
