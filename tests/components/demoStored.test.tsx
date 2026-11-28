import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoFamily } from "@/components/demo/DemoFamily";
import { generatePlan } from "@/ai/plan/generate";
import { checkField, ruleFactsOf, type FieldContext } from "@/ai/plan/fields";
import { allowedTimes } from "@/ai/plan/validate";
import { DEMO_FAMILY } from "@/data/demo/family";
import { storedDemoPlanFor, storedDemoPlans } from "@/data/demo/storedPlans";
import { SCENARIO_IDS } from "@/data/recorded/scenarios";
import { demoPlanCheck, demoWords, storedEntry } from "@/server/demo/demoPlan";
import { recordedDemo } from "@/server/demo/demoPage";
import { planResult } from "@/server/plan/run";
import { planWords } from "@/server/plan/words";
import { fakeModel, validReply } from "../helpers/planReply";

/**
 * The demo's stored 6 am Gemini plans. Until a key exists
 * the file is empty and the demo says "Simple plan"; once `npm run demo:record-plans` has run,
 * every stored line is re-checked here against that scenario's rules.
 */
describe("stored demo plans", () => {
  it("every stored demo plan line passes the plan validator against that scenario's rule results", () => {
    for (const [scenario, entry] of storedDemoPlans()) {
      const data = recordedDemo(scenario, 6, "neha");
      const check = demoPlanCheck(data.day, data.weather);
      if (!check) throw new Error(`no plan for ${scenario}`);
      const ctx: FieldContext = {
        languages: entry.plan.languages,
        allowedTimes: allowedTimes(check.request),
        names: check.names,
        nameOf: check.nameOf,
      };
      for (const [token, id] of Object.entries(check.request.tokens.people)) {
        const person = check.request.input.members.find((m) => m.id === token);
        const section = entry.sections[id];
        if (!person || !section) continue;
        for (const [activityId, item] of Object.entries(section.items)) {
          const activity = person.activities.find((a) => check.request.tokens.activities[a.id].activityId === activityId);
          if (!activity) throw new Error(`${scenario}: ${activityId} is no longer planned`);
          const spec = { cap: "doThis" as const, forDependent: token.startsWith("d"), rule: ruleFactsOf(activity) };
          expect(checkField(item.doThis, spec, ctx).reasons, `${scenario} ${activityId}`).toEqual([]);
        }
      }
    }
    expect(storedDemoPlans().length).toBeLessThanOrEqual(SCENARIO_IDS.length);
  });

  it("without a stored plan the demo keeps the template, labelled Simple plan (never hand-written AI text)", () => {
    for (const scenario of SCENARIO_IDS) {
      if (storedDemoPlanFor(scenario)) continue;
      const data = recordedDemo(scenario, 6, "neha");
      expect(data.words.en.source).toBe("template");
      expect(data.storedPlan).toBe(false);
    }
    expect(storedDemoPlanFor("live")).toBeNull();
  });

  it("at 6 am a recorded scenario shows its stored Gemini plan labelled 'Made by BreatheWell assistant'", async () => {
    const data = recordedDemo("smog-morning", 6, "neha");
    const check = demoPlanCheck(data.day, data.weather);
    if (!check) throw new Error("no plan");
    const generated = await generatePlan(check, {
      model: fakeModel(() => JSON.stringify(validReply(check.request))),
      now: () => 0,
      reserve: async () => true,
    });
    const entry = storedEntry(planResult(generated, check, data.day.rows, new Date("2026-11-24T00:30:00Z")), "fake-gemini");
    expect(entry.plan).toMatchObject({ source: "gemini", generations: 1, languages: ["en", "hi"] });
    const nameOf = (lang: "en" | "hi") => Object.fromEntries(DEMO_FAMILY.map((p) => [p.id, p.name[lang]]));
    const words = (lang: "en" | "hi") => planWords(entry, data.day.rows, { lang, nameOf: nameOf(lang), canGenerate: false });
    const { unmount } = render(<DemoFamily data={{ ...data, words: { en: words("en"), hi: words("hi") }, storedPlan: true }} lang="en" />);
    expect(
      screen.getByText("Made by BreatheWell assistant (Google Gemini), stored for this 6 am · checked by safety rules"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Dadaji: /).length).toBeGreaterThan(0);
    unmount();
    const later = recordedDemo("smog-morning", 16, "neha");
    render(<DemoFamily data={{ ...later, storedPlan: true }} lang="en" />);
    expect(screen.getByText("Simple plan · the assistant's plan was written for 6 am")).toBeInTheDocument();
    expect(demoWords(later.query, later.day, "en").source).toBe("template");
  });
});
