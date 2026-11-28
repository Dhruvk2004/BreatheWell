import { describe, expect, it } from "vitest";
import { average24Aqi, hasEnoughForecast, hourPoints, indexHours, nowPoint, pointAt } from "@/domain/air/hourly";
import { freshness, verdictsAllowed } from "@/domain/air/freshness";
import { weatherWhy } from "@/domain/air/weatherWhy";
import { bandDay, daySeries, istClock, joinSeries } from "../../helpers/air";

describe("hourly points", () => {
  it("computes an AQI per hour and skips hours without data", () => {
    const series = daySeries("2024-11-18", [208, null, 45, ...Array(21).fill(null)]);
    const points = hourPoints(series);
    expect(points.map((p) => [p.hour, p.aqi, p.band])).toEqual([
      [0, 368, "very_poor"],
      [2, 75, "satisfactory"],
    ]);
    expect(points[0]).toMatchObject({ date: "2024-11-18", time: "2024-11-18T00:00", pm25: 208, pm10: null, main: "pm25" });
  });

  it("finds the point for the clock's hour", () => {
    const index = indexHours(hourPoints(bandDay("2024-11-18", "moderate", { 6: "very_poor" })));
    expect(nowPoint(index, istClock("2024-11-18T06:59"))?.band).toBe("very_poor");
    expect(nowPoint(index, istClock("2024-11-19T06:00"))).toBeUndefined();
    expect(pointAt(index, "2024-11-18", 7)?.band).toBe("moderate");
  });

  it("does not pass undefined values as data", () => {
    const series = { time: ["2024-11-18T00:00"], pm25: [], pm10: [] };
    expect(hourPoints(series)).toEqual([]);
  });
});

describe("24-hour average (CPCB style)", () => {
  const twoDays = joinSeries(daySeries("2024-11-17", Array(24).fill(100)), daySeries("2024-11-18", Array(24).fill(200)));

  it("averages the 24 hours ending at the clock's hour", () => {
    // 17 Nov 07:00–23:00 (17 h at 100) + 18 Nov 00:00–06:00 (7 h at 200) → mean 129 µg/m³ → 307.
    expect(average24Aqi(twoDays, istClock("2024-11-18T06:10"))).toBe(307);
    expect(average24Aqi(twoDays, istClock("2024-11-18T23:00"))).toBe(362);
  });

  it("needs at least 16 hours of data", () => {
    const sparse = daySeries("2024-11-18", [...Array(15).fill(100), ...Array(9).fill(null)]);
    expect(average24Aqi(sparse, istClock("2024-11-18T23:00"))).toBeNull();
  });

  it("knows when the forecast is too short (fewer than 6 future hours)", () => {
    const points = hourPoints(bandDay("2024-11-18", "poor"));
    expect(hasEnoughForecast(points, istClock("2024-11-18T17:00"))).toBe(true);
    expect(hasEnoughForecast(points, istClock("2024-11-18T18:00"))).toBe(false);
  });
});

describe("freshness", () => {
  const fetched = new Date("2024-11-18T00:30:00Z");
  it.each([
    ["2024-11-18T09:00", "fresh"],
    ["2024-11-18T09:01", "old"],
    ["2024-11-18T18:00", "old"],
    ["2024-11-18T18:01", "stale"],
  ])("at %s IST the reading is %s", (local, state) => {
    expect(freshness(fetched, istClock(local))).toBe(state);
  });

  it("allows verdicts only on fresh or old data", () => {
    expect(verdictsAllowed("fresh")).toBe(true);
    expect(verdictsAllowed("old")).toBe(true);
    expect(verdictsAllowed("stale")).toBe(false);
  });
});

describe("why mornings are worst", () => {
  it.each([
    [0.5, 12, "calm_cold_morning"],
    [3, 20, "calm_morning"],
    [20, 12, "windy"],
    [8, 12, "mild"],
  ])("wind %f km/h, %f °C → %s", (wind, temp, why) => expect(weatherWhy(wind, temp)).toBe(why));
});
