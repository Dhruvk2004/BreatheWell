import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { conditionsConsistent, toggleConditionTicks } from "@/domain/rules/conditionTicks";
import type { Condition } from "@/domain/rules/groups";
import { dependentInput } from "@/domain/dependents/schema";
import { profileInput } from "@/domain/members/profile";
import { PROFILE, RIYA } from "../../helpers/family";

const ALL: Condition[] = ["asthma", "copd", "heart", "allergies", "pregnant", "not_sure", "none", "prefer_not"];

describe("condition ticks (spec 6.1, 6.2; review fix)", () => {
  it("a stand-alone answer is never mixed with real conditions after a toggle", () => {
    fc.assert(
      fc.property(fc.subarray(ALL), fc.constantFrom(...ALL), (before, tick) => {
        const next = before.includes(tick) ? before.filter((c) => c !== tick) : [...before, tick];
        const consistentBefore = conditionsConsistent(before) ? before : [];
        expect(conditionsConsistent(toggleConditionTicks(next, consistentBefore))).toBe(true);
      }),
    );
  });

  it("the server refuses 'none' together with a condition, for adults and children", () => {
    expect(profileInput.safeParse({ ...PROFILE, conditions: ["none", "asthma"] }).success).toBe(false);
    expect(profileInput.safeParse({ ...PROFILE, conditions: ["prefer_not"] }).success).toBe(true);
    expect(dependentInput.safeParse({ ...RIYA, conditions: ["not_sure", "heart"] }).success).toBe(false);
    expect(dependentInput.safeParse({ ...RIYA, conditions: ["asthma", "heart"] }).success).toBe(true);
  });
});
