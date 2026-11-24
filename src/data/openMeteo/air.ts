import { round2 } from "@/domain/geo/grid";
import type { HourlyAir } from "@/domain/air/hourly";
import type { HourlyWeather } from "@/domain/air/weatherWhy";
import { fetchJson, query, type DataResult, type FetchOptions } from "../http";
import { airQualityResponse, weatherResponse, type AirQualityResponse, type WeatherResponse } from "./schemas";

const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_VARS = "pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,sulphur_dioxide";
const WEATHER_VARS = "temperature_2m,relative_humidity_2m,wind_speed_10m";

export interface Coordinates {
  readonly lat: number;
  readonly lon: number;
}

/**
 * Hourly window for every live call: yesterday (for the 24-hour average) plus 5 forecast days
 * (the India horizon was checked on 21 Nov, build log). Local time via `timezone=auto`.
 */
const LIVE_WINDOW = { timezone: "auto", past_days: 1, forecast_days: 5 } as const;

/** Rounded coordinates only ever leave the server. */
const place = ({ lat, lon }: Coordinates) => {
  const { lat2, lon2 } = round2(lat, lon);
  return { latitude: lat2, longitude: lon2 };
};

/** `base` replaces both Open-Meteo hosts with one local stand-in (end-to-end tests only, see `openMeteoTestBase`). */
export interface OpenMeteoOptions extends FetchOptions {
  readonly base?: string | null;
}

const endpoint = (url: string, base: string | null | undefined) => (base ? `${base}${new URL(url).pathname}` : url);

export const airQualityUrl = (at: Coordinates, base?: string | null): string =>
  `${endpoint(AIR_URL, base)}?${query({ ...place(at), hourly: AIR_VARS, ...LIVE_WINDOW })}`;
export const weatherUrl = (at: Coordinates, base?: string | null): string =>
  `${endpoint(FORECAST_URL, base)}?${query({ ...place(at), hourly: WEATHER_VARS, wind_speed_unit: "kmh", ...LIVE_WINDOW })}`;

/** Maps the API's names onto the domain's hourly air series. */
export function toHourlyAir(response: AirQualityResponse): HourlyAir {
  const h = response.hourly;
  return { time: h.time, pm25: h.pm2_5, pm10: h.pm10, no2: h.nitrogen_dioxide, o3: h.ozone, co: h.carbon_monoxide, so2: h.sulphur_dioxide };
}

/** Maps the API's names onto the domain's hourly weather series. */
export function toHourlyWeather(response: WeatherResponse): HourlyWeather {
  const h = response.hourly;
  return { time: h.time, windKmh: h.wind_speed_10m, tempC: h.temperature_2m, humidity: h.relative_humidity_2m };
}

/** Hourly air with the place's IANA time zone (Open-Meteo `timezone=auto`), which the clock needs. */
export interface LiveAir {
  readonly air: HourlyAir;
  readonly timeZone: string;
}

/** Live hourly air for a place, cached by Next.js for an hour. */
export async function fetchAirQuality(at: Coordinates, options: OpenMeteoOptions = {}): Promise<DataResult<LiveAir>> {
  const result = await fetchJson(airQualityUrl(at, options.base), airQualityResponse, { next: { revalidate: 3600 }, ...options });
  return result.ok ? { ok: true, value: { air: toHourlyAir(result.value), timeZone: result.value.timezone } } : result;
}

/** Live hourly weather for a place, cached by Next.js for an hour. */
export async function fetchWeather(at: Coordinates, options: OpenMeteoOptions = {}): Promise<DataResult<HourlyWeather>> {
  const result = await fetchJson(weatherUrl(at, options.base), weatherResponse, { next: { revalidate: 3600 }, ...options });
  return result.ok ? { ok: true, value: toHourlyWeather(result.value) } : result;
}
