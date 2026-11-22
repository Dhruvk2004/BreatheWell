import { z } from "zod";
import { addDays } from "@/domain/time/clock";
import type { Db } from "../db/types";
import { paths } from "./paths";
import { quotaDay } from "./quota";

/**
 * Breezy's daily caps (spec 7.8): 30 questions a day per user and 60 per family, counted in
 * Firestore under the day's quota doc (server only). Only questions that would reach Gemini count;
 * the emergency text, the alias question and the basics never do.
 */
export const BREEZY_DAILY = { user: 30, family: 60 } as const;

/** Kept with the quota doc: 90 days (spec 9.4). */
const KEEP_DAYS = 90;
const count = z.object({ count: z.number() });

/** Takes one question from both caps in a transaction; false once either is used up. */
export async function reserveBreezyQuestion(db: Db, uid: string, fid: string, now: Date): Promise<boolean> {
  const date = quotaDay(now);
  const user = paths.breezyCount(date, `u_${uid}`);
  const family = paths.breezyCount(date, `f_${fid}`);
  return db.transaction(async (tx) => {
    const used = await Promise.all([tx.get(user), tx.get(family)]);
    const [u, f] = used.map((doc) => count.safeParse(doc ?? {}).data?.count ?? 0);
    if (u >= BREEZY_DAILY.user || f >= BREEZY_DAILY.family) return false;
    const expireAt = `${addDays(date, KEEP_DAYS)}T00:00:00.000Z`;
    tx.set(user, { count: u + 1, expireAt });
    tx.set(family, { count: f + 1, expireAt });
    return true;
  });
}
