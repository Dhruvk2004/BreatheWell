import { z } from "zod";
import type { Db } from "../db/types";
import { paths } from "./paths";
import { parsed } from "./records";

/**
 * Join attempts per user: 5 per 10 minutes and 20 per day, kept in Firestore
 * `rateLimits` (the only per-user limit stored there) so every server instance counts the same.
 */
export const JOIN_WINDOW_MS = 10 * 60 * 1000;
export const JOIN_WINDOW_MAX = 5;
export const JOIN_DAY_MS = 24 * 60 * 60 * 1000;
export const JOIN_DAY_MAX = 20;
const KEEP_MS = 2 * JOIN_DAY_MS;

const attempts = z.object({ windowStart: z.string(), count: z.number(), dayStart: z.string(), dayCount: z.number() });
type Attempts = z.infer<typeof attempts>;

/** The counts after one more attempt, and whether it is allowed (pure). */
export function countAttempt(current: Attempts | null, now: Date): { allowed: boolean; next: Attempts } {
  const at = now.toISOString();
  const t = now.getTime();
  const windowFresh = !current || t - Date.parse(current.windowStart) >= JOIN_WINDOW_MS;
  const dayFresh = !current || t - Date.parse(current.dayStart) >= JOIN_DAY_MS;
  const next = {
    windowStart: windowFresh ? at : current.windowStart,
    count: windowFresh ? 1 : current.count + 1,
    dayStart: dayFresh ? at : current.dayStart,
    dayCount: dayFresh ? 1 : current.dayCount + 1,
  };
  return { allowed: next.count <= JOIN_WINDOW_MAX && next.dayCount <= JOIN_DAY_MAX, next };
}

/** Records one join attempt for the user; false once over either limit. Kept 2 days. */
export async function allowJoinAttempt(db: Db, uid: string, now: Date): Promise<boolean> {
  const path = paths.rateLimit(`join_${uid}`);
  return db.transaction(async (tx) => {
    const { allowed, next } = countAttempt(parsed(attempts, await tx.get(path)), now);
    tx.set(path, { ...next, expireAt: new Date(now.getTime() + KEEP_MS).toISOString() });
    return allowed;
  });
}
