import type { HomeSetup } from "@/domain/libraries/homeSetup";
import { addDays, INDIA_TIME_ZONE, localTime } from "@/domain/time/clock";
import type { Db, Tx } from "../db/types";
import { paths } from "./paths";
import {
  dependentRecord,
  familyRecord,
  homeSetupRecord,
  memberRecord,
  parsed,
  userRecord,
  type DependentRecord,
  type FamilyRecord,
  type MemberRecord,
  type UserRecord,
} from "./records";

/** A family as the server reads it for one request: one document read per part (spec 11.3). */
export interface FamilyBundle {
  readonly id: string;
  readonly family: FamilyRecord;
  readonly homeSetup: HomeSetup | null;
  readonly members: readonly { readonly uid: string; readonly record: MemberRecord }[];
  readonly dependents: readonly { readonly id: string; readonly record: DependentRecord }[];
}

/** Loads the family, its home set-up, members and dependents in parallel; null when it is gone. */
export async function loadFamily(db: Db, fid: string): Promise<FamilyBundle | null> {
  const [familyDoc, homeDoc, memberDocs, dependentDocs] = await Promise.all([
    db.get(paths.family(fid)),
    db.get(paths.home(fid)),
    db.query(paths.members(fid)),
    db.query(paths.dependents(fid)),
  ]);
  const family = parsed(familyRecord, familyDoc);
  if (!family) return null;
  return {
    id: fid,
    family,
    homeSetup: parsed(homeSetupRecord, homeDoc),
    members: memberDocs.flatMap(({ id, data }) => {
      const record = parsed(memberRecord, data);
      return record && family.memberUids.includes(id) ? [{ uid: id, record }] : [];
    }),
    dependents: dependentDocs.flatMap(({ id, data }) => {
      const record = parsed(dependentRecord, data);
      return record ? [{ id, record }] : [];
    }),
  };
}

/** The family's calendar date (India time; the app's families are in Indian cities). */
export const familyToday = (now: Date): string => localTime({ now, timeZone: INDIA_TIME_ZONE }).date;

/** Plans, member plans, items and progress are kept 30 days after their date (spec 9.4); the daily
 * clean-up (src/server/cleanup) deletes them after `expireAt`. */
export const retainedUntil = (date: string): string => `${addDays(date, 30)}T00:00:00.000Z`;

/**
 * A member or dependent change makes today's plan stale (spec 7.2): the next open of Today
 * regenerates it. Merged, so a plan that does not exist yet is simply flagged, with its expiry.
 */
export function markPlanStale(tx: Tx, fid: string, now: Date): void {
  const date = familyToday(now);
  tx.set(paths.plan(fid, date), { stale: true, expireAt: retainedUntil(date) }, { merge: true });
}

/** Reads a family inside a transaction; null when it does not exist or the caller is not in it. */
export async function familyFor(tx: Tx, fid: string, uid: string): Promise<FamilyRecord | null> {
  const family = parsed(familyRecord, await tx.get(paths.family(fid)));
  return family && family.memberUids.includes(uid) ? family : null;
}

/**
 * Inside a writing transaction, before its writes: true while the caller is still in the family and
 * `forId` is still one of its members or dependents, so a request in flight when a member is
 * removed writes nothing after `takeOut` (stage 7 AUTH-4).
 */
export async function stillInFamily(tx: Tx, fid: string, uid: string, forId: string): Promise<boolean> {
  const family = await familyFor(tx, fid, uid);
  if (!family) return false;
  return family.memberUids.includes(forId) || (await tx.get(paths.dependent(fid, forId))) !== null;
}

/** The caller with the family they are in, read inside a transaction. */
export interface CallerFamily {
  readonly fid: string;
  readonly family: FamilyRecord;
  readonly user: UserRecord;
}

/** The caller's user doc and family; null when they have no profile or are not in a family. */
export async function callerFamily(tx: Tx, uid: string): Promise<CallerFamily | null> {
  const user = parsed(userRecord, await tx.get(paths.user(uid)));
  const family = user?.familyId ? await familyFor(tx, user.familyId, uid) : null;
  return user?.familyId && family ? { fid: user.familyId, family, user } : null;
}
