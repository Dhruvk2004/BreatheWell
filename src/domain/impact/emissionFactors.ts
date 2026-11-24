import type { Mode } from "../rules/modes";

/**
 * Per-passenger-km emission factors. CO₂ values sit inside the spec's starting
 * ranges; tailpipe PM values are order-of-magnitude estimates. `verified: false` marks a value not
 * yet checked against its source (open item for QA, build log 21 Nov); the UI always says "about".
 */
export interface EmissionFactor {
  readonly co2KgPerPkm: number;
  readonly pmGPerPkm: number;
  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly verified: boolean;
}

const ICCT = { sourceName: "ICCT India vehicle emission studies", sourceUrl: "https://theicct.org/region/india/", verified: false };
const DMRC = { sourceName: "DMRC carbon credit and energy reports", sourceUrl: "https://www.delhimetrorail.com/", verified: false };
const ZERO = { co2KgPerPkm: 0, pmGPerPkm: 0, sourceName: "No fuel burned", sourceUrl: "", verified: true };

export const EMISSION_FACTORS: Readonly<Record<Mode, EmissionFactor>> = {
  // Petrol car, 1.5 occupants (spec 7.5: 0.10–0.13).
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
