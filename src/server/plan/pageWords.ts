import type { Lang } from "@/domain/time/format";
import type { PlanWords } from "@/view/app";
import type { FamilyPlanDay } from "../app/familyPlan";
import type { AppDeps } from "../deps";
import type { Db } from "../db/types";
import type { FamilyBundle } from "../repos/family";
import { familyToday } from "../repos/family";
import { readStoredPlan } from "../repos/plans";
import { budgetLeft } from "../repos/quota";
import { namesById } from "./context";
import { PLAN_FROM_HOUR } from "./hours";
import { planWords } from "./words";

/**
 * Today's plan words for a page: the stored plan read once, merged over the rules' day.
 * `pending` tells the client to ask for a generation; it is never set without Gemini, before
 * 5 am or once the day's budget is spent (the template is the answer then).
 */
export async function loadPlanWords(db: Db, bundle: FamilyBundle, planned: FamilyPlanDay, deps: AppDeps, lang: Lang): Promise<PlanWords> {
  const day = planned.day;
  const [stored, budget] = await Promise.all([
    readStoredPlan(db, bundle.id, familyToday(deps.now())),
    deps.gemini ? budgetLeft(db, deps.now()) : Promise.resolve(false),
  ]);
  const canGenerate = budget && day !== null && day.rows.length > 0 && day.summary.hour >= PLAN_FROM_HOUR;
  return planWords(stored, day?.rows ?? [], { lang, nameOf: namesById(bundle), canGenerate });
}
