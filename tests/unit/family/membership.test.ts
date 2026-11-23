import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { firstName, initialsOf, MAX_ADULTS, MAX_DEPENDENTS } from "@/domain/family/caps";
import { familyPatch, storedHome } from "@/domain/family/home";
import { CODE_ALPHABET, codeRecord, codeState, formatCode, newJoinCode, normaliseCode } from "@/domain/family/joinCode";
import { canDeleteItem, canManageDependent, canTick, isAdmin, mustStay } from "@/domain/family/permissions";
import { settingUpVerdict, TAG_CONDITIONS } from "@/domain/family/tags";
import { bandOf, memberActivities, storedProfileOf } from "@/domain/members/profile";
import { quickProfile } from "@/domain/members/quickPath";
import { careTagOf, sensitivityGroup } from "@/domain/rules/groups";
import { PROFILE } from "../../helpers/family";

const NOW = new Date("2026-11-21T12:40:00Z");

describe("join codes (spec 5.3, 11.2)", () => {
  it("draws 8 unambiguous symbols uniformly from secure random bytes", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 16, maxLength: 16 }), (bytes) => {
        let calls = 0;
        const code = newJoinCode(() => (calls++ === 0 ? bytes : new Uint8Array(16).fill(7)));
        expect(code).toHaveLength(8);
        expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
        expect(code).not.toMatch(/[01OIL]/);
      }),
    );
    expect(CODE_ALPHABET).toHaveLength(31);
  });

  it("reads codes in any case, with or without the hyphen, and shows them as K7PM-4QXT", () => {
    const symbol = fc.constantFrom(...CODE_ALPHABET);
    fc.assert(
      fc.property(fc.array(symbol, { minLength: 8, maxLength: 8 }), (symbols) => {
        const code = symbols.join("");
        expect(normaliseCode(formatCode(code).toLowerCase())).toBe(code);
      }),
    );
    expect(normaliseCode("k7pm 4qxt")).toBe("K7PM4QXT");
    expect(normaliseCode("K7PM4QX0")).toBeNull();
    expect(normaliseCode("K7PM")).toBeNull();
  });

  it("is valid for 24 h and 8 joins, and never once replaced", () => {
    const record = codeRecord(NOW);
    expect(codeState(record, NOW)).toBe("valid");
    expect(codeState(record, new Date(NOW.getTime() + 24 * 3_600_000))).toBe("expired");
    expect(codeState({ ...record, uses: 8 }, NOW)).toBe("expired");
    expect(codeState({ ...record, active: false }, NOW)).toBe("expired");
  });
});

describe("permissions (spec 9.3)", () => {
  const family = { adminUid: "neha", memberUids: ["neha", "rahul"] };
  it("guardian or admin manages a dependent; any member ticks a dependent; deletes by four people", () => {
    expect(isAdmin(family, "neha")).toBe(true);
    expect(canManageDependent(family, "rahul", "rahul")).toBe(true);
    expect(canManageDependent(family, "rahul", "neha")).toBe(true);
    expect(canManageDependent(family, "rahul", "dadaji")).toBe(false);
    expect(canTick("d1", "rahul", true)).toBe(true);
    expect(canTick("neha", "rahul", false)).toBe(false);
    const item = { forId: "d1", addedBy: "dadaji" };
    expect(["dadaji", "rahul", "neha"].map((uid) => canDeleteItem(family, item, "rahul", uid))).toEqual([true, true, true]);
    expect(canDeleteItem(family, item, "rahul", "aunt")).toBe(false);
    expect(mustStay(family, "neha")).toBe(true);
    expect(mustStay({ ...family, memberUids: ["neha"] }, "neha")).toBe(false);
    expect([MAX_ADULTS, MAX_DEPENDENTS]).toEqual([6, 4]);
  });
});

describe("names, home and profiles (spec 6.1, 6.5)", () => {
  it("makes initials and first names without the full name", () => {
    expect(initialsOf("Neha Sharma")).toBe("NS");
    expect(initialsOf("दादाजी")).toBe("द");
    expect(initialsOf("  ")).toBe("");
    expect(firstName(" Ramesh Kumar ")).toBe("Ramesh");
  });

  it("rounds the home to 2 decimals with its 0.1° cell", () => {
    fc.assert(
      fc.property(fc.double({ min: 6, max: 37, noNaN: true }), fc.double({ min: 68, max: 98, noNaN: true }), (lat, lon) => {
        const home = storedHome({ name: "Somewhere", lat, lon, countryCode: "IN" });
        expect(Math.abs(home.lat2 - lat)).toBeLessThanOrEqual(0.005 + 1e-9);
        expect(home.gridId).toMatch(/^\d+(\.\d)?_\d+(\.\d)?$/);
      }),
    );
    expect(familyPatch.safeParse({}).success).toBe(false);
  });

  it("stores the tag, never the conditions; the quick path fills defaults", () => {
    const stored = storedProfileOf({ ...PROFILE, conditions: ["asthma"], travel: { ...PROFILE.travel, others: ["metro", "two_wheeler"] } });
    expect(stored).toEqual({
      ageGroup: "18to59",
      careTag: "extra",
      activities: memberActivities(PROFILE.activities),
      travel: { main: "two_wheeler", tripLength: "15to45", others: ["metro"] },
    });
    expect(bandOf("15:00")).toBe("afternoon");
    expect(bandOf("09:15")).toBe("morning");
    const quick = quickProfile({
      name: "दादाजी",
      language: "hi",
      conditions: ["asthma"],
      shareWith: "self",
      walk: "evening",
      travel: "home",
    });
    expect(quick).toMatchObject({
      ageGroup: "60plus",
      activities: [{ type: "evening_walk", band: "evening", flex: "any" }],
      travel: { main: "home", tripLength: "under15" },
    });
    expect(quickProfile({ ...quick, walk: "none", travel: "metro" }).activities).toEqual([]);
  });

  it("plans a tagged member exactly like the conditions behind the tag, at every age", () => {
    for (const ageGroup of ["18to59", "60plus"] as const)
      for (const conditions of [[], ["asthma"], ["allergies"], ["pregnant"]] as const) {
        const tag = careTagOf(sensitivityGroup(ageGroup, conditions));
        expect(sensitivityGroup(ageGroup, TAG_CONDITIONS[tag])).toBe(sensitivityGroup(ageGroup, conditions));
      }
    const ctx = { month: 11, region: "igp" as const, hasStation: false };
    expect(settingUpVerdict("good", ctx)).toBe("go");
    expect(settingUpVerdict("very_poor", ctx)).toBe("avoid");
  });
});
