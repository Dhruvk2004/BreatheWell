import { AQI_MAX, BAND_TABLE, bandOfAqi, type Band } from "./bands";

export type PmPollutant = "pm25" | "pm10";

export interface PmReading {
  readonly pm25: number | null;
  readonly pm10: number | null;
}

export interface AqiResult {
  /** Whole AQI; above the scale it is 501 (shown as "500+"). */
  readonly aqi: number;
  readonly band: Band;
  /** The pollutant whose sub-index set the AQI. */
  readonly main: PmPollutant;
  /** PM10 was missing, so the AQI is from PM2.5 alone. */
  readonly pm10Missing: boolean;
}

const ABOVE_SCALE = AQI_MAX + 1;

/**
 * CPCB sub-index by linear interpolation inside the band's breakpoints. The concentration
 * is rounded to a whole µg/m³ first, as the CPCB tables use integers. Null for a missing or negative value.
 */
export function subIndex(pollutant: PmPollutant, concentration: number | null): number | null {
  if (concentration === null || !Number.isFinite(concentration) || concentration < 0) return null;
  const c = Math.round(concentration);
  const info = BAND_TABLE.find((row) => c <= row[pollutant][1]);
  if (!info) return ABOVE_SCALE;
  const [cLo, cHi] = info[pollutant];
  const [iLo, iHi] = info.aqi;
  return Math.round(((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo);
}

/**
 * AQI = max(sub-index PM2.5, sub-index PM10), "calculated from PM2.5 and PM10". PM10 missing → PM2.5
 * alone (flagged); PM2.5 missing → PM10 alone; both missing → null (no AQI, no verdicts).
 */
export function aqiFromPm(reading: PmReading): AqiResult | null {
  const fine = subIndex("pm25", reading.pm25);
  const coarse = subIndex("pm10", reading.pm10);
  if (fine === null && coarse === null) return null;
  const main: PmPollutant = coarse !== null && (fine === null || coarse > fine) ? "pm10" : "pm25";
  const aqi = Math.max(fine ?? 0, coarse ?? 0);
  return { aqi, band: bandOfAqi(aqi), main, pm10Missing: coarse === null };
}
