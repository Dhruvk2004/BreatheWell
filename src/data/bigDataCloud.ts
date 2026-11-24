import { z } from "zod";
import { round2 } from "@/domain/geo/grid";
import { fetchJson, query, type DataResult, type FetchOptions } from "./http";
import type { Coordinates } from "./openMeteo/air";

const REVERSE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

/** BigDataCloud's free client-side reverse geocoder (no key). Only the fields we use. */
export const reverseResponse = z.object({
  city: z.string().optional().default(""),
  locality: z.string().optional().default(""),
  principalSubdivision: z.string().optional().default(""),
  countryName: z.string().optional().default(""),
  countryCode: z.string().optional().default(""),
});
export type ReverseResponse = z.infer<typeof reverseResponse>;

/** The place name shown on Air now ("South Delhi, Delhi") and whether it is in India. */
export interface PlaceName {
  readonly name: string;
  readonly countryCode: string;
}

export const reverseUrl = (at: Coordinates, lang: "en" | "hi"): string => {
  const { lat2, lon2 } = round2(at.lat, at.lon);
  return `${REVERSE_URL}?${query({ latitude: lat2, longitude: lon2, localityLanguage: lang })}`;
};

/** Locality (or city), then state; falls back to the country. */
export function toPlaceName(response: ReverseResponse): PlaceName {
  const local = response.locality || response.city;
  const parts = [local, response.principalSubdivision].filter((p, i, all) => p && all.indexOf(p) === i);
  return { name: parts.length ? parts.join(", ") : response.countryName, countryCode: response.countryCode };
}

/** Browser location → place name. Coordinates are rounded to 2 decimals first. */
export async function reverseGeocode(at: Coordinates, lang: "en" | "hi", options: FetchOptions = {}): Promise<DataResult<PlaceName>> {
  const result = await fetchJson(reverseUrl(at, lang), reverseResponse, options);
  return result.ok ? { ok: true, value: toPlaceName(result.value) } : result;
}
