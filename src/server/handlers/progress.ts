import { z } from "zod";
import type { FamilyDay } from "@/domain/family/familyDay";
import type { PersonPlan } from "@/domain/family/people";
import { canTick } from "@/domain/family/permissions";
import { swapOptions } from "@/domain/family/swaps";
import { progressTotals, SWAP_KEY } from "@/domain/impact/progress";
import type { HomeSetup } from "@/domain/libraries/homeSetup";
import type { Mode } from "@/domain/rules/modes";
import { planFamilyToday, UNKNOWN_HOME } from "../app/familyPlan";
import { authorize } from "../auth/guard";
import type { AppDeps } from "../deps";
import { errorResponse, forbidden, notFoundError, privateJson, readJson } from "../http";
import { familyToday, loadFamily, retainedUntil, stillInFamily, type FamilyBundle } from "../repos/family";
import { paths } from "../repos/paths";
import { parsed, progressRecord } from "../repos/records";
import { readUser } from "../repos/users";

/**
 * `POST /api/progress` (spec 5.7, 9.1): ticks one of today's plan items, or the plan's Swap card
 * (`swap:{altId}`, F13), done or not done. The member ticks their own plan; any member ticks a
 * dependent's. The key must be one of that person's activities or a swap code allows them today;
 * the server recomputes the protected hours, CO₂ and car trips from the rules.
 */
const body = z.strictObject({ forId: z.string().min(1).max(64), key: z.string().min(1).max(40), done: z.boolean() });

/** The person a tick is for: a member of the family or one of its dependents. */
function personIn(bundle: FamilyBundle, forId: string) {
  const member = bundle.members.find((m) => m.uid === forId);
  if (member) return { dependent: false, activities: member.record.activities, travel: member.record.travel };
  const child = bundle.dependents.find((d) => d.id === forId);
  return child ? { dependent: true, activities: child.record.activities, travel: child.record.travel } : null;
}

/** Swap id → the mode it switches to (null for a routine or home swap), for the swaps code allows the person today. */
function allowedSwaps(row: PersonPlan | undefined, day: FamilyDay | null, home: HomeSetup): Map<string, Mode | null> {
  if (!row || !day) return new Map();
  return new Map(swapOptions(row.person, day.summary, home, day.severeDay).map((alt) => [`${SWAP_KEY}${alt.id}`, alt.to ?? null]));
}

export async function tickProgress(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, body);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  const { forId, key, done } = input.data;
  const user = await readUser(auth.db, uid);
  const bundle = user?.familyId ? await loadFamily(auth.db, user.familyId) : null;
  if (!bundle?.family.memberUids.includes(uid)) return forbidden("You're no longer in this family.");
  const person = personIn(bundle, forId);
  if (!person) return notFoundError();
  if (!canTick(forId, uid, person.dependent)) return forbidden("Only they can tick their own plan.");
  const { day } = await planFamilyToday(bundle, uid, deps.air);
  const plan = day?.rows.find((r) => r.person.id === forId);
  const swaps = allowedSwaps(plan, day, bundle.homeSetup ?? UNKNOWN_HOME);
  if (!person.activities.some((a) => a.id === key) && !swaps.has(key))
    return errorResponse(400, "unknown_item", "That item isn't in today's plan.");
  const date = familyToday(deps.now());
  const path = paths.progress(bundle.id, date, forId);
  const saved = await auth.db.transaction(async (tx) => {
    if (!(await stillInFamily(tx, bundle.id, uid, forId))) return null;
    const current = parsed(progressRecord, await tx.get(path))?.done ?? {};
    const rest = Object.fromEntries(Object.entries(current).filter(([k]) => k !== key));
    const ticks = done ? { ...rest, [key]: deps.now().toISOString() } : rest;
    const swapsTo = Object.keys(ticks).flatMap((k) => swaps.get(k) ?? []);
    const totals = progressTotals(plan?.items.filter((i) => i.activity.id in ticks) ?? [], person.travel, swapsTo);
    tx.set(path, { forId, date, done: ticks, ...totals, expireAt: retainedUntil(date) });
    return { done: Object.keys(ticks), ...totals };
  });
  return saved ? privateJson(saved) : forbidden("You're no longer in this family.");
}
