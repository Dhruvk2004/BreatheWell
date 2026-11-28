import type { Mode } from "../rules/modes";

/**
 * Per-passenger-km emission factors: typical published values for Indian vehicles and the Delhi
 * Metro, rounded. Tailpipe PM values are order-of-magnitude estimates, so the UI always says
 * "about" and names the source beside every figure.
 */
export interface EmissionFactor {
  readonly co2KgPerPkm: number;
  readonly pmGPerPkm: number;
  readonly sourceName: string;
  readonly sourceUrl: string;
}

const ICCT = { sourceName: "ICCT India vehicle emission studies", sourceUrl: "https://theicct.org/region/india/" };
const DMRC = { sourceName: "DMRC carbon credit and energy reports", sourceUrl: "https://www.delhimetrorail.com/" };
const ZERO = { co2KgPerPkm: 0, pmGPerPkm: 0, sourceName: "No fuel burned", sourceUrl: "" };

export const EMISSION_FACTORS: Readonly<Record<Mode, EmissionFactor>> = {
  // Petrol car, 1.5 occupants (published range 0.10–0.13).
  car: { co2KgPerPkm: 0.12, pmGPerPkm: 0.004, ...ICCT },
  // Same car shared by 3.
  carpool: { co2KgPerPkm: 0.06, pmGPerPkm: 0.002, ...ICCT },
  // 0.03–0.04.
  two_wheeler: { co2KgPerPkm: 0.035, pmGPerPkm: 0.008, ...ICCT },
  // CNG auto or a city bus; auto ≈ 0.04, bus 0.02–0.03.
  auto_bus: { co2KgPerPkm: 0.03, pmGPerPkm: 0.006, ...ICCT },
  auto_van: { co2KgPerPkm: 0.04, pmGPerPkm: 0.007, ...ICCT },
  school_bus: { co2KgPerPkm: 0.025, pmGPerPkm: 0.004, ...ICCT },
  // 0.01–0.02; no tailpipe.
  metro: { co2KgPerPkm: 0.015, pmGPerPkm: 0, ...DMRC },
  walk: ZERO,
  cycle: ZERO,
  home: ZERO,
};
