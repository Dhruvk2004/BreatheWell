import type { Coordinates, LiveAir } from "@/data/openMeteo/air";
import type { DataResult } from "@/data/http";
import type { HourlyWeather } from "@/domain/air/weatherWhy";
import { gridIdOf } from "@/domain/geo/grid";
import type { TtlCache } from "../cache";
import { cacheDocId, gridCentre, type AirSnapshot } from "./snapshot";
import type { AirStore } from "./store";

/** What the air service needs, injected so tests run it with fixtures and fakes. */
export interface AirDeps {
  readonly fetchAir: (at: Coordinates) => Promise<DataResult<LiveAir>>;
  readonly fetchWeather: (at: Coordinates) => Promise<DataResult<HourlyWeather>>;
  readonly store: AirStore | null;
  /** This hour's snapshots by cache id. */
  readonly memory: TtlCache<AirSnapshot>;
  /** The last good snapshot per grid cell, for up to 12 hours (spec 8.5 "from 4:00 am"). */
  readonly lastGood: TtlCache<AirSnapshot>;
  readonly now: () => Date;
}

const NO_WEATHER: HourlyWeather = { time: [], windKmh: [], tempC: [], humidity: [] };

/** The store is best effort: a failed read or a used-up write quota never breaks Air now (spec 7.8). */
async function quietly<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

async function fetchSnapshot(gridId: string, deps: AirDeps): Promise<AirSnapshot | null> {
  const at = gridCentre(gridId);
  const [air, weather] = await Promise.all([deps.fetchAir(at), deps.fetchWeather(at)]);
  if (!air.ok) return null;
  const { timeZone } = air.value;
  return {
    gridId,
    ...at,
    timeZone,
    fetchedAt: deps.now(),
    source: "open-meteo",
    air: air.value.air,
    weather: weather.ok ? weather.value : NO_WEATHER,
  };
}

/**
 * The air for a place (spec F2, 11.3): fetched once per 0.1° grid cell per hour. Order: this
 * instance's memory, then Firestore `airCache`, then Open-Meteo (air and weather in parallel, 5 s
 * timeout) with a best-effort write back. If Open-Meteo fails, the last good snapshot (≤ 12 h) is
 * returned and its age decides what the page may show; null when there is nothing at all.
 */
export async function loadAir(place: Coordinates, deps: AirDeps): Promise<AirSnapshot | null> {
  const gridId = gridIdOf(place.lat, place.lon);
  const now = deps.now();
  const key = cacheDocId(gridId, now);
  const { store } = deps;
  const cached = deps.memory.get(key) ?? (store ? await quietly(() => store.get(gridId, now), null) : null);
  const snapshot = cached ?? (await fetchSnapshot(gridId, deps));
  if (!snapshot) return deps.lastGood.get(gridId) ?? null;
  deps.lastGood.set(gridId, snapshot);
  // Without weather ("Why are mornings worst?" needs it) the snapshot is served but not cached for
  // the hour, so the next request tries the weather call again.
  if (!cached && snapshot.weather.time.length === 0) return snapshot;
  deps.memory.set(key, snapshot);
  if (!cached && store) await quietly(() => store.put(snapshot), undefined);
  return snapshot;
}
