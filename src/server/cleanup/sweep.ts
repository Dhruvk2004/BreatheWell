/**
 * The daily clean-up for data retention (on the free Spark plan, Firestore TTL policies are
 * not available): deletes every document whose `expireAt` has passed, one collection group at a
 * time, in small batches, within a delete and time budget that stays far inside Spark's free
 * 20,000 deletes a day.
 */

/** Every collection group the server writes `expireAt` into (src/server/repos, src/server/air). */
export const EXPIRING_GROUPS = [
  "airCache",
  "joinCodes",
  "rateLimits",
  "quota",
  "breezy",
  "communityCache",
  "items",
  "progress",
  "plans",
  "members",
] as const;

export type ExpiringGroup = (typeof EXPIRING_GROUPS)[number];

/** Deletes up to `limit` documents of a group whose `expireAt` is before `before`; returns how many. */
export interface ExpiredSweeper {
  deleteExpired(group: ExpiringGroup, before: Date, limit: number): Promise<number>;
}

export interface SweepBudget {
  readonly batch: number;
  readonly maxDeletes: number;
  /** Stop starting new batches after this many milliseconds. */
  readonly maxMs: number;
}

export const DEFAULT_BUDGET: SweepBudget = { batch: 300, maxDeletes: 3_000, maxMs: 40_000 };

export interface SweepResult {
  readonly deleted: Readonly<Partial<Record<ExpiringGroup, number>>>;
  readonly total: number;
  /** False when the budget ran out before every group was empty; the next day's run continues. */
  readonly complete: boolean;
}

/** Empties one group in batches; returns the count and whether the group is now empty. */
async function sweepGroup(
  sweeper: ExpiredSweeper,
  group: ExpiringGroup,
  now: Date,
  left: () => number,
  timeUp: () => boolean,
  batch: number,
): Promise<{ count: number; empty: boolean }> {
  let count = 0;
  while (left() - count > 0 && !timeUp()) {
    const limit = Math.min(batch, left() - count);
    const removed = await sweeper.deleteExpired(group, now, limit);
    count += removed;
    if (removed < limit) return { count, empty: true };
  }
  return { count, empty: false };
}

/** Runs the sweep over every group. `clock` is read before each batch to keep to the time budget. */
export async function sweepExpired(sweeper: ExpiredSweeper, clock: () => Date, budget: SweepBudget = DEFAULT_BUDGET): Promise<SweepResult> {
  const now = clock();
  const started = now.getTime();
  const deleted: Partial<Record<ExpiringGroup, number>> = {};
  let total = 0;
  let complete = true;
  const left = () => budget.maxDeletes - total;
  const timeUp = () => clock().getTime() - started >= budget.maxMs;
  for (const group of EXPIRING_GROUPS) {
    if (left() <= 0 || timeUp()) {
      complete = false;
      break;
    }
    const { count, empty } = await sweepGroup(sweeper, group, now, left, timeUp, budget.batch);
    if (count > 0) deleted[group] = count;
    total += count;
    if (!empty) complete = false;
  }
  return { deleted, total, complete };
}
