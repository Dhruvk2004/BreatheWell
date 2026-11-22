import { describe, expect, it } from "vitest";
import { communityTemplate, togetherFor } from "@/ai/community/template";
import { rowLine, tomorrowLine, type RowLineInput } from "@/ai/plan/template";
import { COMMUNITY_ACTIONS } from "@/domain/libraries/alternatives";
import { ACTIVITY_TYPES } from "@/domain/rules/activities";
import { MODES } from "@/domain/rules/modes";
import type { ActivityPlan } from "@/domain/rules/plan";
import { SUGGESTIONS } from "@/domain/rules/plan";
import { BANDS } from "@/domain/air/bands";

const plan = (over: Partial<ActivityPlan> = {}): ActivityPlan => ({
  activityId: "a",
  date: "2024-11-18",
  usualHour: 6,
  verdictAtUsual: "avoid",
  suggestion: "as_planned",
  bestTime: null,
  verdictAtBest: null,
  switchTo: null,
  tomorrowBest: null,
  notes: [],
  ...over,
});

const input = (over: Partial<RowLineInput> = {}): RowLineInput => ({
  type: "morning_walk",
  usual: "06:30",
  mainMode: "walk",
  plan: plan(),
  ...over,
});

describe("row line template (spec 7.2 fallback)", () => {
  it("writes the design's lines from the rule result", () => {
    expect(rowLine(input({ plan: plan({ suggestion: "move_time", bestTime: 15 }) }), "en")).toBe("Walk at 3 pm, not 6:30 am.");
    expect(rowLine(input({ plan: plan({ suggestion: "move_time", bestTime: 15 }) }), "hi")).toBe("सैर दोपहर 3 बजे, सुबह 6:30 बजे नहीं।");
    expect(rowLine(input({ plan: plan({ suggestion: "indoor" }) }), "hi")).toBe("आज सैर घर के अंदर करें, बाहर नहीं।");
    expect(
      rowLine(
        input({
          type: "school_trip",
          usual: "07:00",
          mainMode: "cycle",
          plan: plan({ suggestion: "switch_mode", switchTo: "school_bus" }),
        }),
        "en",
      ),
    ).toBe("Take the school bus at 7 am, not the cycle.");
    expect(
      rowLine(
        input({ type: "office_trip", usual: "08:30", mainMode: "walk", plan: plan({ suggestion: "switch_mode", switchTo: "metro" }) }),
        "en",
      ),
    ).toBe("Take the metro at 8:30 am, not on foot.");
    expect(rowLine(input({ type: "office_trip", usual: "09:00", mainMode: "car", plan: plan({ suggestion: "protect" }) }), "en")).toBe(
      "Car at 9 am: windows up, air on recirculate.",
    );
    expect(rowLine(input({ type: "office_trip", usual: "09:00", mainMode: "metro", plan: plan({ suggestion: "protect" }) }), "en")).toBe(
      "Metro at 9 am: keep a mask handy.",
    );
    expect(rowLine(input({ type: "tuition", usual: "19:00", mainMode: "cycle", plan: plan({ suggestion: "protect" }) }), "hi")).toBe(
      "साइकिल शाम 7 बजे: N95 पहनें, छोटा रास्ता लें।",
    );
    expect(rowLine(input({ type: "sport", usual: "16:00", plan: plan({ suggestion: "protect" }) }), "en")).toBe(
      "Sport at 4 pm, at an easy pace.",
    );
  });

  it.each(
    ACTIVITY_TYPES.flatMap((type) =>
      SUGGESTIONS.flatMap((suggestion) => (["en", "hi"] as const).map((lang) => [type, suggestion, lang] as const)),
    ),
  )("%s × %s × %s fills every slot and has no air numbers", (type, suggestion, lang) => {
    for (const mainMode of MODES) {
      const line = rowLine(
        input({
          type,
          mainMode,
          plan: plan({
            suggestion,
            bestTime: suggestion === "move_time" ? 15 : null,
            switchTo: suggestion === "switch_mode" ? "metro" : null,
          }),
        }),
        lang,
      );
      expect(line).not.toMatch(/[{}]|µg|AQI|undefined/);
      expect(line.length).toBeGreaterThan(8);
      if (lang === "hi") expect(line).toMatch(/[ऀ-ॿ]/);
    }
  });

  it("says tomorrow's better time only when the rule found one", () => {
    expect(tomorrowLine(plan({ tomorrowBest: 15 }), "en")).toBe("Tomorrow 3 pm looks better.");
    expect(tomorrowLine(plan({ tomorrowBest: 15 }), "hi")).toBe("कल दोपहर 3 बजे बेहतर लगता है।");
    expect(tomorrowLine(plan(), "en")).toBeNull();
  });
});

describe("community message template (spec 7.6) 🔒", () => {
  const base = {
    place: "Green Park, Delhi",
    bandWord: "Very poor",
    avg24: 341,
    band: "very_poor" as const,
    best: { start: 14, end: 16 },
    windowDay: "today" as const,
    together: "no_leaf_burning" as const,
    updated: "7:00 am",
  };

  it("puts the numbers only in the code-made header and footer", () => {
    const en = communityTemplate(base, "en");
    expect(en.header).toBe("Air in Green Park, Delhi today: Very poor (24-h average ≈ 341) · Best time outside 2–4 pm");
    expect(en.body).toContain("Children can play after 2 pm.");
    expect(en.together).toContain("no leaf or garbage burning");
    expect(en.footer).toBe("Open-Meteo model data, 7:00 am · Shared via BreatheWell");
    const hi = communityTemplate({ ...base, bandWord: "बहुत खराब", best: null, avg24: 612 }, "hi");
    expect(hi.header).toBe("Green Park, Delhi में आज की हवा: बहुत खराब (24 घंटे का औसत ≈ 500+)");
    expect(hi.body).not.toContain("{play}");
  });

  it("says tomorrow when the best window is tomorrow's (after 9 pm)", () => {
    const en = communityTemplate({ ...base, best: { start: 7, end: 9 }, windowDay: "tomorrow" }, "en");
    expect(en.header).toBe("Air in Green Park, Delhi today: Very poor (24-h average ≈ 341) · Best time outside tomorrow 7–9 am");
    expect(en.body).toContain("Tomorrow, children can play after 7 am.");
    const hi = communityTemplate({ ...base, best: { start: 7, end: 9 }, windowDay: "tomorrow" }, "hi");
    expect(hi.header).toContain("कल बाहर जाने का सबसे अच्छा समय");
    expect(hi.body).toContain("कल बच्चे");
    expect(communityTemplate({ ...base, windowDay: "rest_of_today" }, "en").header).toContain("Best time outside 2–4 pm");
  });

  it.each(
    BANDS.flatMap((band) =>
      COMMUNITY_ACTIONS.flatMap((together) => (["en", "hi"] as const).map((lang) => [band, together, lang] as const)),
    ),
  )("%s × %s × %s never mentions cigarettes", (band, together, lang) => {
    const m = communityTemplate({ ...base, band, together }, lang);
    expect(Object.values(m).join(" ")).not.toMatch(/cigarette|सिगरेट|[{}]/i);
  });

  it("rotates the together action by date", () => {
    expect(togetherFor("2026-11-01", COMMUNITY_ACTIONS)).toBe(COMMUNITY_ACTIONS[1]);
    expect(togetherFor("2026-11-06", COMMUNITY_ACTIONS)).toBe(COMMUNITY_ACTIONS[0]);
  });
});
