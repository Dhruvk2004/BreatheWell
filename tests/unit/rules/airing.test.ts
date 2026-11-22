import { describe, expect, it } from "vitest";
import { airOutHour } from "@/domain/rules/airing";
import { planActivity } from "@/domain/rules/planActivity";
import { bandDay, daySeries, envFor, indexOf, joinSeries } from "../../helpers/air";

const DATE = "2024-11-18";

describe("airing the home (spec 8.4 step 8)", () => {
  it("airs out at the best hour only when it is at least one band better than the morning", () => {
    const smog = indexOf(bandDay(DATE, "very_poor", { 15: "poor" }));
    expect(airOutHour(smog, DATE, 15)).toBe(15);
    const flat = indexOf(bandDay(DATE, "very_poor"));
    expect(airOutHour(flat, DATE, 15)).toBeNull();
  });

  it("returns null without a best hour or without data", () => {
    const smog = indexOf(bandDay(DATE, "very_poor", { 15: "poor" }));
    expect(airOutHour(smog, DATE, null)).toBeNull();
    expect(airOutHour(indexOf(daySeries(DATE, Array(24).fill(null))), DATE, 15)).toBeNull();
  });
});

describe("tomorrow's better time", () => {
  it("is null when tomorrow is a Severe day too", () => {
    const series = joinSeries(bandDay(DATE, "very_poor"), bandDay("2024-11-19", "very_poor", { 9: "severe" }));
    const walk = { id: "w", type: "morning_walk" as const, usual: "06:30", flex: "any" as const, duration: "over60" as const };
    const plan = planActivity({ group: "sensitive", travel: { main: "walk", others: [] } }, walk, envFor(series, `${DATE}T06:00`));
    expect(plan).toMatchObject({ suggestion: "indoor", tomorrowBest: null });
  });
});
