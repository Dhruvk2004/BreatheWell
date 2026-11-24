import { round2 } from "@/domain/geo/grid";

/** A place chosen on the landing: from the browser location or the city search. */
export interface ChosenPlace {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly countryCode: string | null;
}

/**
 * The Air now URL for a place: `/air?place=…&lat=..&lon=..&cc=IN`, with coordinates
 * rounded to 2 decimals (about 1 km) so an exact position never reaches a URL or a log.
 */
export function airHref(place: ChosenPlace, path = "/air"): string {
  const { lat2, lon2 } = round2(place.lat, place.lon);
  const params = new URLSearchParams({ place: place.name.slice(0, 80), lat: String(lat2), lon: String(lon2) });
  if (place.countryCode && /^[A-Za-z]{2}$/.test(place.countryCode)) params.set("cc", place.countryCode.toUpperCase());
  return `${path}?${params.toString()}`;
}

/** The community message page for the same place, with the same rounding. */
export const communityHref = (place: ChosenPlace): string => airHref(place, "/community");
