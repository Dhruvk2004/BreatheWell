import { z } from "zod";
import { communityOutputSchema, type CommunityOutput } from "@/ai/community/schema";
import { addDays } from "@/domain/time/clock";
import type { Db } from "../db/types";
import { paths } from "./paths";

/**
 * `communityCache/{gridId}_{date}_{audience}`: the day's Gemini message for a grid
 * cell, shared by every visitor and family there; kept 7 days. `regenerated` marks the one
 * regeneration allowed after the band moves by 2 or more or the best window changes; `bestWindow`
 * is the window the words were written for. `lockedUntil` is the generation lock: one caller
 * generates, the others show the template meanwhile (no cache stampede on the daily quota).
 */
const record = z.object({
  words: communityOutputSchema,
  together: z.string(),
  bandAtGen: z.number(),
  regenerated: z.boolean().default(false),
  bestWindow: z.string().nullable().default(null),
  generatedAt: z.string(),
});
export type CachedCommunity = z.infer<typeof record>;

const KEEP_DAYS = 7;
/** Longer than one generation (15 s budget) with room for the save. */
export const COMMUNITY_LOCK_MS = 30_000;

export const communityKey = (gridId: string, date: string): string => `${gridId}_${date}_society`;

export async function readCommunity(db: Db, key: string): Promise<CachedCommunity | null> {
  const parsed = record.safeParse((await db.get(paths.communityCache(key))) ?? undefined);
  return parsed.success ? parsed.data : null;
}

export interface NewCommunity {
  readonly words: CommunityOutput;
  readonly together: string;
  readonly bandAtGen: number;
  readonly regenerated: boolean;
  readonly bestWindow: string | null;
  readonly date: string;
  readonly now: Date;
}

export async function saveCommunity(db: Db, key: string, entry: NewCommunity): Promise<void> {
  const { date, now, ...rest } = entry;
  await db.transaction(async (tx) => {
    tx.set(paths.communityCache(key), {
      ...rest,
      source: "gemini",
      generatedAt: now.toISOString(),
      expireAt: `${addDays(date, KEEP_DAYS)}T00:00:00.000Z`,
    });
  });
}

/** Takes the generation lock for a key; false while another caller holds it. */
export async function claimCommunity(db: Db, key: string, now: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    const doc = await tx.get(paths.communityCache(key));
    const until = typeof doc?.lockedUntil === "string" ? Date.parse(doc.lockedUntil) : 0;
    if (until > now.getTime()) return false;
    tx.set(paths.communityCache(key), { lockedUntil: new Date(now.getTime() + COMMUNITY_LOCK_MS).toISOString() }, { merge: true });
    return true;
  });
}

/** Gives the lock back after a failed generation (a saved entry replaces the doc and the lock). */
export async function releaseCommunity(db: Db, key: string): Promise<void> {
  await db.transaction(async (tx) => {
    tx.set(paths.communityCache(key), { lockedUntil: null }, { merge: true });
  });
}
