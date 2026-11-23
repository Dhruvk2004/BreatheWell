import { describe, expect, it } from "vitest";
import { kidCard, kidCardProblems, type KidItem } from "@/domain/libraries/kid";
import type { ActivityPlan, Suggestion } from "@/domain/rules/plan";

const plan = (suggestion: Suggestion, extra: Partial<ActivityPlan> = {}): ActivityPlan => ({
  activityId: "x",
  date: "2024-11-18",
  usualHour: 7,
  verdictAtUsual: "avoid",
  suggestion,
  bestTime: null,
  verdictAtBest: null,
  switchTo: null,
  tomorrowBest: null,
  notes: [],
  ...extra,
});

describe("twin activity labels (stage 8 QA8-4)", () => {
  const school = (usualHour: number, suggestion: Suggestion): KidItem => ({
    type: "school_trip",
    plan: plan(suggestion, { usualHour, switchTo: suggestion === "switch_mode" ? "school_bus" : null }),
    mainMode: "walk",
  });
  const play: KidItem = { type: "play", plan: plan("protect"), mainMode: "walk" };

  it("adds the usual clock time only when two rows share a label, and still passes the kid checks", () => {
    for (const lang of ["en", "hi"] as const) {
      const card = kidCard({
        band: "very_poor",
        tone: "kid",
        lang,
        hour: 6,
        date: "2024-11-18",
        items: [school(7, "switch_mode"), school(13, "protect"), play],
        factId: null,
      });
      const [there, back, other] = card.lines.map((l) => l.label);
      expect(there).not.toBe(back);
      expect(there).toContain(lang === "en" ? "7 am" : "7 बजे");
      expect(back).toContain(lang === "en" ? "1 pm" : "1 बजे");
      expect(other).not.toContain("·");
      for (const line of card.lines) expect(kidCardProblems(`${line.label} ${line.text}`)).toEqual([]);
    }
  });
});
