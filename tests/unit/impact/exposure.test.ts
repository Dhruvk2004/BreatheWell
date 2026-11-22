import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cigarettesPerDay } from "@/domain/impact/cigarettes";
import {
  afterOutings,
  beforeOutings,
  dayPm25,
  exposureSchedule,
  exposureToday,
  outsideAllDay,
  PLACE_FACTOR,
} from "@/domain/impact/exposure";
import { percentLess } from "@/domain/impact/picture";
import type { Activity } from "@/domain/rules/activities";
import type { ActivityPlan } from "@/domain/rules/plan";
import { daySeries, indexOf } from "../../helpers/air";

// Spec 7.4 worked example: PM2.5 300 at 06:00, 120 at 15:00, 240 in every other hour; Dadaji is
// Extra care with a purifier in one room; walk 45 min (0.75 h).
const PM = Array.from({ length: 24 }, (_, h) => (h === 6 ? 300 : h === 15 ? 120 : 240));
const purifier = { purifierRoom: true };

describe("exposureSchedule and exposureToday: the worked example", () => {
  it("outside all day ≈ 237.5 → about 11 cigarettes", () => {
    expect(outsideAllDay(PM)).toBeCloseTo(237.5, 5);
    expect(cigarettesPerDay(outsideAllDay(PM))).toEqual({ count: 11, lessThanOne: false });
  });

  it("before (walk at 06:00) ≈ 141 → about 6", () => {
    const before = exposureToday(PM, exposureSchedule([{ start: 6, hours: 0.75, factor: 1 }], purifier));
    expect(before).toBeCloseTo(3385.5 / 24, 5);
    expect(cigarettesPerDay(before).count).toBe(6);
  });

  it("after (walk at 15:00) ≈ 139 → about 6, and about 60% less smoke during the walk", () => {
    const after = exposureToday(PM, exposureSchedule([{ start: 15, hours: 0.75, factor: 1 }], purifier));
    expect(after).toBeCloseTo(3345 / 24, 5);
    expect(percentLess({ pm25: 300, hours: 0.75, factor: 1 }, { pm25: 120, hours: 0.75, factor: 1 })).toBe(60);
  });

  it("uses windows-shut indoors (0.7) at night without a purifier", () => {
    const schedule = exposureSchedule([], { purifierRoom: false });
    expect(schedule.every((hour) => hour.length === 1 && hour[0].factor === PLACE_FACTOR.indoor)).toBe(true);
  });

  it("splits an outing across hours", () => {
    const schedule = exposureSchedule([{ start: 6.5, hours: 1.5, factor: 0.5 }], { purifierRoom: false });
    expect(schedule[6]).toEqual([
      { fraction: 0.5, factor: 0.5 },
      { fraction: 0.5, factor: 0.7 },
    ]);
    expect(schedule[7]).toEqual([{ fraction: 1, factor: 0.5 }]);
  });

  it("shares an hour between overlapping outings instead of counting it twice", () => {
    const overlap = [
      { start: 7, hours: 0.75, factor: 1 },
      { start: 7, hours: 0.75, factor: 0.5 },
    ];
    const hour = exposureSchedule(overlap, { purifierRoom: false })[7];
    expect(hour).toEqual([
      { fraction: 0.5, factor: 1 },
      { fraction: 0.5, factor: 0.5 },
    ]);
    expect(hour.reduce((sum, s) => sum + s.fraction, 0)).toBe(1);
  });

  it("stays between the lowest and highest factor times the day's PM (property)", () => {
    const outing = fc.record({
      start: fc.integer({ min: 0, max: 22 }),
      hours: fc.constantFrom(0.25, 0.75, 1.5),
      factor: fc.constantFrom(0.5, 1),
    });
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 24, maxLength: 24 }),
        fc.array(outing, { maxLength: 1 }),
        fc.boolean(),
        (pm, outs, room) => {
          const value = exposureToday(pm, exposureSchedule(outs, { purifierRoom: room }));
          expect(value).toBeGreaterThanOrEqual(outsideAllDay(pm) * 0.35 - 1e-9);
          expect(value).toBeLessThanOrEqual(outsideAllDay(pm) + 1e-9);
        },
      ),
    );
  });
});

describe("before and after outings from the plan", () => {
  const walk: Activity = { id: "a1", type: "morning_walk", usual: "06:30", flex: "any", duration: "15to60" };
  const trip: Activity = { id: "a2", type: "office_trip", usual: "08:30", flex: "fixed", duration: "15to60" };
  const base: Omit<ActivityPlan, "activityId" | "suggestion"> = {
    date: "2024-11-18",
    usualHour: 6,
    verdictAtUsual: "avoid",
    bestTime: null,
    verdictAtBest: null,
    switchTo: null,
    tomorrowBest: null,
    notes: [],
  };

  it("uses usual times and modes before", () => {
    expect(beforeOutings([walk, trip], "two_wheeler")).toEqual([
      { start: 6.5, hours: 0.75, factor: 1 },
      { start: 8.5, hours: 0.75, factor: 1 },
    ]);
    expect(beforeOutings([trip], "home")).toEqual([]);
  });

  it("moves, switches or drops outings after", () => {
    const plans: ActivityPlan[] = [
      { ...base, activityId: "a1", suggestion: "move_time", bestTime: 15 },
      { ...base, activityId: "a2", suggestion: "switch_mode", switchTo: "metro" },
    ];
    expect(afterOutings([walk, trip], "two_wheeler", plans)).toEqual([
      { start: 15, hours: 0.75, factor: 1 },
      { start: 8.5, hours: 0.75, factor: 0.5 },
    ]);
    expect(afterOutings([walk], "walk", [{ ...base, activityId: "a1", suggestion: "indoor" }])).toEqual([]);
    expect(afterOutings([walk], "walk", [])).toEqual([{ start: 6.5, hours: 0.75, factor: 1 }]);
    expect(afterOutings([trip], "home", [])).toEqual([]);
  });

  it("reads a whole day of PM2.5, or null with a gap", () => {
    expect(dayPm25(indexOf(daySeries("2024-11-18", PM)), "2024-11-18")).toEqual(PM);
    expect(dayPm25(indexOf(daySeries("2024-11-18", [...PM.slice(0, 23), null])), "2024-11-18")).toBeNull();
  });
});

describe("cigarettes and percentages", () => {
  it("never shows 0 cigarettes", () => {
    expect(cigarettesPerDay(5)).toEqual({ count: 1, lessThanOne: true });
    expect(cigarettesPerDay(-3)).toEqual({ count: 1, lessThanOne: true });
    expect(cigarettesPerDay(11)).toEqual({ count: 1, lessThanOne: false });
  });

  it("rounds percent less to tens, 100 indoors, 0 when it does not help", () => {
    const before = { pm25: 200, hours: 0.75, factor: 1 };
    expect(percentLess(before, { ...before, factor: 0.5 })).toBe(50);
    expect(percentLess(before, null)).toBe(100);
    expect(percentLess(before, { ...before, pm25: 300 })).toBe(0);
    expect(percentLess({ ...before, pm25: 0 }, null)).toBe(0);
  });
});
