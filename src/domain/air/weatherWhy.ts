/** Hourly weather in local time: wind (km/h), temperature (°C), humidity (%). */
export interface HourlyWeather {
  readonly time: readonly string[];
  readonly windKmh: readonly (number | null)[];
  readonly tempC: readonly (number | null)[];
  readonly humidity: readonly (number | null)[];
}

/** Why mornings are worst (spec 5.1, 10.2 item 6): calm, cold air traps smoke near the ground. */
export type WeatherWhy = "calm_cold_morning" | "calm_morning" | "windy" | "mild";

/** Wind below this (km/h) counts as calm. */
export const CALM_WIND_KMH = 5;
/** Temperature below this (°C) counts as cold. */
export const COLD_TEMP_C = 15;
/** Wind above this (km/h) disperses smoke. */
export const WINDY_KMH = 15;

/** The weather reason code from the morning's wind and temperature (prompt input `weatherWhy`). */
export function weatherWhy(windKmh: number, tempC: number): WeatherWhy {
  if (windKmh < CALM_WIND_KMH) return tempC < COLD_TEMP_C ? "calm_cold_morning" : "calm_morning";
  if (windKmh > WINDY_KMH) return "windy";
  return "mild";
}
