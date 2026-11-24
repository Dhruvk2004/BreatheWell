import { kidCardFor } from "@/domain/family/kidCardFor";
import { kidShareText } from "@/domain/libraries/kid";
import type { KidCardPage } from "@/view/app";
import { dbOf, type AppDeps } from "../deps";
import { familyToday } from "../repos/family";
import { checklistFor, tickedKeys } from "../repos/items";
import type { InFamily } from "./guards";
import { planFamilyToday } from "./familyPlan";
import { familyView } from "./familyView";

/**
 * A dependent's kid card for the family's adults: the rules' plan in kid words, in
 * the card language, with the checklist items that pass the kid-card checks and today's ticks (any
 * adult in the family ticks a dependent's items, spec 5.5 step 7). Null for an id that
 * is not one of the family's dependents; `kid` is null without fresh air data.
 */
export async function loadKidCard(viewer: InFamily, id: string, deps: AppDeps): Promise<KidCardPage | null> {
  const person = familyView(viewer.bundle, viewer.uid).people.find((p) => p.id === id && p.kind === "dependent");
  if (!person) return null;
  const lang = person.language;
  const date = familyToday(deps.now());
  const [planned, checklist, done] = await Promise.all([
    planFamilyToday(viewer.bundle, viewer.uid, deps.air),
    checklistFor(dbOf(deps), viewer.bundle.id, id, date, lang),
    tickedKeys(dbOf(deps), viewer.bundle.id, id, date),
  ]);
  const plan = planned.day?.rows.find((r) => r.person.id === id);
  const now = planned.day?.summary.now;
  if (!plan || !now || !planned.day) return { kid: null, person, lang };
  const card = kidCardFor(plan, now.band, lang, planned.day.summary.hour, planned.day.summary.date);
  const shareText = kidShareText(person.name, now.band, card, lang);
  const onCard = checklist.filter((c) => c.onCard);
  return { kid: { name: person.name, band: now.band, card, plan, shareText, checklist: onCard, ticks: { forId: id, done } }, person, lang };
}
