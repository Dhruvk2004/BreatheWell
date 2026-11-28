import { describe, expect, it } from "vitest";
import type { Activity } from "@/domain/rules/activities";
import type { Planned } from "@/domain/rules/plan";
import { planActivity } from "@/domain/rules/planActivity";
import { bandDay, daySeries, envFor, joinSeries } from "../../helpers/air";

const TODAY = "2024-11-21";
const TOMORROW = "2024-11-22";
const walk: Activity = { id: "a1", type: "morning_walk", usual: "06:30", flex: "any", duration: "15to60" };
const dadaji: Planned = { group: "extra", travel: { main: "walk", others: [] } };

// Worked example: 06–09 Very poor, 14:00 Moderate (≈190), 15:00 Moderate (≈182).
const workedDay = daySeries(
  TODAY,
  Array.from({ length: 24 }, (_, h) => (h === 14 ? 87 : h === 15 ? 85 : 225)),
);
const workedTwoDays = joinSeries(workedDay, bandDay(TOMORROW, "very_poor", { 15: "satisfactory" }));

describe("the worked example", () => {
  it("moves Dadaji's walk to 3 pm with care, and adds the inhaler (no winter caution)", () => {
    const plan = planActivity(dadaji, walk, envFor(workedTwoDays, `${TODAY}T06:00`, "india"));
    expect(plan).toMatchObject({ verdictAtUsual: "avoid", suggestion: "move_time", bestTime: 15, verdictAtBest: "care", date: TODAY });
    expect(plan?.notes).toEqual(["keep_inhaler"]);
  });

  it("keeps the walk indoors under the winter caution, with tomorrow's better time (design round 1)", () => {
    const plan = planActivity(dadaji, walk, envFor(workedTwoDays, `${TODAY}T06:00`, "igp"));
    expect(plan).toMatchObject({ verdictAtUsual: "avoid", suggestion: "indoor", bestTime: null, tomorrowBest: 15 });
    expect(plan?.notes).toEqual(["winter_caution", "keep_inhaler"]);
  });
});

describe("essential trips are never skipped", () => {
  const school: Activity = { id: "s1", type: "school_trip", usual: "07:00", flex: "fixed", duration: "15to60" };
  const riya: Planned = { group: "sensitive", travel: { main: "cycle", others: ["car", "school_bus"] } };

  it("switches to the shared enclosed mode first", () => {
    const plan = planActivity(riya, school, envFor(bandDay(TODAY, "very_poor"), `${TODAY}T06:10`));
    expect(plan).toMatchObject({
      verdictAtUsual: "avoid",
      suggestion: "switch_mode",
      switchTo: "school_bus",
      verdictAtBest: "care",
      notes: [],
    });
  });

  it("presents a still-Avoid trip as care with the protect tips, and notes closures on a Severe day", () => {
    const plan = planActivity(riya, school, envFor(bandDay(TODAY, "severe"), `${TODAY}T06:10`));
    expect(plan).toMatchObject({ suggestion: "switch_mode", switchTo: "school_bus", verdictAtBest: "care" });
    expect(plan?.notes).toEqual(["essential_protect", "schools_may_close"]);
  });

  it("protects in place when no safer mode exists", () => {
    const noOptions: Planned = { group: "sensitive", travel: { main: "cycle", others: [] } };
    const plan = planActivity(noOptions, school, envFor(bandDay(TODAY, "very_poor"), `${TODAY}T06:10`));
    expect(plan).toMatchObject({ suggestion: "protect", verdictAtBest: "care", switchTo: null, notes: ["essential_protect"] });
  });

  it("adds the carpool / no idling note when the switch is to the own car", () => {
    const parent: Planned = { group: "everyday", travel: { main: "two_wheeler", others: ["car", "walk"] } };
    const office: Activity = { id: "o1", type: "office_trip", usual: "09:00", flex: "fixed", duration: "15to60" };
    const plan = planActivity(parent, office, envFor(bandDay(TODAY, "severe"), `${TODAY}T06:10`));
    expect(plan).toMatchObject({ suggestion: "switch_mode", switchTo: "car", verdictAtBest: "care" });
    expect(plan?.notes).toEqual(["car_carpool_no_idling", "schools_may_close"]);
  });

  it("protects in place instead of switching between open modes", () => {
    const walker: Planned = { group: "sensitive", travel: { main: "cycle", others: ["walk", "auto_van"] } };
    const plan = planActivity(walker, school, envFor(bandDay(TODAY, "very_poor"), `${TODAY}T06:10`));
    expect(plan).toMatchObject({ suggestion: "protect", switchTo: null, notes: ["essential_protect"] });
  });

  it("goes as planned on Go and protects on Care", () => {
    expect(planActivity(riya, school, envFor(bandDay(TODAY, "good"), `${TODAY}T06:10`))?.suggestion).toBe("as_planned");
    expect(planActivity(riya, school, envFor(bandDay(TODAY, "poor"), `${TODAY}T06:10`))?.suggestion).toBe("protect");
  });
});

describe("Severe day", () => {
  it("keeps every non-essential activity indoors, even a clean afternoon", () => {
    const day = bandDay(TODAY, "very_poor", { 8: "severe", 15: "satisfactory" });
    const plan = planActivity({ group: "everyday", travel: { main: "walk", others: [] } }, walk, envFor(day, `${TODAY}T06:10`));
    expect(plan).toMatchObject({ verdictAtUsual: "avoid", suggestion: "indoor", notes: ["severe_day"], tomorrowBest: null });
  });

  it("only counts Severe hours still ahead: once the morning has cleared, the hourly verdicts apply", () => {
    const day = bandDay(TODAY, "very_poor", { 8: "severe", 15: "satisfactory" });
    const everyday: Planned = { group: "everyday", travel: { main: "walk", others: [] } };
    const plan = planActivity(everyday, walk, envFor(day, `${TODAY}T10:10`));
    expect(plan).toMatchObject({ suggestion: "move_time", bestTime: 15, verdictAtBest: "go", notes: [] });
  });
});

describe("the planned date drives the winter caution", () => {
  it("judges 1 Mar (no caution) when planning after 21:00 on 28 Feb", () => {
    const series = joinSeries(bandDay("2025-02-28", "moderate"), bandDay("2025-03-01", "moderate"));
    const evening: Activity = { ...walk, usual: "18:00", flex: "fixed" };
    const plan = planActivity(dadaji, evening, envFor(series, "2025-02-28T21:30", "igp"));
    expect(plan).toMatchObject({ date: "2025-03-01", verdictAtUsual: "care", notes: [] });
    const sameDay = planActivity(dadaji, evening, envFor(series, "2025-02-28T06:00", "igp"));
    expect(sameDay).toMatchObject({ date: "2025-02-28", verdictAtUsual: "avoid", notes: ["winter_caution", "keep_inhaler"] });
  });
});

describe("flexibility, time and missing data", () => {
  const adult: Planned = { group: "everyday", travel: { main: "walk", others: [] } };
  const market: Activity = { id: "m1", type: "errands", usual: "18:00", flex: "fixed", duration: "15to60" };

  it("handles fixed non-essential activities", () => {
    expect(planActivity(adult, market, envFor(bandDay(TODAY, "good"), `${TODAY}T06:00`))?.suggestion).toBe("as_planned");
    expect(planActivity(adult, market, envFor(bandDay(TODAY, "poor"), `${TODAY}T06:00`))?.suggestion).toBe("protect");
    const hard = { ...market, duration: "over60" as const };
    expect(planActivity(adult, hard, envFor(bandDay(TODAY, "very_poor"), `${TODAY}T06:00`))?.suggestion).toBe("indoor");
  });

  it("plans tomorrow after 21:00 and never suggests a past hour", () => {
    const series = joinSeries(bandDay(TODAY, "very_poor", { 15: "moderate" }), bandDay(TOMORROW, "very_poor", { 14: "moderate" }));
    const night = planActivity(adult, { ...walk, flex: "any" }, envFor(series, `${TODAY}T21:30`));
    expect(night).toMatchObject({ date: TOMORROW, bestTime: 14 });
    const afternoon = planActivity(adult, walk, envFor(series, `${TODAY}T16:00`));
    expect(afternoon).toMatchObject({ date: TODAY, suggestion: "protect", bestTime: null });
  });

  it("returns null without data for the usual hour", () => {
    const empty = daySeries(TODAY, Array(24).fill(null));
    expect(planActivity(adult, walk, envFor(empty, `${TODAY}T06:00`))).toBeNull();
  });
});
