/**
 * Location rounding (spec 6.5, 9.1): homes are stored to 2 decimals (about 1 km); the air cache uses
 * a 0.1° grid (about 11 km). Exact coordinates are never stored.
 */
const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
};

/** Coordinates rounded to 2 decimals. */
export const round2 = (lat: number, lon: number): { lat2: number; lon2: number } => ({ lat2: round(lat, 2), lon2: round(lon, 2) });

/** The 0.1° grid id, e.g. "28.6_77.2". */
export const gridIdOf = (lat: number, lon: number): string => `${round(lat, 1).toFixed(1)}_${round(lon, 1).toFixed(1)}`;

/** True for valid latitude and longitude. */
export const isValidCoordinate = (lat: number, lon: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
