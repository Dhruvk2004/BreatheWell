import { vi } from "vitest";
import { TtlCache } from "@/server/cache";
import type { AirDeps } from "@/server/air/service";
import type { AirSnapshot } from "@/server/air/snapshot";
import { airOf, bandDay, joinSeries, weatherOf } from "./air";

/** Delhi grid cell, a Poor day then a Very poor day, fetched just after midnight IST on 18 Nov 2024. */
export const series = joinSeries(bandDay("2024-11-17", "poor"), bandDay("2024-11-18", "very_poor"));
export const NOW = new Date("2024-11-18T00:40:00Z");

export const snapshot = (over: Partial<AirSnapshot> = {}): AirSnapshot => ({
  gridId: "28.6_77.2",
  lat: 28.6,
  lon: 77.2,
  timeZone: "Asia/Kolkata",
  fetchedAt: NOW,
  source: "open-meteo",
  air: airOf(series),
  weather: weatherOf(series),
  ...over,
});

export function deps(over: Partial<AirDeps> = {}): AirDeps {
  return {
    fetchAir: vi.fn(async () => ({ ok: true as const, value: { air: airOf(series), timeZone: "Asia/Kolkata" } })),
    fetchWeather: vi.fn(async () => ({ ok: true as const, value: weatherOf(series) })),
    store: null,
    memory: new TtlCache<AirSnapshot>(10, 3_600_000),
    lastGood: new TtlCache<AirSnapshot>(10, 12 * 3_600_000),
    now: () => NOW,
    ...over,
  };
}
