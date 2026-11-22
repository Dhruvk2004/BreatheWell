import type { Db } from "../db/types";
import { loadFamily, type FamilyBundle } from "../repos/family";
import type { UserRecord } from "../repos/records";
import { readUser } from "../repos/users";

/** The signed-in adult and the family they still belong to. */
export interface Caller {
  readonly user: UserRecord;
  readonly bundle: FamilyBundle;
}

/** The caller's user record and family, or null when the user has no family or was removed from it. */
export async function familyOfCaller(db: Db, uid: string): Promise<Caller | null> {
  const user = await readUser(db, uid);
  const bundle = user?.familyId ? await loadFamily(db, user.familyId) : null;
  return user && bundle?.family.memberUids.includes(uid) ? { user, bundle } : null;
}
