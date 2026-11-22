import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BANDS, bandRank } from "@/domain/air/bands";
import type { Intensity } from "@/domain/rules/activities";
import type { Group } from "@/domain/rules/groups";
import { verdict, verdictRank, worstVerdict, type Verdict } from "@/domain/rules/verdict";

/** Spec 8.3, copied as text so the test reads like the table it checks. */
const SPEC_TABLE = `
good          | Go Go Go       | Go Go Go          | Go Go Go
satisfactory  | Go Go Go       | Go Go Go          | Go Go Care
moderate      | Go Go Go       | Go Go Care        | Go Care Avoid
poor          | Go Care Care   | Care Care Avoid   | Care Avoid Avoid
very_poor     | Care Care Avoid| Care Avoid Avoid  | Avoid Avoid Avoid
severe        | Care Avoid Avoid| Avoid Avoid Avoid| Avoid Avoid Avoid`;

const GROUPS: Group[] = ["everyday", "sensitive", "extra"];
const INTENSITIES: Intensity[] = ["light", "moderate", "hard"];
const WORD: Record<string, Verdict> = { Go: "go", Care: "care", Avoid: "avoid" };

const cells = SPEC_TABLE.trim()
  .split("\n")
  .flatMap((line) => {
    const [band, ...groups] = line.split("|").map((s) => s.trim());
    return groups.flatMap((g, gi) => g.split(/\s+/).map((w, ii) => [band, GROUPS[gi], INTENSITIES[ii], WORD[w]] as const));
  });

describe("the guardrail table (spec 8.3)", () => {
  it("has all 54 cells", () => expect(cells).toHaveLength(54));

  it.each(cells)("%s × %s × %s → %s", (band, group, intensity, expected) => {
    expect(verdict(band as (typeof BANDS)[number], group, intensity)).toBe(expected);
  });

  it("never gets more lenient as the band, the group or the effort gets worse (property)", () => {
    const band = fc.constantFrom(...BANDS);
    const group = fc.integer({ min: 0, max: 2 });
    const effort = fc.integer({ min: 0, max: 2 });
    fc.assert(
      fc.property(band, band, group, group, effort, effort, (b1, b2, g1, g2, e1, e2) => {
        const [lo, hi] = bandRank(b1) <= bandRank(b2) ? [b1, b2] : [b2, b1];
        const a = verdict(lo, GROUPS[Math.min(g1, g2)], INTENSITIES[Math.min(e1, e2)]);
        const b = verdict(hi, GROUPS[Math.max(g1, g2)], INTENSITIES[Math.max(e1, e2)]);
        expect(verdictRank(b)).toBeGreaterThanOrEqual(verdictRank(a));
      }),
    );
  });
});

describe("verdict helpers", () => {
  it("ranks and combines verdicts", () => {
    expect(["go", "care", "avoid"].map((v) => verdictRank(v as Verdict))).toEqual([0, 1, 2]);
    expect(worstVerdict(["go", "care"])).toBe("care");
    expect(worstVerdict(["care", "avoid", "go"])).toBe("avoid");
    expect(worstVerdict([])).toBe("go");
  });
});
