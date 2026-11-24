import type { Db } from "../db/types";
import { retainedUntil } from "./family";
import { paths } from "./paths";
import { planRecord, sectionRecord, type PlanRecord, type SectionRecord, type StoredPlan } from "./planRecords";
import { parsed } from "./records";

/**
 * Plan storage: read today's plan, take the generation lock, save the result.
 * No timers: a plan is (re)generated only when someone opens Today and it is missing or stale.
 */
export const LOCK_MS = 40_000;
export const MAX_GENERATIONS = 3;

/** Today's plan and its sections; null when nobody has opened Today yet. */
export async function readStoredPlan(db: Db, fid: string, date: string): Promise<StoredPlan | null> {
  const [doc, sectionDocs] = await Promise.all([db.get(paths.plan(fid, date)), db.query(paths.planSections(fid, date))]);
  const plan = parsed(planRecord, doc);
  if (!plan) return null;
  const sections = Object.fromEntries(
    sectionDocs.flatMap(({ id, data }) => {
      const section = parsed(sectionRecord, data);
      return section ? [[id, section] as const] : [];
    }),
  );
  return { plan, sections };
}

/** True while another request holds a lock younger than 40 s. */
export const lockHeld = (plan: PlanRecord, now: Date): boolean =>
  plan.generatingSince !== null && now.getTime() - Date.parse(plan.generatingSince) < LOCK_MS;

/** True when today's plan is written and nothing changed since (no generation needed). */
export const isCurrent = (plan: PlanRecord | null): boolean => plan !== null && plan.source !== null && !plan.stale;

export type Claim =
  | { readonly kind: "claimed"; readonly since: string }
  | { readonly kind: "fresh" }
  | { readonly kind: "capped" }
  | { readonly kind: "busy"; readonly retryAfterMs: number };

/**
 * Takes the generation lock in a transaction: a fresh lock means "busy"; a lock older
 * than 40 s is taken over. A current Gemini plan is "fresh"; a current Simple plan too, unless the
 * person pressed Try again. After 3 generations today the plan stays as it is ("capped").
 */
export async function claimPlan(db: Db, fid: string, date: string, now: Date, retry: boolean): Promise<Claim> {
  const path = paths.plan(fid, date);
  return db.transaction(async (tx): Promise<Claim> => {
    const plan = parsed(planRecord, await tx.get(path)) ?? planRecord.parse({});
    if (lockHeld(plan, now)) return { kind: "busy", retryAfterMs: LOCK_MS - (now.getTime() - Date.parse(plan.generatingSince as string)) };
    if (isCurrent(plan) && (plan.source === "gemini" || !retry)) return { kind: "fresh" };
    if (plan.generations >= MAX_GENERATIONS) return { kind: "capped" };
    const since = now.toISOString();
    tx.set(
      path,
      { generatingSince: since, generations: plan.generations + 1, stale: false, expireAt: retainedUntil(date) },
      { merge: true },
    );
    return { kind: "claimed", since };
  });
}

/**
 * Gives a claim back after a failed generation (a Firestore error while saving): the lock is
 * cleared and the attempt does not count toward the 3 a day. Only the claim's own lock is touched.
 */
export async function releaseClaim(db: Db, fid: string, date: string, since: string): Promise<void> {
  const path = paths.plan(fid, date);
  await db.transaction(async (tx) => {
    const plan = parsed(planRecord, await tx.get(path));
    if (plan?.generatingSince !== since) return;
    tx.set(path, { generatingSince: null, generations: Math.max(0, plan.generations - 1) }, { merge: true });
  });
}

/** What a generation leaves on the plan doc (the words are null for a Simple plan). */
export interface PlanResult {
  readonly source: "gemini" | "template";
  readonly outcome: string;
  readonly now: Date;
  readonly doc: Pick<PlanRecord, "languages" | "tokens" | "home" | "together">;
  readonly sections: Readonly<Record<string, SectionRecord>>;
}

/**
 * Saves a generation: the plan doc (lock released) and one section per person, replacing the
 * previous sections. `stale` is not touched, so a member change during the generation still
 * makes the next open regenerate.
 */
export async function savePlan(db: Db, fid: string, date: string, result: PlanResult): Promise<void> {
  const old = await db.query(paths.planSections(fid, date));
  const expireAt = retainedUntil(date);
  await db.transaction(async (tx) => {
    for (const { id } of old) if (!(id in result.sections)) tx.delete(paths.planSection(fid, date, id));
    for (const [id, section] of Object.entries(result.sections)) tx.set(paths.planSection(fid, date, id), { ...section, expireAt });
    const doc = {
      ...result.doc,
      source: result.source,
      outcome: result.outcome,
      generatedAt: result.now.toISOString(),
      generatingSince: null,
    };
    tx.set(paths.plan(fid, date), { ...doc, expireAt }, { merge: true });
  });
}
