import { fetchJson, query, type DataResult, type FetchOptions } from "../http";
import { geocodeResponse, type GeocodeResponse } from "./schemas";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

/** A city search suggestion ("Pune, Maharashtra, India"). */
export interface PlaceSuggestion {
  readonly id: number;
  readonly name: string;
  readonly region: string | null;
  readonly country: string | null;
  readonly countryCode: string | null;
  readonly lat: number;
  readonly lon: number;
}

/** Suggestions start after 3 letters (design 10.1). */
export const MIN_SEARCH_LENGTH = 3;
export const MAX_SUGGESTIONS = 5;

export const geocodeUrl = (name: string, lang: "en" | "hi"): string =>
  `${GEOCODE_URL}?${query({ name: name.trim(), count: MAX_SUGGESTIONS, language: lang, format: "json" })}`;

/** Maps the API's results to suggestions; no results → an empty list. */
export function toSuggestions(response: GeocodeResponse): PlaceSuggestion[] {
  return (response.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    region: r.admin1 ?? null,
    country: r.country ?? null,
    countryCode: r.country_code ?? null,
    lat: r.latitude,
    lon: r.longitude,
  }));
}

/** "Pune, Maharashtra, India". */
export const suggestionLabel = (s: PlaceSuggestion): string => [s.name, s.region, s.country].filter(Boolean).join(", ");

/** Typed city search (F1 fallback). Short queries return no suggestions without a request. */
export async function searchPlaces(name: string, lang: "en" | "hi", options: FetchOptions = {}): Promise<DataResult<PlaceSuggestion[]>> {
  if (name.trim().length < MIN_SEARCH_LENGTH) return { ok: true, value: [] };
  const result = await fetchJson(geocodeUrl(name, lang), geocodeResponse, options);
  return result.ok ? { ok: true, value: toSuggestions(result.value) } : result;
}
