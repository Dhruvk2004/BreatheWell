import { cityAt, regionAt } from "@/domain/geo/cities";
import { airNow } from "@/domain/public/airNow";
import { translator, type Lang } from "@/i18n/t";
import type { AirNowPage } from "@/view/airNowPage";
import { checkClient, type RateLimiter } from "../rateLimit";
import { airNowCommunity } from "./community";
import { parsePlaceQuery } from "./query";
import { loadAir, type AirDeps } from "./service";

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** The place's display name: the URL's name, else its coordinates ("Near 28.56, 77.21"). */
const placeLabel = (name: string | null, lat: number, lon: number, lang: Lang): string =>
  name ?? translator(lang)("air.coordinates", { lat: lat.toFixed(2), lon: lon.toFixed(2) });

/**
 * Loads Air now for the URL's place: validates the query, applies the per-IP limit (the page is as
 * public as `/api/air`), loads the grid cell's air, builds the model with the clock in the place's
 * time zone and the community message in the page language. The page only renders the result.
 */
export async function loadAirNowPage(
  params: SearchParams,
  headers: Headers,
  deps: AirDeps,
  limiter: RateLimiter,
  lang: Lang,
): Promise<AirNowPage> {
  const query = parsePlaceQuery(params);
  if (!query) return { kind: "no_place" };
  if (!checkClient(limiter, headers).allowed) return { kind: "rate_limited" };
  const name = query.place || null;
  const place = { name, label: placeLabel(name, query.lat, query.lon, lang), lat: query.lat, lon: query.lon };
  const snapshot = await loadAir(query, deps);
  if (!snapshot) return { kind: "unavailable", place };
  const { timeZone, fetchedAt } = snapshot;
  const model = airNow({
    air: snapshot.air,
    weather: snapshot.weather,
    fetchedAt,
    clock: { now: deps.now(), timeZone },
    region: regionAt(query.lat, query.lon, query.cc ?? null),
    city: cityAt(query.lat, query.lon),
  });
  const community = model.reading ? airNowCommunity(model, { place: place.label, fetchedAt, timeZone }, lang) : null;
  return { kind: "ready", place, model, timeZone, fetchedAt, community };
}
