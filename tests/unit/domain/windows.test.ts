import { describe, expect, it } from "vitest";
import { hourPoints } from "@/domain/air/hourly";
import { outlook } from "@/domain/air/outlook";
import { bestWindow, worstWindow } from "@/domain/air/windows";
import { bandDay, daySeries, indexOf, istClock, joinSeries } from "../../helpers/air";

const smogDay = (date: string) => bandDay(date, "very_poor", { 13: "poor", 14: "moderate", 15: "moderate", 16: "poor" });

describe("family best and worst windows", () => {
  it("picks the cleanest 2-hour block in 06–21", () => {
    expect(bestWindow(indexOf(smogDay("2024-11-18")), "2024-11-18")).toEqual({ start: 14, end: 16 });
  });

  it("drops past hours and returns null when nothing is left", () => {
    const index = indexOf(smogDay("2024-11-18"));
    expect(bestWindow(index, "2024-11-18", 16)?.start).toBe(16);
    expect(bestWindow(index, "2024-11-18", 21)).toBeNull();
  });

  it("breaks ties on the total, then the earlier start", () => {
    const series = daySeries(
      "2024-11-18",
      Array.from({ length: 24 }, (_, h) => (h === 9 ? 70 : 75)),
    );
    expect(bestWindow(indexOf(series), "2024-11-18")).toEqual({ start: 8, end: 10 });
    expect(bestWindow(indexOf(bandDay("2024-11-18", "poor")), "2024-11-18")).toEqual({ start: 6, end: 8 });
  });

  it("grows the worst window over a neighbour in the same band, up to 3 hours", () => {
    const series = daySeries(
      "2024-11-18",
      Array.from({ length: 24 }, (_, h) => (h >= 6 && h <= 9 ? 230 : h === 10 ? 200 : 100)),
    );
    expect(worstWindow(indexOf(series), "2024-11-18")).toEqual({ start: 6, end: 9 });
    const late = daySeries(
      "2024-11-18",
      Array.from({ length: 24 }, (_, h) => (h === 20 ? 240 : h === 21 ? 245 : h === 19 ? 200 : 100)),
    );
    expect(worstWindow(indexOf(late), "2024-11-18")).toEqual({ start: 19, end: 22 });
    const single = daySeries(
      "2024-11-18",
      Array.from({ length: 24 }, (_, h) => (h === 12 ? 300 : 40)),
    );
    expect(worstWindow(indexOf(single), "2024-11-18")).toEqual({ start: 11, end: 13 });
  });

  it("keeps the worst window apart from the best one and worse than it", () => {
    // Lucknow at 6 pm: only 18–22 left, so best and worst came from the same hours.
    const evening = daySeries(
      "2024-11-18",
      Array.from({ length: 24 }, (_, h) => (h === 18 ? 249 : h === 19 ? 260 : h === 20 ? 262 : h === 21 ? 215 : 300)),
    );
    const index = indexOf(evening);
    const best = bestWindow(index, "2024-11-18", 18);
    expect(best).toEqual({ start: 18, end: 20 });
    // Without the best window it overlaps it: the bug.
    const old = worstWindow(index, "2024-11-18", 18);
    expect(old && old.start < best!.end).toBe(true);
    // 20–22 is the only block left, and it is the same band (poor) as the best one: no worst to name.
    expect(worstWindow(index, "2024-11-18", 18, best)).toBeNull();
    // A truly worse block that doesn't touch the best window is still named, and never grows into it.
    const worse = daySeries(
      "2024-11-18",
      Array.from({ length: 24 }, (_, h) => (h === 18 || h === 19 ? 320 : h === 20 || h === 21 ? 215 : 100)),
    );
    const i2 = indexOf(worse);
    expect(worstWindow(i2, "2024-11-18", 18, bestWindow(i2, "2024-11-18", 18))).toEqual({ start: 18, end: 20 });
    // Morning: smog 6–9 am, clean afternoon, as before.
    const day = indexOf(smogDay("2024-11-18"));
    const w = worstWindow(day, "2024-11-18", 6, bestWindow(day, "2024-11-18"));
    expect(w && (w.end <= 14 || w.start >= 16)).toBe(true);
  });

  it("returns null without data", () => {
    const empty = daySeries("2024-11-18", Array(24).fill(null));
    expect(worstWindow(indexOf(empty), "2024-11-18")).toBeNull();
    expect(bestWindow(indexOf(empty), "2024-11-18")).toBeNull();
  });
});

describe("5-day outlook from hourly data", () => {
  const days = ["2024-11-18", "2024-11-19", "2024-11-20", "2024-11-21", "2024-11-22", "2024-11-23"];
  const series = joinSeries(...days.map((d, i) => (i === 2 ? bandDay(d, "moderate") : smogDay(d))));

  it("gives up to 5 days with the worst band and best window", () => {
    const days5 = outlook(hourPoints(series), istClock("2024-11-18T06:10"));
    expect(days5).toHaveLength(5);
    expect(days5[0]).toEqual({ date: "2024-11-18", weekday: "mon", worstBand: "very_poor", best: { start: 14, end: 16 } });
    expect(days5[2]).toMatchObject({ date: "2024-11-20", worstBand: "moderate" });
  });

  it("uses only hours still ahead for today, and skips days without data", () => {
    const late = outlook(hourPoints(series), istClock("2024-11-18T20:30"));
    expect(late[0].best).toBeNull();
    const short = outlook(hourPoints(joinSeries(smogDay("2024-11-18"))), istClock("2024-11-18T06:10"));
    expect(short.map((d) => d.date)).toEqual(["2024-11-18"]);
  });
});
