import { yourDay, type YourDay } from "@/domain/impact/yourDay";
import type { AppDeps } from "../deps";
import { planFamilyToday, UNKNOWN_HOME } from "./familyPlan";
import type { Viewer } from "./viewer";

/**
 * Learn (spec 10.11): the generic page for everyone, plus "Your choices today" for a signed-in
 * adult whose plan has a full day of air (code numbers only). Null for everyone else.
 */
export async function loadYourDay(viewer: Viewer, deps: AppDeps): Promise<YourDay | null> {
  if (viewer.kind !== "signed_in" || !viewer.bundle) return null;
  const planned = await planFamilyToday(viewer.bundle, viewer.uid, deps.air);
  const row = planned.day?.rows.find((r) => r.person.id === viewer.uid);
  if (!planned.day || !row) return null;
  const purifier = (viewer.bundle.homeSetup ?? UNKNOWN_HOME).purifier !== "none";
  return yourDay(row, planned.day.summary.index, planned.day.summary.date, purifier && row.group === "extra");
}
