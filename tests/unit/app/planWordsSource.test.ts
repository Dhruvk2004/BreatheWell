import { describe, expect, it } from "vitest";
import { pictureFor } from "@/components/member/PlanItems";
import { planWords } from "@/server/plan/words";
import { planRecord, sectionRecord, type StoredPlan } from "@/server/repos/planRecords";

/** The source label follows every Gemini sentence on screen (design: Monsoon blue marks AI text). */
const ctx = { lang: "en" as const, nameOf: { neha: "Neha" }, canGenerate: false };
const stored = (plan: object, sections: Record<string, object> = {}): StoredPlan => ({
  plan: planRecord.parse({ source: "gemini", generatedAt: "2024-11-18T00:35:00Z", generations: 1, ...plan }),
  sections: Object.fromEntries(Object.entries(sections).map(([id, s]) => [id, sectionRecord.parse(s)])),
});

describe("planWords source (M5)", () => {
  it("says 'gemini' when only a home tip passed", () => {
    const words = planWords(stored({ home: [{ tipId: "shut_windows", doThis: { en: "Keep windows shut till noon." } }] }), [], ctx);
    expect(words.source).toBe("gemini");
    expect(words.home.shut_windows.doThis).toBe("Keep windows shut till noon.");
  });

  it("says 'gemini' when only Help the air passed, and 'template' when nothing is left to show", () => {
    expect(planWords(stored({ together: { altId: "no_idling_signals", doThis: { en: "No idling at signals." } } }), [], ctx).source).toBe(
      "gemini",
    );
    const gone = stored({ tokens: { m1: "rahul" }, together: { altId: "no_idling_signals", doThis: { en: "{m1}: no idling." } } });
    expect(planWords(gone, [], ctx)).toMatchObject({ source: "template", together: null });
    expect(planWords(stored({ home: [{ tipId: "x", doThis: { hi: "खिड़कियाँ बंद रखें।" } }] }), [], ctx).source).toBe("template");
  });

  it("keeps Gemini's why with the fact it explains, and a page shows it only under that fact (M6)", () => {
    const plan = stored(
      { tokens: { m1: "neha" } },
      { neha: { swap: { altId: "a", doThis: { en: "Swap." }, why: { en: "Why." }, factId: "f1" } } },
    );
    const words = planWords(plan, [], ctx);
    expect(words.swaps).toEqual({});
    expect(pictureFor({ doThis: "x", why: "Gemini's why", factId: "metro_exposure" }, "metro_exposure")).toBe("Gemini's why");
    expect(pictureFor({ doThis: "x", why: "Gemini's why", factId: "morning_inversion" }, "metro_exposure")).toBeUndefined();
    expect(pictureFor({ doThis: "x", why: "Gemini's why" }, "metro_exposure")).toBeUndefined();
    expect(pictureFor(undefined, "metro_exposure")).toBeUndefined();
  });
});
