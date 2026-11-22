import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EMISSION_FACTORS } from "@/domain/impact/emissionFactors";
import { aboutKg, airNowSwap, avoidedBySwap, TRIP_KM, tripEmission, weeklyTotals } from "@/domain/impact/emissions";
import { MODES } from "@/domain/rules/modes";

describe("emission factors (spec 7.5)", () => {
  it("keeps CO₂ inside the spec's starting ranges and every source named", () => {
    expect(EMISSION_FACTORS.car.co2KgPerPkm).toBeGreaterThanOrEqual(0.1);
    expect(EMISSION_FACTORS.car.co2KgPerPkm).toBeLessThanOrEqual(0.13);
    expect(EMISSION_FACTORS.metro.co2KgPerPkm).toBeLessThanOrEqual(0.02);
    expect(EMISSION_FACTORS.walk.co2KgPerPkm + EMISSION_FACTORS.cycle.co2KgPerPkm).toBe(0);
    for (const mode of MODES) expect(EMISSION_FACTORS[mode].sourceName).not.toBe("");
  });

  it("maps trip buckets to km", () => expect(TRIP_KM).toEqual({ under15: 3, "15to45": 10, over45: 20 }));
});

describe("avoided by a swap", () => {
  it("is (current − swap) × km, there and back", () => {
    const avoided = avoidedBySwap("car", "metro", "15to45");
    expect(avoided.co2Kg).toBeCloseTo((0.12 - 0.015) * 20, 10);
    expect(avoidedBySwap("car", "metro", "15to45", false).co2Kg).toBeCloseTo(1.05, 10);
    expect(tripEmission("two_wheeler", 10).co2Kg).toBeCloseTo(0.35, 10);
  });

  it("is never negative and zero for the same mode, for every mode pair (property)", () => {
    const mode = fc.constantFrom(...MODES);
    const trip = fc.constantFrom("under15" as const, "15to45" as const, "over45" as const);
    fc.assert(
      fc.property(mode, mode, trip, (from, to, length) => {
        const avoided = avoidedBySwap(from, to, length);
        expect(avoided.co2Kg).toBeGreaterThanOrEqual(0);
        expect(avoided.pmG).toBeGreaterThanOrEqual(0);
        if (from === to) expect(avoided.co2Kg).toBe(0);
      }),
    );
  });

  it("gives Air now's 10 km car swap as about 2 kg", () => {
    expect(aboutKg(airNowSwap(true).avoided.co2Kg)).toBe("2");
    expect(airNowSwap(false).swap).toBe("auto_bus");
  });
});

describe("weekly line and rounding", () => {
  it("sums ticked swaps and counts car trips", () => {
    const totals = weeklyTotals([
      { from: "car", to: "metro", tripLength: "15to45" },
      { from: "car", to: "carpool", tripLength: "15to45" },
      { from: "two_wheeler", to: "metro", tripLength: "15to45" },
    ]);
    expect(totals.carTrips).toBe(2);
    expect(aboutKg(totals.co2Kg)).toBe("4");
    expect(weeklyTotals([])).toEqual({ co2Kg: 0, carTrips: 0 });
  });

  it("says about, never more precise than the source", () => {
    expect([aboutKg(0), aboutKg(0.36), aboutKg(0.96), aboutKg(2.1), aboutKg(9.5)]).toEqual(["0", "0.4", "1", "2", "10"]);
  });
});
