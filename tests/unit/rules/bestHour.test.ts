import { describe, expect, it } from "vitest";
import { bestHour, candidateHours, judgeAt, worthMoving, type HourJudgement, type Judge } from "@/domain/rules/bestHour";
import { ruleContext } from "@/domain/rules/context";
import { daySeries, indexOf, istClock } from "../../helpers/air";

const DATE = "2024-11-18";
const ctx = ruleContext(istClock(`${DATE}T06:00`), "india", false);
const judgeOver = (pm25: (number | null)[], span = 1): Judge => ({
  index: indexOf(daySeries(DATE, pm25)),
  group: "sensitive",
  intensity: "moderate",
  span,
  ctx,
});
const j = (hour: number, verdict: HourJudgement["verdict"], worstAqi: number): HourJudgement => ({ hour, verdict, worstAqi });

describe("candidate hours (spec 8.4 step 2)", () => {
  it("keeps 06–21 and never the past", () => {
    expect(candidateHours("any", 7, 0)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    expect(candidateHours("any", 7, 19)).toEqual([19, 20, 21]);
  });

  it("limits by flexibility", () => {
    expect(candidateHours("fixed", 8, 7)).toEqual([8]);
    expect(candidateHours("fixed", 8, 9)).toEqual([]);
    expect(candidateHours("some", 8, 0)).toEqual([6, 7, 8, 9, 10]);
    expect(candidateHours("some", 20, 0)).toEqual([18, 19, 20, 21]);
  });
});

describe("judging an hour (spec 8.4 step 3)", () => {
  const pm = Array.from({ length: 24 }, (_, h) => (h === 9 ? 200 : 45));

  it("judges the worst hour of the activity's span", () => {
    expect(judgeAt(judgeOver(pm), DATE, 8)).toEqual({ hour: 8, verdict: "go", worstAqi: 75 });
    expect(judgeAt(judgeOver(pm, 2), DATE, 8)).toEqual({ hour: 8, verdict: "avoid", worstAqi: 362 });
  });

  it("returns null when any hour has no data or the span runs past midnight", () => {
    expect(judgeAt(judgeOver([...pm.slice(0, 10), null, ...pm.slice(11)], 2), DATE, 9)).toBeNull();
    expect(judgeAt(judgeOver(pm, 2), DATE, 23)).toBeNull();
  });
});

describe("picking the best hour (spec 8.4 step 4)", () => {
  it("orders by verdict, worst AQI, distance from the usual hour, then hour", () => {
    const pm = Array.from({ length: 24 }, (_, h) => ({ 10: 105, 11: 75, 12: 75, 14: 75 })[h] ?? 200);
    expect(bestHour(judgeOver(pm), DATE, [10, 11, 12, 14], 13)?.hour).toBe(12);
    expect(bestHour(judgeOver(pm), DATE, [10, 11, 14], 12)?.hour).toBe(11);
    expect(bestHour(judgeOver(pm), DATE, [], 12)).toBeNull();
  });
});

describe("moving only when it helps (spec 8.4 step 5)", () => {
  it("moves for a better verdict", () => expect(worthMoving(j(15, "care", 182), j(6, "avoid", 368))).toBe(true));
  it("never moves to an Avoid hour or to the same hour", () => {
    expect(worthMoving(j(15, "avoid", 300), j(6, "avoid", 450))).toBe(false);
    expect(worthMoving(j(6, "care", 100), j(6, "care", 200))).toBe(false);
  });
  it("moves at the same verdict only for at least 20% and 25 points less", () => {
    expect(worthMoving(j(15, "care", 200), j(7, "care", 250))).toBe(true);
    expect(worthMoving(j(15, "care", 226), j(7, "care", 250))).toBe(false);
    expect(worthMoving(j(15, "care", 101), j(7, "care", 125))).toBe(false);
  });
  it("does not move to a worse verdict", () => expect(worthMoving(j(15, "care", 100), j(7, "go", 300))).toBe(false));
});
