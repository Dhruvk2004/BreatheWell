import { describe, expect, it } from "vitest";
import { morningWeather, pollutantsAt } from "@/domain/air/pollutants";
import { airSummary } from "@/domain/air/summary";
import { worstWindow } from "@/domain/air/windows";
import { whoShouldTakeCare } from "@/domain/rules/publicAdvice";
import { airOf, bandDay, indexOf, istClock, joinSeries, weatherOf } from "../../helpers/air";

const DAY = "2024-11-18";
const series = joinSeries(
  bandDay("2024-11-17", "very_poor"),
  bandDay(DAY, "very_poor", { 14: "moderate", 15: "moderate", 19: "severe", 20: "severe" }),
  bandDay("2024-11-19", "poor", { 13: "satisfactory", 14: "satisfactory" }),
);

describe("airSummary", () => {
  it("at 6 am describes today's best and worst windows and the 24-hour average", () => {
    const s = airSummary(series, istClock(`${DAY}T06:10`));
    expect(s).toMatchObject({ date: DAY, hour: 6, windowDay: "today", enoughForecast: true, best: { start: 14, end: 16 } });
    expect(s.worst).toEqual({ start: 19, end: 21 });
    expect(s.now?.band).toBe("very_poor");
    expect(s.avg24).not.toBeNull();
    expect(s.today).toHaveLength(24);
    expect(s.outlook[0].date).toBe(DAY);
  });

  it("later in the day only looks at hours still ahead", () => {
    const s = airSummary(series, istClock(`${DAY}T16:10`));
    expect(s.windowDay).toBe("rest_of_today");
    expect(s.best?.start).toBeGreaterThanOrEqual(16);
  });

  it("after 9 pm gives tomorrow's best time", () => {
    const s = airSummary(series, istClock(`${DAY}T21:30`));
    expect(s.windowDay).toBe("tomorrow");
    expect(s.best).toEqual({ start: 13, end: 15 });
  });

  it("with fewer than 6 future hours has no best or worst time", () => {
    const s = airSummary(bandDay(DAY, "poor"), istClock(`${DAY}T19:10`));
    expect(s.enoughForecast).toBe(false);
    expect(s.best).toBeNull();
    expect(s.worst).toBeNull();
  });

  it("worstWindow skips past hours when asked", () => {
    const index = indexOf(bandDay(DAY, "poor", { 7: "severe", 8: "severe", 18: "very_poor", 19: "very_poor" }));
    expect(worstWindow(index, DAY)).toEqual({ start: 7, end: 9 });
    expect(worstWindow(index, DAY, 12)).toEqual({ start: 18, end: 20 });
  });
});

describe("pollutants and the morning weather", () => {
  const air = airOf(bandDay(DAY, "poor"));
  it("rounds µg/m³ and shows CO in mg/m³, leaving out missing values", () => {
    const values = pollutantsAt(air, `${DAY}T06:00`);
    expect(values.map((v) => v.pollutant)).toEqual(["pm25", "no2", "o3", "co"]);
    expect(values.find((v) => v.pollutant === "co")).toEqual({ pollutant: "co", value: 2.1, unit: "mg/m³" });
    expect(pollutantsAt(air, "2000-01-01T00:00")).toEqual([]);
  });

  it("reads 6 am wind and temperature into the weather reason", () => {
    expect(morningWeather(weatherOf(air, 0.46, 11.6), DAY)).toEqual({ windKmh: 0.5, tempC: 12, why: "calm_cold_morning" });
    expect(morningWeather(weatherOf(air), "2000-01-01")).toBeNull();
    expect(morningWeather({ ...weatherOf(air), windKmh: air.time.map(() => null) }, DAY)).toBeNull();
  });
});

describe("who should take care", () => {
  const ctx = { month: 11, region: "india" as const, hasStation: false };
  it("uses the one verdict table, the stricter of Sensitive and Extra care", () => {
    expect(whoShouldTakeCare("very_poor", ctx)).toEqual([
      { audience: "most", verdict: "care" },
      { audience: "sensitive", verdict: "avoid" },
    ]);
    expect(whoShouldTakeCare("good", ctx).every((r) => r.verdict === "go")).toBe(true);
  });

  it("applies the winter caution to the second row in an IGP city", () => {
    expect(whoShouldTakeCare("satisfactory", ctx)[1].verdict).toBe("go");
    expect(whoShouldTakeCare("satisfactory", { ...ctx, region: "igp" })[1].verdict).toBe("care");
  });
});
