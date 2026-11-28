import { nameWords, planCheck } from "@/ai/plan/check";
import type { PlanCheck } from "@/ai/plan/validate";
import { morningWeather } from "@/domain/air/pollutants";
import { cityAt, regionAt } from "@/domain/geo/cities";
import { familyLanguages as languagesOf } from "@/domain/family/languages";
import type { Lang } from "@/domain/time/format";
import { plannedPeople, UNKNOWN_HOME, type FamilyPlanDay } from "../app/familyPlan";
import type { FamilyBundle } from "../repos/family";

/**
 * Turns the family and the rules' day into the pseudonymised plan request and its checks.
 * Names stay here, on the server: they go only to the validator, which rejects any reply
 * that uses one, and fill the `{m1}` tokens when a page renders.
 */
export function namesById(bundle: FamilyBundle): Record<string, string> {
  return Object.fromEntries([
    ...bundle.members.map((m) => [m.uid, m.record.name] as const),
    ...bundle.dependents.map((d) => [d.id, d.record.name] as const),
  ]);
}

/** Every name, each word of it and the family name's words: none may appear in Gemini's text. */
export const forbiddenNames = (bundle: FamilyBundle): string[] => nameWords([...Object.values(namesById(bundle)), bundle.family.name]);

/** The languages the family uses: each planned adult's plus the admin's. */
export const familyLanguages = (bundle: FamilyBundle): Lang[] =>
  languagesOf(
    bundle.members.map((m) => ({ language: m.record.language, planned: m.record.onboarded, admin: m.uid === bundle.family.adminUid })),
  );

/**
 * The place as Gemini sees it (no raw user free text): the listed city of the home's grid
 * cell, else only the country. The admin-typed place name never reaches the prompt.
 */
export function promptPlace(home: FamilyBundle["family"]["home"]): string {
  const city = cityAt(home.lat2, home.lon2);
  if (city) return city.name;
  return regionAt(home.lat2, home.lon2, home.countryCode) === "outside_india" ? "outside India" : "India";
}

/** The request and checks for today's generation; null without a planned day. */
export function planCheckFor(bundle: FamilyBundle, planned: FamilyPlanDay): PlanCheck | null {
  const { day, snapshot } = planned;
  if (!day || !snapshot) return null;
  const languageOf = Object.fromEntries(bundle.members.map((m) => [m.uid, m.record.language]));
  const source = {
    day,
    people: plannedPeople(bundle),
    languageOf,
    languages: familyLanguages(bundle),
    place: promptPlace(bundle.family.home),
    home: bundle.homeSetup ?? UNKNOWN_HOME,
    weatherWhy: morningWeather(snapshot.weather, day.summary.date)?.why ?? null,
  };
  return planCheck(source, namesById(bundle), forbiddenNames(bundle));
}
