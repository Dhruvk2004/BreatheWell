/**
 * The city-search suggestion shape and its label, without the fetch and its schema, so the search
 * box can render suggestions while `geocode.ts` (and Zod) load only when someone types.
 */

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

/** Suggestions start after 3 letters. */
export const MIN_SEARCH_LENGTH = 3;
/** "Pune, Maharashtra, India". */
export const suggestionLabel = (s: PlaceSuggestion): string => [s.name, s.region, s.country].filter(Boolean).join(", ");
