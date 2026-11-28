/**
 * CPCB AQI bands: the one source of truth for band order, breakpoints and icons. The
 * UI, the rules, the prompts and the templates all read bands from here.
 */
export const BANDS = ["good", "satisfactory", "moderate", "poor", "very_poor", "severe"] as const;
export type Band = (typeof BANDS)[number];

/** Lucide icon names; every band is shown as colour + word + icon. */
export type BandIcon = "smile" | "cloud-sun" | "cloud" | "cloud-fog" | "triangle-alert" | "octagon-alert";

export interface BandInfo {
  readonly band: Band;
  /** Inclusive AQI range of the band. */
  readonly aqi: readonly [number, number];
  /** Inclusive µg/m³ breakpoints (Severe uses the calculator's upper bound). */
  readonly pm25: readonly [number, number];
  readonly pm10: readonly [number, number];
  readonly icon: BandIcon;
}

export const BAND_TABLE: readonly BandInfo[] = [
  { band: "good", aqi: [0, 50], pm25: [0, 30], pm10: [0, 50], icon: "smile" },
  { band: "satisfactory", aqi: [51, 100], pm25: [31, 60], pm10: [51, 100], icon: "cloud-sun" },
  { band: "moderate", aqi: [101, 200], pm25: [61, 90], pm10: [101, 250], icon: "cloud" },
  { band: "poor", aqi: [201, 300], pm25: [91, 120], pm10: [251, 350], icon: "cloud-fog" },
  { band: "very_poor", aqi: [301, 400], pm25: [121, 250], pm10: [351, 430], icon: "triangle-alert" },
  { band: "severe", aqi: [401, 500], pm25: [251, 380], pm10: [431, 510], icon: "octagon-alert" },
];

/** AQI values above the scale are shown as "500+". */
export const AQI_MAX = 500;

/** 0 for Good … 5 for Severe. */
export const bandRank = (band: Band): number => BANDS.indexOf(band);

/** The band an AQI value falls in; anything above 500 is Severe. */
export function bandOfAqi(aqi: number): Band {
  return BAND_TABLE.find((info) => aqi <= info.aqi[1])?.band ?? "severe";
}

/** The band `steps` places stricter (worse), capped at Severe. */
export function stricterBand(band: Band, steps = 1): Band {
  return BANDS[Math.min(bandRank(band) + steps, BANDS.length - 1)];
}

/** The worst of several bands (the one place the outlook, airing and day checks compare bands), or null for none. */
export const worstBand = (bands: readonly Band[]): Band | null =>
  bands.length ? bands.reduce((a, b) => (bandRank(b) > bandRank(a) ? b : a)) : null;

/** The icon for a band. */
export const bandIcon = (band: Band): BandIcon => BAND_TABLE[bandRank(band)].icon;

/** "368" or "500+" for display. */
export const displayAqi = (aqi: number): string => (aqi > AQI_MAX ? `${AQI_MAX}+` : String(aqi));
