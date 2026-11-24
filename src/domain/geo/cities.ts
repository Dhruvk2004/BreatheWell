import type { Region } from "../rules/context";
import { gridIdOf } from "./grid";

/**
 * Listed Indian cities: the Indo-Gangetic Plain cities that get the winter caution,
 * Delhi NCR (station note on every verdict screen), which cities have a metro (Air now "One swap"),
 * and each city's explicit 0.1° grid cells (the community message spends Gemini quota only on these).
 */
export interface City {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  /** Half-width of the city's square of grid cells, in 0.1° cells (1 → 3 × 3 cells). */
  readonly cells: number;
  /** Delhi NCR, Punjab, Haryana, Uttar Pradesh or Bihar (spec 8.3 override 4). */
  readonly igp: boolean;
  /** Delhi NCR: "Official stations may read higher" on every verdict screen. */
  readonly ncr: boolean;
  /** A running metro line, so the Air now swap is car → metro. */
  readonly metro: boolean;
}

const c = (id: string, name: string, lat: number, lon: number, cells: number, flags: string): City => ({
  id,
  name,
  lat,
  lon,
  cells,
  igp: flags.includes("igp"),
  ncr: flags.includes("ncr"),
  metro: flags.includes("metro"),
});

export const CITIES: readonly City[] = [
  c("delhi", "Delhi", 28.61, 77.21, 3, "igp ncr metro"),
  c("noida", "Noida", 28.54, 77.39, 1, "igp ncr metro"),
  c("gurugram", "Gurugram", 28.46, 77.03, 1, "igp ncr metro"),
  c("ghaziabad", "Ghaziabad", 28.67, 77.44, 1, "igp ncr metro"),
  c("faridabad", "Faridabad", 28.41, 77.32, 1, "igp ncr metro"),
  c("chandigarh", "Chandigarh", 30.73, 76.78, 1, "igp"),
  c("ludhiana", "Ludhiana", 30.9, 75.85, 1, "igp"),
  c("amritsar", "Amritsar", 31.63, 74.87, 1, "igp"),
  c("panipat", "Panipat", 29.39, 76.97, 1, "igp"),
  c("hisar", "Hisar", 29.15, 75.72, 1, "igp"),
  c("lucknow", "Lucknow", 26.85, 80.95, 1, "igp metro"),
  c("kanpur", "Kanpur", 26.45, 80.33, 1, "igp metro"),
  c("agra", "Agra", 27.18, 78.01, 1, "igp metro"),
  c("varanasi", "Varanasi", 25.32, 82.97, 1, "igp"),
  c("prayagraj", "Prayagraj", 25.44, 81.85, 1, "igp"),
  c("meerut", "Meerut", 28.98, 77.71, 1, "igp"),
  c("patna", "Patna", 25.59, 85.14, 1, "igp metro"),
  c("gaya", "Gaya", 24.79, 85.0, 1, "igp"),
  c("mumbai", "Mumbai", 19.08, 72.88, 2, "metro"),
  c("pune", "Pune", 18.52, 73.86, 1, "metro"),
  c("bengaluru", "Bengaluru", 12.97, 77.59, 2, "metro"),
  c("hyderabad", "Hyderabad", 17.39, 78.49, 2, "metro"),
  c("chennai", "Chennai", 13.08, 80.27, 2, "metro"),
  c("kolkata", "Kolkata", 22.57, 88.36, 2, "metro"),
  c("ahmedabad", "Ahmedabad", 23.02, 72.57, 1, "metro"),
  c("jaipur", "Jaipur", 26.91, 75.79, 1, "metro"),
  c("bhopal", "Bhopal", 23.26, 77.41, 1, "metro"),
  c("indore", "Indore", 22.72, 75.86, 1, "metro"),
  c("nagpur", "Nagpur", 21.15, 79.09, 1, "metro"),
  c("kochi", "Kochi", 9.93, 76.27, 1, "metro"),
  c("guwahati", "Guwahati", 26.14, 91.74, 1, ""),
];

/** The city's explicit list of 0.1° grid ids ("28.6_77.2"), a square of cells round its centre. */
export function cityGridIds(city: City): string[] {
  const ids: string[] = [];
  for (let dy = -city.cells; dy <= city.cells; dy++) {
    for (let dx = -city.cells; dx <= city.cells; dx++) ids.push(gridIdOf(city.lat + dy / 10, city.lon + dx / 10));
  }
  return ids;
}

const BY_GRID = new Map<string, City>();
for (const city of CITIES) for (const id of cityGridIds(city)) if (!BY_GRID.has(id)) BY_GRID.set(id, city);

/** The listed city whose grid covers the point (Delhi first where NCR cells overlap), or null. */
export const cityAt = (lat: number, lon: number): City | null => BY_GRID.get(gridIdOf(lat, lon)) ?? null;

/** True for a grid id inside a listed city. */
export const isListedGrid = (gridId: string): boolean => BY_GRID.has(gridId);

/** Rough box round India, used only when no country code came with the place. */
const INDIA_BOX = { south: 6.5, north: 35.7, west: 68, east: 97.5 } as const;

/**
 * The rule region for a place: a listed Indo-Gangetic city, elsewhere in India, or
 * outside India ("Shown on India's CPCB scale", no winter caution). The geocoder's country code wins
 * over the box; the box only covers places typed or found without one.
 */
export function regionAt(lat: number, lon: number, countryCode: string | null): Region {
  const city = cityAt(lat, lon);
  if (city) return city.igp ? "igp" : "india";
  if (countryCode) return countryCode.toUpperCase() === "IN" ? "india" : "outside_india";
  const inBox = lat >= INDIA_BOX.south && lat <= INDIA_BOX.north && lon >= INDIA_BOX.west && lon <= INDIA_BOX.east;
  return inBox ? "india" : "outside_india";
}
