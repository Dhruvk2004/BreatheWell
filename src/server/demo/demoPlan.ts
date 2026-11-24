import { nameWords, planCheck } from "@/ai/plan/check";
import type { PlanCheck } from "@/ai/plan/validate";
import { DEMO_FAMILY, DEMO_HOME } from "@/data/demo/family";
import type { DemoQuery } from "@/data/demo/query";
import { storedDemoPlanFor, type StoredDemoPlan } from "@/data/demo/storedPlans";
import { morningWeather } from "@/domain/air/pollutants";
import type { HourlyWeather } from "@/domain/air/weatherWhy";
import type { FamilyDay } from "@/domain/family/familyDay";
import type { Lang } from "@/domain/time/format";
import type { PlanWords } from "@/view/app";
import { planRecord } from "../repos/planRecords";
import type { PlanResult } from "../repos/plans";
import { planWords } from "../plan/words";
import { PLAN_PROMPT_VERSION } from "@/ai/plan/prompt";

/** The Sharma family lives in Green Park. */
export const DEMO_PLACE = "Green Park, New Delhi";

/** The stored plan was written for the 6 am stepper position only. */
export const STORED_PLAN_HOUR = 6;

/**
 * The demo family's plan request, exactly as a real family's: used by the recorder
 * script to write the stored 6 am plans and by the tests that re-check every stored line.
 */
export function demoPlanCheck(day: FamilyDay, weather: HourlyWeather): PlanCheck | null {
  const nameById = Object.fromEntries(DEMO_FAMILY.map((p) => [p.id, p.name.en]));
  return planCheck(
    {
      day,
      people: DEMO_FAMILY,
      languageOf: Object.fromEntries(DEMO_FAMILY.filter((p) => p.kind === "adult").map((p) => [p.id, p.lang])),
      languages: ["en", "hi"],
      place: DEMO_PLACE,
      home: DEMO_HOME,
      weatherWhy: morningWeather(weather, day.summary.date)?.why ?? null,
    },
    nameById,
    nameWords(DEMO_FAMILY.flatMap((p) => [p.name.en, p.name.hi])),
  );
}

/**
 * The demo's words: the stored Gemini plan at 6 am on a recorded scenario, the template otherwise
 * (Live today and the later stepper times never call Gemini). Never generates.
 */
export function demoWords(query: DemoQuery, day: FamilyDay, lang: Lang): PlanWords {
  const stored = query.time === STORED_PLAN_HOUR ? storedDemoPlanFor(query.scenario) : null;
  const nameOf = Object.fromEntries(DEMO_FAMILY.map((p) => [p.id, p.name[lang]]));
  return planWords(stored, day.rows, { lang, nameOf, canGenerate: false });
}

/** True when the scenario has a stored plan (12 pm and 4 pm then say it was written for 6 am). */
export const hasStoredPlan = (query: DemoQuery): boolean => storedDemoPlanFor(query.scenario) !== null;

/** The stored-plan entry the recorder writes for one scenario (a Gemini result only). */
export function storedEntry(result: PlanResult, model: string): StoredDemoPlan {
  const plan = planRecord.parse({
    ...result.doc,
    source: result.source,
    outcome: result.outcome,
    generatedAt: result.now.toISOString(),
    generations: 1,
  });
  return { recordedOn: result.now.toISOString(), model, promptVersion: PLAN_PROMPT_VERSION, plan, sections: result.sections };
}
