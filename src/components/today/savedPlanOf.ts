import type { SavedPlan } from "@/client/savedPlan";
import { formatInstant } from "@/domain/time/instant";
import type { Lang } from "@/i18n/t";
import type { TodayPage } from "@/view/app";
import { rowView } from "../demo/rowView";

/**
 * What Today keeps for the offline "Saved plan" (F24): each row's name, verdict and the line on
 * screen (Gemini's where it passed, else the template), with the times formatted. Never a health
 * tag or a condition; null without a planned day.
 */
export function savedPlanOf(page: TodayPage, lang: Lang): SavedPlan | null {
  const { air, family, words } = page;
  if (!air.day || !air.fetchedAt || air.setupVerdict === null) return null;
  const airAt = formatInstant(new Date(air.fetchedAt), air.timeZone, lang);
  const rows = air.day.rows.flatMap((plan) => {
    const person = family.people.find((p) => p.id === plan.person.id);
    const view = person ? rowView(plan, { ...person, travel: { main: person.mainMode } }, family.viewerUid, lang) : null;
    return view ? [{ name: view.name, verdict: view.verdict, line: words.rows[view.id] ?? view.line }] : [];
  });
  const madeAt = words.source === "gemini" && words.generatedAt ? formatInstant(new Date(words.generatedAt), air.timeZone, lang) : airAt;
  return { lang, place: family.placeName, madeAt, airAt, fetchedAt: air.fetchedAt, rows };
}
