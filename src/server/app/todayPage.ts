import { JOIN_CARD_MS } from "@/domain/family/caps";
import { canManageDependent } from "@/domain/family/permissions";
import type { PersonPlan } from "@/domain/family/people";
import { swapOptions } from "@/domain/family/swaps";
import type { FamilyDay } from "@/domain/family/familyDay";
import type { HomeSetup } from "@/domain/libraries/homeSetup";
import type { Lang } from "@/domain/time/format";
import type { MemberPage, PlanSwapView, PlanWords, TodayPage } from "@/view/app";
import { dbOf, type AppDeps } from "../deps";
import { familyToday } from "../repos/family";
import { checklistFor, tickedKeys } from "../repos/items";
import { weekTotals } from "../repos/week";
import { loadPlanWords } from "../plan/pageWords";
import { pageSource } from "../plan/words";
import { familyShareText } from "../plan/share";
import type { InFamily } from "./guards";
import { planFamilyToday, UNKNOWN_HOME } from "./familyPlan";
import { visibleConditions } from "./sharedHealth";
import { airView, familyView } from "./familyView";

/**
 * Today (spec 10.8): the family's day from code at once, the stored Gemini words where they still
 * fit, the "still setting up" rows, the weekly line, the share text and, for the admin, a card for
 * every join with the code in the last day.
 */
export async function loadToday(viewer: InFamily, deps: AppDeps, lang: Lang = "en"): Promise<TodayPage> {
  const db = dbOf(deps);
  const family = familyView(viewer.bundle, viewer.uid);
  const planned = await planFamilyToday(viewer.bundle, viewer.uid, deps.air);
  const [words, week] = await Promise.all([
    loadPlanWords(db, viewer.bundle, planned, deps, lang),
    weekTotals(db, family.id, familyToday(deps.now())),
  ]);
  const air = airView(planned, deps.now());
  const since = deps.now().getTime() - JOIN_CARD_MS;
  const joinCards = family.isAdmin
    ? family.people.flatMap((p) => (p.joinedAt && Date.parse(p.joinedAt) >= since ? [{ uid: p.id, name: p.name, at: p.joinedAt }] : []))
    : [];
  const admin = family.people.find((p) => p.admin);
  const day = air.setupVerdict !== null ? air.day : null;
  const shareText = day ? familyShareText(day, family.people, family.placeName, admin?.language ?? lang) : null;
  const { placeName, lat2, lon2 } = viewer.bundle.family.home;
  const communityHref = `/community?${new URLSearchParams({ place: placeName.slice(0, 80), lat: String(lat2), lon: String(lon2) })}`;
  return { family, air, joinCards, words, week, shareText, communityHref };
}

/** Member plan (spec 10.9): one member's or dependent's plan, checklist and today's ticks; null when unknown. */
export async function loadMember(viewer: InFamily, id: string, deps: AppDeps, lang: Lang = "en"): Promise<MemberPage | null> {
  const family = familyView(viewer.bundle, viewer.uid);
  const person = family.people.find((p) => p.id === id);
  if (!person) return null;
  const db = dbOf(deps);
  const date = familyToday(deps.now());
  const planned = await planFamilyToday(viewer.bundle, viewer.uid, deps.air);
  const [checklist, ticked, conditions, words] = await Promise.all([
    checklistFor(db, family.id, id, date, viewer.user.language),
    tickedKeys(db, family.id, id, date),
    visibleConditions(viewer, id, deps),
    loadPlanWords(db, viewer.bundle, planned, deps, lang),
  ]);
  const air = airView(planned, deps.now());
  const plan = air.day?.rows.find((r) => r.person.id === id) ?? null;
  const canEdit = person.kind === "dependent" && canManageDependent(viewer.bundle.family, person.guardianUid ?? "", viewer.uid);
  const swap = plan && air.day ? swapFor(plan, air.day, viewer.bundle.homeSetup ?? UNKNOWN_HOME, words) : null;
  return { family, person, plan, air, checklist, ticked, canEdit, conditions, words: { ...words, source: pageSource(words, id) }, swap };
}

/** Gemini's swap when it is still one code allows, else the first allowed one; null when none fits. */
function swapFor(plan: PersonPlan, day: FamilyDay, home: HomeSetup, words: PlanWords): PlanSwapView | null {
  const options = swapOptions(plan.person, day.summary, home, day.severeDay);
  const gemini = words.swaps[plan.person.id];
  if (gemini && options.some((o) => o.id === gemini.altId))
    return { altId: gemini.altId, words: { doThis: gemini.doThis, ...(gemini.why ? { why: gemini.why } : {}) } };
  return options[0] ? { altId: options[0].id, words: null } : null;
}
