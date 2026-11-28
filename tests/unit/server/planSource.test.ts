import { describe, expect, it } from "vitest";
import type { PersonPlan } from "@/domain/family/people";
import { pageSource, planWords } from "@/server/plan/words";
import { planRecord, sectionRecord, type StoredPlan } from "@/server/repos/planRecords";

/** The "Made by Gemini" line counts swaps and is per page. */
const ctx = { lang: "en" as const, nameOf: { neha: "Neha" }, canGenerate: false };
const stored = (sections: Record<string, object>): StoredPlan => ({
  plan: planRecord.parse({ source: "gemini", generatedAt: "2024-11-18T00:35:00Z", generations: 1, tokens: { m1: "neha" } }),
  sections: Object.fromEntries(Object.entries(sections).map(([id, s]) => [id, sectionRecord.parse(s)])),
});
const row = (id: string) => ({ person: { id }, headline: null, items: [] }) as unknown as PersonPlan;

describe("plan source label", () => {
  it("labels a page that shows only a Gemini swap as Gemini", () => {
    const words = planWords(
      stored({ neha: { swap: { altId: "metro", doThis: { en: "Take the metro instead today." } } } }),
      [row("neha")],
      ctx,
    );
    expect(words.swaps.neha?.doThis).toBe("Take the metro instead today.");
    expect(words.source).toBe("gemini");
    expect(pageSource(words, "neha")).toBe("gemini");
  });

  it("labels another member's page with only template words as the simple plan", () => {
    const words = planWords(
      stored({ neha: { swap: { altId: "metro", doThis: { en: "Take the metro instead today." } } } }),
      [row("neha"), row("dadaji")],
      ctx,
    );
    expect(pageSource(words, "dadaji")).toBe("template");
    expect(pageSource({ ...words, source: "template" }, "neha")).toBe("template");
  });
});
