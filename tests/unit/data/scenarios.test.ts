import { describe, expect, it } from "vitest";
import { parseScenario, recordedScenario, SCENARIO_IDS } from "@/data/recorded/scenarios";
import { freshness } from "@/domain/air/freshness";
import { hourPoints, indexHours, nowPoint } from "@/domain/air/hourly";
import { ruleContext } from "@/domain/rules/context";
import { planActivity } from "@/domain/rules/planActivity";
import { isSevereDay } from "@/domain/rules/severeDay";
import type { Activity } from "@/domain/rules/activities";
import type { Planned } from "@/domain/rules/plan";

const at = (scenarioNow: Date, hour: number) => ({
  now: new Date(scenarioNow.getTime() + (hour - 6) * 3_600_000),
  timeZone: "Asia/Kolkata",
});

const FAMILY: [Planned, Activity][] = [
  [
    { group: "extra", travel: { main: "walk", others: [] } },
    { id: "walk", type: "morning_walk", usual: "06:30", flex: "any", duration: "15to60" },
  ],
  [
    { group: "sensitive", travel: { main: "cycle", others: ["school_bus", "car"] } },
    { id: "school", type: "school_trip", usual: "07:00", flex: "fixed", duration: "15to60" },
  ],
  [
    { group: "everyday", travel: { main: "car", others: ["metro"] } },
    { id: "office", type: "office_trip", usual: "09:00", flex: "fixed", duration: "15to60" },
  ],
];

describe("recorded demo days", () => {
  it.each(SCENARIO_IDS)("%s parses with the live schemas and covers the day before plus 5 days", (id) => {
    const s = recordedScenario(id);
    expect(s.air.time).toHaveLength(6 * 24);
    expect(s.weather.time).toHaveLength(6 * 24);
    expect(s.placeName).toBe("Green Park, New Delhi");
    expect(freshness(s.fetchedAt, { now: s.scenarioNow, timeZone: "Asia/Kolkata" })).toBe("fresh");
  });

  it("Smog morning is a real Very poor morning on 18 Nov 2024", () => {
    const s = recordedScenario("smog-morning");
    const now = nowPoint(indexHours(hourPoints(s.air)), { now: s.scenarioNow, timeZone: "Asia/Kolkata" });
    expect(s.date).toBe("2024-11-18");
    expect(now?.band).toBe("very_poor");
  });

  it("the second day reaches Severe (PM2.5 ≥ 251) on 31 Jan 2025", () => {
    const s = recordedScenario("severe-day");
    const index = indexHours(hourPoints(s.air));
    expect(isSevereDay(index, "2025-01-31")).toBe(true);
    expect(Math.max(...s.air.pm25.slice(24, 48).map((v) => v ?? 0))).toBeGreaterThanOrEqual(251);
  });

  it.each([6, 12, 16])("Smog morning shows at least one Avoid and one switch_mode at the %i:00 stepper time", (hour) => {
    const s = recordedScenario("smog-morning");
    const clock = at(s.scenarioNow, hour);
    const env = { index: indexHours(hourPoints(s.air)), clock, ctx: ruleContext(clock, "igp", false) };
    const plans = FAMILY.map(([person, activity]) => planActivity(person, activity, env));
    expect(plans.some((p) => p?.verdictAtUsual === "avoid")).toBe(true);
    expect(plans.some((p) => p?.suggestion === "switch_mode")).toBe(true);
  });

  it("refuses a fixture edited into the wrong shape", () => {
    expect(() => parseScenario({ id: "smog-morning" })).toThrow();
  });
});
