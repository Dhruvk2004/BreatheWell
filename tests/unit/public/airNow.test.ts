import { describe, expect, it } from "vitest";
import { cityAt } from "@/domain/geo/cities";
import { airNow } from "@/domain/public/airNow";
import { airOf, bandDay, istClock, joinSeries, weatherOf } from "../../helpers/air";

const DAY = "2024-11-18";
const series = joinSeries(
  bandDay("2024-11-17", "very_poor"),
  bandDay(DAY, "very_poor", { 14: "moderate", 15: "moderate" }),
  bandDay("2024-11-19", "poor"),
);
const clock = istClock(`${DAY}T06:10`);
const base = {
  air: airOf(series),
  weather: weatherOf(series),
  clock,
  fetchedAt: clock.now,
  region: "igp" as const,
  city: cityAt(28.56, 77.21),
};

describe("Air now model (spec 10.2), code only", () => {
  it("gives the reading, advice, tips, swap, weather and the adults-only figure", () => {
    const m = airNow(base);
    expect(m.freshness).toBe("fresh");
    expect(m.reading).toMatchObject({ band: "very_poor", main: "pm25", time: `${DAY}T06:00` });
    expect(m.care.map((r) => r.verdict)).toEqual(["care", "avoid"]);
    expect(m.tips).toEqual(["shut_windows_till_noon", "air_out_best_hour", "no_incense_coils"]);
    expect(m.airOutAt).toBe(14);
    expect(m.swap.mode).toBe("metro");
    expect(m.swap.co2Kg).toBeCloseTo(2.1);
    expect(m.morning?.why).toBe("calm_cold_morning");
    expect(m.pollutants.length).toBeGreaterThan(0);
    expect(m.cigarettes?.count).toBeGreaterThan(1);
    expect(m.stationNote).toBe(true);
    expect(m.outsideIndia).toBe(false);
  });

  it("keeps verdicts on old data and drops everything on stale data (spec 8.5)", () => {
    expect(airNow({ ...base, fetchedAt: new Date(clock.now.getTime() - 5 * 3_600_000) }).freshness).toBe("old");
    const stale = airNow({ ...base, fetchedAt: new Date(clock.now.getTime() - 13 * 3_600_000) });
    expect(stale).toMatchObject({
      freshness: "stale",
      reading: null,
      care: [],
      tips: [],
      pollutants: [],
      cigarettes: null,
      airOutAt: null,
    });
  });

  it("outside India: no station note, a bus swap where there is no metro, no cigarettes without a full day", () => {
    const partial = { ...series, pm25: series.pm25.map((v, i) => (i === 30 ? null : v)) };
    const m = airNow({ ...base, air: airOf(partial), region: "outside_india", city: null });
    expect(m).toMatchObject({ stationNote: false, outsideIndia: true, cigarettes: null });
    expect(m.swap.mode).toBe("auto_bus");
  });

  it("has no reading when the current hour has no data", () => {
    expect(airNow({ ...base, clock: istClock("2030-01-01T06:10"), fetchedAt: istClock("2030-01-01T06:10").now }).reading).toBeNull();
  });

  it("with no best window left (7:10 pm, short forecast) still airs out and gives tips", () => {
    const evening = istClock(`${DAY}T19:10`);
    const m = airNow({
      ...base,
      air: airOf(bandDay(DAY, "poor")),
      weather: weatherOf(bandDay(DAY, "poor")),
      clock: evening,
      fetchedAt: evening.now,
    });
    expect(m.summary.best).toBeNull();
    expect(m.reading?.band).toBe("poor");
    expect(m.tips.length).toBeGreaterThan(0);
  });

  it("the station note needs an NCR city inside India; outside India it never shows", () => {
    expect(airNow({ ...base, region: "india", city: null }).stationNote).toBe(false);
    expect(airNow({ ...base, region: "outside_india" }).stationNote).toBe(false);
    expect(airNow({ ...base, city: cityAt(18.52, 73.86) }).stationNote).toBe(false);
  });

  it("a reading on a day with a PM2.5 gap has no whole-day adults-only figure", () => {
    const gap = { ...series, pm25: series.pm25.map((v, i) => (i >= 24 + 20 && i < 48 ? null : v)) };
    const m = airNow({ ...base, air: airOf(gap) });
    expect(m.reading).not.toBeNull();
    expect(m.cigarettes).toBeNull();
  });
});
