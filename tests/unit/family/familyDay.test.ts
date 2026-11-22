import { describe, expect, it } from "vitest";
import { DEMO_FAMILY, DEMO_HOME, DEMO_WEEK_TICKS } from "@/data/demo/family";
import { recordedScenario } from "@/data/recorded/scenarios";
import { familyDay } from "@/domain/family/familyDay";
import { kidCardFor } from "@/domain/family/kidCardFor";
import { orderRows, planPerson } from "@/domain/family/people";
import { kidCardProblems } from "@/domain/libraries/kid";
import { bandDay, envFor, istClock } from "../../helpers/air";

const at = (id: "smog-morning" | "severe-day", hour: number) => {
  const s = recordedScenario(id);
  const now = new Date(s.scenarioNow.getTime() + (hour - 6) * 3_600_000);
  return { s, clock: { now, timeZone: "Asia/Kolkata" } };
};

const dayFor = (id: "smog-morning" | "severe-day", hour: number, viewerId: string | null = "neha") => {
  const { s, clock } = at(id, hour);
  return familyDay({
    air: s.air,
    fetchedAt: clock.now,
    clock,
    region: "igp",
    people: DEMO_FAMILY,
    viewerId,
    home: DEMO_HOME,
    ticks: DEMO_WEEK_TICKS,
  });
};

describe("planPerson and row order (spec 10.8)", () => {
  it("headlines the activity that needs the most care, then the earliest", () => {
    const env = envFor(bandDay("2024-11-18", "very_poor"), "2024-11-18T06:10", "igp");
    const riya = planPerson(DEMO_FAMILY[4], env);
    expect(riya.group).toBe("sensitive");
    expect(riya.headline?.activity.type).toBe("school_trip");
    expect(riya.headline?.plan.suggestion).toBe("switch_mode");
  });

  it("puts me first, then extra care, other adults and dependents", () => {
    const env = envFor(bandDay("2024-11-18", "poor"), "2024-11-18T06:10", "igp");
    const plans = DEMO_FAMILY.map((p) => planPerson(p, env));
    expect(orderRows(plans, "rahul").map((p) => p.person.id)).toEqual(["rahul", "dadaji", "neha", "aarav", "riya"]);
    expect(orderRows(plans, null).map((p) => p.person.id)).toEqual(["dadaji", "neha", "rahul", "aarav", "riya"]);
  });

  it("leaves out activities without air data, so there is no headline", () => {
    const env = envFor(bandDay("2030-01-01", "poor"), "2024-11-18T06:10");
    expect(planPerson(DEMO_FAMILY[0], env).headline).toBeNull();
  });
});

describe("familyDay on the recorded days (spec 10.3)", () => {
  it.each([6, 12, 16])("Smog morning at %i:00 has an Avoid and a switch_mode, three home tips and the week line", (hour) => {
    const day = dayFor("smog-morning", hour);
    const plans = day.rows.flatMap((r) => r.items.map((i) => i.plan));
    expect(plans.some((p) => p.verdictAtUsual === "avoid")).toBe(true);
    expect(plans.some((p) => p.suggestion === "switch_mode")).toBe(true);
    expect(day.homeTips).toHaveLength(3);
    expect(day.severeDay).toBe(false);
    expect(day.together).toBe("no_leaf_burning");
    expect(day.week.carTrips).toBe(3);
  });

  it("the Severe day at 6 am is indoor-first with the GRAP note; by 4 pm the Severe hours are past", () => {
    const morning = dayFor("severe-day", 6);
    expect(morning.severeDay).toBe(true);
    expect(morning.rows.find((r) => r.person.id === "riya")?.items.find((i) => i.activity.type === "play")?.plan.suggestion).toBe("indoor");
    expect(dayFor("severe-day", 16).severeDay).toBe(false);
  });

  it("shows no rows, tips or GRAP note without fresh-enough air (spec 8.5)", () => {
    const { s, clock } = at("smog-morning", 6);
    const day = familyDay({
      air: s.air,
      fetchedAt: new Date(clock.now.getTime() - 13 * 3_600_000),
      clock,
      region: "igp",
      people: DEMO_FAMILY,
      viewerId: null,
      home: DEMO_HOME,
      ticks: [],
    });
    expect(day).toMatchObject({
      freshness: "stale",
      rows: [],
      homeTips: [],
      severeDay: false,
      airOutAt: null,
      week: { co2Kg: 0, carTrips: 0 },
    });
  });

  it("airs out without a best window when none is left today (7:10 pm)", () => {
    const env = { air: bandDay("2024-11-18", "poor"), clock: istClock("2024-11-18T19:10") };
    const day = familyDay({
      ...env,
      fetchedAt: env.clock.now,
      region: "igp",
      people: DEMO_FAMILY,
      viewerId: null,
      home: DEMO_HOME,
      ticks: [],
    });
    expect(day.summary.best).toBeNull();
    expect(day.rows.length).toBeGreaterThan(0);
  });

  it("outside the smog months the together action is no idling", () => {
    const env = { air: bandDay("2024-06-10", "moderate"), clock: istClock("2024-06-10T06:10") };
    const day = familyDay({ ...env, fetchedAt: env.clock.now, region: "india", people: [], viewerId: null, home: DEMO_HOME, ticks: [] });
    expect(day.together).toBe("no_idling_signals");
  });
});

describe("kid cards for the demo dependents (spec 10.12) 🔒", () => {
  it.each([
    ["smog-morning", 6],
    ["smog-morning", 16],
    ["severe-day", 6],
    ["severe-day", 12],
  ] as const)("%s at %i:00: kid and teen cards in EN and HI pass every kid-card check", (id, hour) => {
    const day = dayFor(id, hour);
    const now = day.summary.now;
    if (!now) throw new Error("no reading");
    for (const plan of day.rows.filter((r) => r.person.kind === "dependent")) {
      for (const lang of ["en", "hi"] as const) {
        const card = kidCardFor(plan, now.band, lang, day.summary.hour, day.summary.date);
        expect(card.lines).toHaveLength(plan.items.length);
        const text = [card.headline, card.why, ...card.ideas, ...card.lines.map((l) => l.text)].join(" ");
        expect(kidCardProblems(text)).toEqual([]);
      }
    }
  });

  it("picks the kid Why? from the main change", () => {
    const smog = dayFor("smog-morning", 6);
    const riya = smog.rows.find((r) => r.person.id === "riya");
    const aarav = dayFor("severe-day", 16).rows.find((r) => r.person.id === "aarav");
    if (!riya || !aarav) throw new Error("missing");
    expect(kidCardFor(riya, "very_poor", "en", 6, "2024-11-18").why).toMatch(/bus or metro/);
    expect(kidCardFor(aarav, "satisfactory", "en", 16, "2025-01-31").why).toMatch(/sponge/);
    const dadajiLike = { ...riya, person: { ...riya.person, ageGroup: "13to17" as const }, headline: smog.rows[1].headline };
    expect(kidCardFor(dadajiLike, "very_poor", "en", 6, "2024-11-18").why).toMatch(/Cold, still mornings/);
  });
});
