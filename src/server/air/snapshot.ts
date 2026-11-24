import { z } from "zod";
import type { HourlyAir } from "@/domain/air/hourly";
import { airSummary } from "@/domain/air/summary";
import type { HourlyWeather } from "@/domain/air/weatherWhy";

/** One grid cell's hourly air and weather as fetched at `fetchedAt` (spec F2, 9.1 `airCache`). */
export interface AirSnapshot {
  readonly gridId: string;
  readonly lat: number;
  readonly lon: number;
  readonly timeZone: string;
  readonly fetchedAt: Date;
  readonly source: "open-meteo";
  readonly air: HourlyAir;
  readonly weather: HourlyWeather;
}

/** The air cache keeps a cell for 48 hours; the daily clean-up deletes it after `expireAt`. */
export const AIR_CACHE_TTL_MS = 48 * 3_600_000;

/** "2026112106": the UTC hour an air reading belongs to. */
export const hourKey = (at: Date): string => at.toISOString().slice(0, 13).replace(/[-T]/g, "");

/** `airCache/{gridId}_{yyyyMMddHH}`. */
export const cacheDocId = (gridId: string, at: Date): string => `${gridId}_${hourKey(at)}`;

/** The centre of a 0.1° cell ("28.6_77.2" → 28.6, 77.2): every place in the cell shares one fetch. */
export function gridCentre(gridId: string): { lat: number; lon: number } {
  const [lat, lon] = gridId.split("_").map(Number);
  return { lat, lon };
}

const series = z.array(z.number().nullable());

/** The stored document; the derived fields are for reading the cache by eye and in Breezy later. */
export const airCacheDoc = z.object({
  gridId: z.string(),
  fetchedAt: z.date(),
  expireAt: z.date(),
  source: z.literal("open-meteo"),
  timeZone: z.string(),
  hourly: z.object({
    time: z.array(z.string()),
    pm25: series,
    pm10: series,
    no2: series,
    o3: series,
    co: series,
    so2: series,
    wtime: z.array(z.string()),
    wind: series,
    temp: series,
    humidity: series,
  }),
  nowAqi: z.number().nullable(),
  avg24Aqi: z.number().nullable(),
  mainPollutant: z.enum(["pm25", "pm10"]).nullable(),
  bands: z.array(z.string().nullable()),
  outlook: z.array(z.object({ date: z.string(), worstBand: z.string(), bestStart: z.number().nullable() })),
});
export type AirCacheDoc = z.infer<typeof airCacheDoc>;

/** The document for a snapshot, with the summary fields computed for its own time and zone. */
export function toCacheDoc(s: AirSnapshot): AirCacheDoc {
  const summary = airSummary(s.air, { now: s.fetchedAt, timeZone: s.timeZone });
  const { air, weather } = s;
  return {
    gridId: s.gridId,
    fetchedAt: s.fetchedAt,
    expireAt: new Date(s.fetchedAt.getTime() + AIR_CACHE_TTL_MS),
    source: s.source,
    timeZone: s.timeZone,
    hourly: {
      time: [...air.time],
      pm25: [...air.pm25],
      pm10: [...air.pm10],
      no2: [...air.no2],
      o3: [...air.o3],
      co: [...air.co],
      so2: [...air.so2],
      wtime: [...weather.time],
      wind: [...weather.windKmh],
      temp: [...weather.tempC],
      humidity: [...weather.humidity],
    },
    nowAqi: summary.now?.aqi ?? null,
    avg24Aqi: summary.avg24,
    mainPollutant: summary.now?.main ?? null,
    bands: summary.today.map((p) => p?.band ?? null),
    outlook: summary.outlook.map((d) => ({ date: d.date, worstBand: d.worstBand, bestStart: d.best?.start ?? null })),
  };
}

/** The snapshot in a stored document, or null if it does not parse (an old or edited doc is ignored). */
export function fromCacheDoc(raw: unknown): AirSnapshot | null {
  const parsed = airCacheDoc.safeParse(raw);
  if (!parsed.success) return null;
  const { hourly: h, ...doc } = parsed.data;
  return {
    gridId: doc.gridId,
    ...gridCentre(doc.gridId),
    timeZone: doc.timeZone,
    fetchedAt: doc.fetchedAt,
    source: doc.source,
    air: { time: h.time, pm25: h.pm25, pm10: h.pm10, no2: h.no2, o3: h.o3, co: h.co, so2: h.so2 },
    weather: { time: h.wtime, windKmh: h.wind, tempC: h.temp, humidity: h.humidity },
  };
}
