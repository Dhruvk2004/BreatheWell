import { describe, expect, it } from "vitest";
import { intensityOf, isEssential, isTravel, spanHours } from "@/domain/rules/activities";
import { contextOn, isWinter, ruleBand, ruleContext, winterCautionApplies } from "@/domain/rules/context";
import { careTagOf, sensitivityGroup } from "@/domain/rules/groups";
import { isEnclosed, isShared, safestSwitch } from "@/domain/rules/modes";
import { istClock } from "../../helpers/air";

describe("sensitivity groups (spec 8.2)", () => {
  it.each([
    ["18to59", [], "everyday"],
    ["18to59", ["prefer_not"], "everyday"],
    ["13to17", ["none"], "everyday"],
    ["under13", [], "sensitive"],
    ["60plus", [], "sensitive"],
    ["18to59", ["pregnant"], "sensitive"],
    ["18to59", ["allergies"], "sensitive"],
    ["13to17", ["not_sure"], "sensitive"],
    ["60plus", ["asthma"], "extra"],
    ["18to59", ["copd"], "extra"],
    ["under13", ["heart"], "extra"],
  ] as const)("%s %j → %s", (age, conditions, group) => {
    expect(sensitivityGroup(age, conditions)).toBe(group);
  });

  it("maps groups to the care tag the family sees", () => {
    expect([careTagOf("everyday"), careTagOf("sensitive"), careTagOf("extra")]).toEqual(["none", "sensitive", "extra"]);
  });
});

describe("activity types (spec 8.2)", () => {
  it("rates trips by mode and other activities by effort and length", () => {
    expect(intensityOf("office_trip", "15to60", "metro")).toBe("light");
    expect(intensityOf("school_trip", "15to60", "cycle")).toBe("moderate");
    expect(intensityOf("tuition", "15to60", "car")).toBe("light");
    expect(intensityOf("sport", "under15", "walk")).toBe("hard");
    expect(intensityOf("errands", "under15", "walk")).toBe("light");
    expect(intensityOf("morning_walk", "15to60", "walk")).toBe("moderate");
    expect(intensityOf("play", "over60", "walk")).toBe("hard");
  });

  it("knows trips, essential trips and spans", () => {
    expect(isTravel("tuition")).toBe(true);
    expect(isEssential("tuition")).toBe(false);
    expect(isEssential("school_trip")).toBe(true);
    expect([spanHours("under15"), spanHours("15to60"), spanHours("over60")]).toEqual([1, 1, 2]);
  });
});

describe("modes and the essential-trip order (spec 8.3 override 1)", () => {
  it("picks shared enclosed modes before the own car", () => {
    expect(safestSwitch("cycle", ["car", "school_bus"])).toBe("school_bus");
    expect(safestSwitch("two_wheeler", ["car", "metro", "carpool"])).toBe("metro");
    expect(safestSwitch("cycle", ["car"])).toBe("car");
    expect(safestSwitch("auto_bus", ["metro"])).toBe("metro");
    expect(safestSwitch("car", ["carpool", "metro"])).toBe("metro");
  });

  it("ranks every open mode together: no switch between them (review slice 1, finding 2)", () => {
    expect(safestSwitch("cycle", ["walk"])).toBeNull();
    expect(safestSwitch("two_wheeler", ["walk"])).toBeNull();
    expect(safestSwitch("walk", ["auto_bus", "auto_van", "cycle"])).toBeNull();
    expect(safestSwitch("auto_van", ["walk", "home"])).toBeNull();
  });

  it("never switches to the same or a less safe mode", () => {
    expect(safestSwitch("metro", ["metro", "car"])).toBeNull();
    expect(safestSwitch("car", ["walk", "cycle"])).toBeNull();
    expect(safestSwitch("cycle", [])).toBeNull();
  });

  it("classifies enclosed and shared modes", () => {
    expect((["metro", "school_bus", "carpool", "car", "home"] as const).every(isEnclosed)).toBe(true);
    expect((["walk", "cycle", "two_wheeler", "auto_bus", "auto_van"] as const).some(isEnclosed)).toBe(false);
    expect(isShared("metro")).toBe(true);
    expect(isShared("car")).toBe(false);
  });
});

describe("winter caution (spec 8.3 override 4)", () => {
  it("covers 1 Nov to the end of February, 29 Feb included", () => {
    expect([10, 11, 12, 1, 2, 3].map(isWinter)).toEqual([false, true, true, true, true, false]);
  });

  it("re-dates the context to the planned day", () => {
    const ctx = ruleContext(istClock("2025-02-28T22:00"), "igp", false);
    expect(contextOn(ctx, "2025-03-01")).toEqual({ ...ctx, month: 3 });
  });

  it("makes Extra care one band stricter in the Indo-Gangetic Plain without a station", () => {
    const winter = ruleContext(istClock("2024-11-18T06:10"), "igp", false);
    expect(ruleBand("moderate", "extra", winter)).toBe("poor");
    expect(ruleBand("moderate", "sensitive", winter)).toBe("moderate");
    expect(winterCautionApplies("extra", { ...winter, hasStation: true })).toBe(false);
    expect(winterCautionApplies("extra", { ...winter, region: "india" })).toBe(false);
    expect(winterCautionApplies("extra", ruleContext(istClock("2024-07-01T06:00"), "igp", false))).toBe(false);
  });
});
