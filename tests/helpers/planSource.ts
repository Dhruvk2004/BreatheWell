import { EVAL_FAMILIES, type EvalFamily } from "@/ai/eval/families";
import { nameWords, planCheck } from "@/ai/plan/check";
import type { PlanSource } from "@/ai/plan/input";
import type { PlanCheck } from "@/ai/plan/validate";
import { recordedScenario } from "@/data/recorded/scenarios";
import { morningWeather } from "@/domain/air/pollutants";
import { familyDay } from "@/domain/family/familyDay";
import { familyLanguages } from "@/domain/family/languages";

/**
 * A plan source for one of the eval families on its recorded day (tests only), built the same way
 * as `evalCase`, so a test can change one part of the day and check what reaches the prompt.
 */
export function familyOf(id: string): EvalFamily {
  const family = EVAL_FAMILIES.find((f) => f.id === id);
  if (!family) throw new Error(`no eval family ${id}`);
  return family;
}

export function sourceOf(id = "two-dependents"): PlanSource {
  const family = familyOf(id);
  const s = recordedScenario(family.scenario);
  const clock = { now: s.scenarioNow, timeZone: "Asia/Kolkata" };
  const { people, home } = family;
  const day = familyDay({ air: s.air, fetchedAt: s.fetchedAt, clock, region: "igp", people, viewerId: null, home, ticks: [] });
  const adults = people.filter((p) => p.kind === "adult");
  return {
    day,
    people,
    languageOf: Object.fromEntries(adults.map((p) => [p.id, p.lang])),
    languages: familyLanguages(adults.map((p, i) => ({ language: p.lang, planned: true, admin: i === 0 }))),
    place: s.placeName,
    home,
    weatherWhy: morningWeather(s.weather, day.summary.date)?.why ?? null,
  };
}

/** Names by id and the forbidden words for a family, as the route passes them. */
export function namesOf(id = "two-dependents"): { byId: Record<string, string>; forbidden: string[] } {
  const { people } = familyOf(id);
  return { byId: Object.fromEntries(people.map((p) => [p.id, p.name])), forbidden: nameWords(people.map((p) => p.name)) };
}

export function checkOf(source: PlanSource, id = "two-dependents"): PlanCheck {
  const { byId, forbidden } = namesOf(id);
  const check = planCheck(source, byId, forbidden);
  if (!check) throw new Error("no plan check");
  return check;
}
