import { z } from "zod";
import { isDemoProject, type Env } from "@/config/env";
import { addDays, localTime } from "@/domain/time/clock";
import type { Db } from "../db/types";
import { paths } from "./paths";

/**
 * The global Gemini budget: one Firestore counter `quota/{date}` for every placement, keyed
 * by Google's quota day (requests per day reset at midnight Pacific time, 13:30 IST). At
 * 80% of the daily limit every placement switches to its template; a per-minute count keeps calls
 * under the per-minute limit (over it, the template, not a queue). Spec 7.8 protects plans first,
 * then community, then Breezy: Breezy may use half the day's budget and community a quarter, and
 * neither may take the last 3 calls of a minute, so a few accounts asking Breezy cannot push every
 * family onto template plans.
 */
export type Placement = "plan" | "community" | "breezy";

/**
 * The free-tier limits assumed until the owner reads the project's real RPM/RPD in AI Studio (build
 * log, slice 1 check 2). Deliberately low, so the design holds if Google cuts the free tier.
 */
export const GEMINI_LIMITS = { rpd: 250, rpm: 10 } as const;

/**
 * The limits in force. Signed-in E2E only: `E2E_GEMINI_RPM` raises the per-minute limit for the
 * local Gemini stand-in, honoured only for a `demo-*` Firebase project (as `E2E_IST_CLOCK` is), so
 * the suite's back-to-back plans do not take Breezy's share of one minute.
 */
export function geminiLimits(env: Env = process.env): Limits {
  const rpm = Number(env.E2E_GEMINI_RPM);
  const demo = isDemoProject(env.FIREBASE_PROJECT_ID);
  return demo && Number.isInteger(rpm) && rpm > 0 ? { ...GEMINI_LIMITS, rpm } : GEMINI_LIMITS;
}
export const BUDGET_SHARE = 0.8;
/** The share of the day's budget each placement may use; plans may use all of it. */
export const PLACEMENT_SHARE: Readonly<Record<Placement, number>> = { plan: 1, community: 0.25, breezy: 0.5 };
/** Calls per minute only plans may use. */
export const PLAN_RESERVED_RPM = 3;
/** Quota docs are kept 90 days. */
const KEEP_DAYS = 90;

const quotaRecord = z.object({
  geminiCalls: z.number().default(0),
  byPlacement: z.record(z.string(), z.number()).default({}),
  minuteBucket: z.string().default(""),
  minuteCount: z.number().default(0),
});

export interface Limits {
  readonly rpd: number;
  readonly rpm: number;
}

/** Gemini's requests-per-day reset at midnight Pacific time, not at midnight in India. */
export const QUOTA_TIME_ZONE = "America/Los_Angeles";

/** The quota day an instant counts toward ("2024-11-17" until 13:30 IST on 18 Nov). */
export const quotaDay = (now: Date): string => localTime({ now, timeZone: QUOTA_TIME_ZONE }).date;

/** The calls a day may use before the switch to templates. */
export const dailyBudget = (limits: Limits): number => Math.floor(limits.rpd * BUDGET_SHARE);

type Quota = z.infer<typeof quotaRecord>;

/** True when this placement may still take a call today and this minute. */
function hasRoom(quota: Quota, minuteCount: number, placement: Placement, limits: Limits): boolean {
  const budget = dailyBudget(limits);
  const own = quota.byPlacement[placement] ?? 0;
  const rpm = placement === "plan" ? limits.rpm : Math.max(1, limits.rpm - PLAN_RESERVED_RPM);
  return quota.geminiCalls < budget && own < Math.floor(budget * PLACEMENT_SHARE[placement]) && minuteCount < rpm;
}

/**
 * Takes one Gemini call from today's budget in a transaction; false when the 80% switch or the
 * per-minute limit says "use the template".
 */
export async function reserveGeminiCall(db: Db, placement: Placement, now: Date, limits: Limits = geminiLimits()): Promise<boolean> {
  const date = quotaDay(now);
  const path = paths.quota(date);
  const minute = now.toISOString().slice(0, 16);
  return db.transaction(async (tx) => {
    const parsed = quotaRecord.safeParse((await tx.get(path)) ?? {});
    const quota = parsed.success ? parsed.data : quotaRecord.parse({});
    const minuteCount = quota.minuteBucket === minute ? quota.minuteCount : 0;
    if (!hasRoom(quota, minuteCount, placement, limits)) return false;
    tx.set(path, {
      geminiCalls: quota.geminiCalls + 1,
      byPlacement: { ...quota.byPlacement, [placement]: (quota.byPlacement[placement] ?? 0) + 1 },
      minuteBucket: minute,
      minuteCount: minuteCount + 1,
      expireAt: `${addDays(date, KEEP_DAYS)}T00:00:00.000Z`,
    });
    return true;
  });
}

/** True while today's budget still has room (pages skip the Personalising badge once it is spent). */
export async function budgetLeft(db: Db, now: Date, limits: Limits = GEMINI_LIMITS): Promise<boolean> {
  const parsed = quotaRecord.safeParse((await db.get(paths.quota(quotaDay(now)))) ?? {});
  return !parsed.success || parsed.data.geminiCalls < dailyBudget(limits);
}
