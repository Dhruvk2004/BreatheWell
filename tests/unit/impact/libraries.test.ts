import { describe, expect, it } from "vitest";
import { FACTS, factById, isFactId } from "@/domain/impact/facts";
import { devanagariShare } from "@/ai/shared/language";
import { alternativeById, eligibleAlternatives, type AlternativeContext } from "@/domain/libraries/alternatives";
import { ALTERNATIVES } from "@/domain/libraries/alternativesData";
import type { HomeSetup } from "@/domain/libraries/homeSetup";
import { bandTips, homeTips, tipById, TIPS } from "@/domain/libraries/tips";

const HOME: HomeSetup = {
  purifier: "one_room",
  freshAirVent: false,
  roadFacing: "yes",
  fuel: "lpg",
  incense: "daily",
  indoorSmoking: "no",
};

describe("facts library", () => {
  it("has about 25 facts with unique ids, both languages and an https source", () => {
    expect(FACTS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length);
    for (const f of FACTS) {
      expect(devanagariShare(f.text.hi), f.id).toBeGreaterThanOrEqual(0.6);
      expect(devanagariShare(f.text.en), f.id).toBe(0);
      expect(f.level3.hi.length, f.id).toBeGreaterThan(0);
      expect(f.source.url, f.id).toMatch(/^https:\/\//);
    }
  });

  it("keeps cigarette numbers out of the level-2 text", () => {
    for (const f of FACTS) expect(f.text.en, f.id).not.toMatch(/\d+\s*cigarettes?/i);
  });

  it("looks facts up and every tip and alternative points at a real fact", () => {
    expect(factById("morning_inversion")?.source.name).toContain("SAFAR");
    expect(isFactId("nope")).toBe(false);
    for (const item of [...TIPS, ...ALTERNATIVES]) expect(isFactId(item.factId), item.id).toBe(true);
  });
});

describe("home tips", () => {
  it("gives three band tips for Air now", () => {
    expect(bandTips("good", null)).toEqual(["open_windows_clean", "wet_mop", "chimney_on"]);
    expect(bandTips("moderate", 15)).toEqual(["air_out_best_hour", "wet_mop", "chimney_on"]);
    expect(bandTips("moderate", null)[0]).toBe("keep_windows_shut");
    expect(bandTips("very_poor", 15)).toEqual(["shut_windows_till_noon", "air_out_best_hour", "no_incense_coils"]);
    expect(bandTips("severe", null)).toEqual(["keep_windows_shut", "no_incense_coils", "chimney_on"]);
  });

  it("fits the family's set-up without repeats", () => {
    const smoky: HomeSetup = { ...HOME, purifier: "none", fuel: "solid", indoorSmoking: "yes", freshAirVent: true, incense: "never" };
    const ids = homeTips(smoky, "very_poor", 15);
    expect(ids.slice(0, 2)).toEqual(["smoke_outside", "lpg_over_solid"]);
    expect(ids).toContain("make_clean_room");
    expect(ids).toContain("vent_recirculate");
    expect(ids).not.toContain("no_incense_coils");
    expect(new Set(ids).size).toBe(ids.length);
    expect(homeTips(HOME, "poor", null)).toContain("purifier_clean_room");
  });

  it("has the airing slot only where code fills it", () => {
    expect(tipById("air_out_best_hour").text.en).toContain("{time}");
    expect(tipById("air_out_best_hour").text.hi).toContain("{time}");
  });
});

describe("alternatives library", () => {
  const ctx: AlternativeContext = {
    main: "two_wheeler",
    options: ["metro"],
    tripLength: "15to45",
    activities: ["office_trip"],
    home: HOME,
    bestBand: "poor",
    severeDay: false,
  };
  const ids = (c: AlternativeContext) => eligibleAlternatives(c).map((a) => a.id);

  it("offers only swaps to modes the person has", () => {
    expect(ids(ctx)).toContain("metro_for_scooter");
    expect(ids({ ...ctx, options: [] })).not.toContain("metro_for_scooter");
    expect(ids(ctx)).not.toContain("metro_for_car");
  });

  it("cycles only short trips in clean hours, and suggests home working only on Severe days", () => {
    const short = { ...ctx, main: "car" as const, options: ["cycle" as const], tripLength: "under15" as const };
    expect(ids({ ...short, bestBand: "moderate" })).toContain("cycle_clean_hours");
    expect(ids({ ...short, bestBand: "poor" })).not.toContain("cycle_clean_hours");
    expect(ids({ ...short, tripLength: "15to45", bestBand: "good" })).not.toContain("cycle_clean_hours");
    expect(ids(ctx)).not.toContain("wfh_severe_day");
    expect(ids({ ...ctx, severeDay: true })).toContain("wfh_severe_day");
  });

  it("uses the home set-up for home swaps", () => {
    expect(ids(ctx)).toContain("electric_repellent");
    expect(ids({ ...ctx, home: null })).not.toContain("electric_repellent");
    expect(ids({ ...ctx, home: { ...HOME, fuel: "solid" } })).toContain("lpg_over_solid_fuel");
    expect(ids({ ...ctx, activities: ["errands"] })).toContain("combine_errands");
    expect(alternativeById("carpool_office")?.to).toBe("carpool");
    expect(alternativeById("nope")).toBeUndefined();
  });

  it("writes every alternative in both languages", () => {
    for (const alt of ALTERNATIVES)
      for (const field of [alt.doThis, alt.forYou, alt.forAir]) expect(devanagariShare(field.hi), alt.id).toBeGreaterThanOrEqual(0.6);
  });
});
