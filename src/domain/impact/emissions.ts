import type { TripLength } from "../rules/activities";
import type { Mode } from "../rules/modes";
import { EMISSION_FACTORS } from "./emissionFactors";

/** Trip length bucket → one-way km. */
export const TRIP_KM: Readonly<Record<TripLength, number>> = { under15: 3, "15to45": 10, over45: 20 };

export interface Emission {
  /** kg CO₂ */
  readonly co2Kg: number;
  /** g tailpipe PM */
  readonly pmG: number;
}

/** Emissions of one person travelling `km` in a mode. */
export function tripEmission(mode: Mode, km: number): Emission {
  const f = EMISSION_FACTORS[mode];
  return { co2Kg: f.co2KgPerPkm * km, pmG: f.pmGPerPkm * km };
}

/**
 * "For the air" on a swap card: avoided = (factor(current) − factor(swap)) × km, over the
 * same trip, a return trip by default. Never negative: a swap that adds emissions shows nothing avoided.
 */
export function avoidedBySwap(current: Mode, swap: Mode, tripLength: TripLength, returnTrip = true): Emission {
  const km = TRIP_KM[tripLength] * (returnTrip ? 2 : 1);
  const before = tripEmission(current, km);
  const after = tripEmission(swap, km);
  return { co2Kg: Math.max(0, before.co2Kg - after.co2Kg), pmG: Math.max(0, before.pmG - after.pmG) };
}

/**
 * The Air now "One swap for the air today": a fixed 10 km car trip (the 15–45 min bucket),
 * there and back, by metro, or by bus where the city has no metro.
 */
export function airNowSwap(hasMetro: boolean): { swap: Mode; avoided: Emission } {
  const swap: Mode = hasMetro ? "metro" : "auto_bus";
  return { swap, avoided: avoidedBySwap("car", swap, "15to45") };
}

/** A ticked swap from `progress`. */
export interface SwapTick {
  readonly from: Mode;
  readonly to: Mode;
  readonly tripLength: TripLength;
}

/** The weekly line on Today: "avoided about 9 kg CO₂ and 6 car trips". */
export function weeklyTotals(ticks: readonly SwapTick[]): { co2Kg: number; carTrips: number } {
  return ticks.reduce(
    (sum, t) => ({
      co2Kg: sum.co2Kg + avoidedBySwap(t.from, t.to, t.tripLength).co2Kg,
      carTrips: sum.carTrips + (t.from === "car" && t.to !== "car" ? 1 : 0),
    }),
    { co2Kg: 0, carTrips: 0 },
  );
}

/**
 * "About" rounding, never more precise than the source: under 1 kg to one decimal ("0.4"), else a
 * whole number ("2"). Zero stays "0".
 */
export function aboutKg(kg: number): string {
  if (kg <= 0) return "0";
  const tenth = Math.round(kg * 10) / 10;
  return tenth < 1 ? tenth.toFixed(1) : String(Math.round(kg));
}
