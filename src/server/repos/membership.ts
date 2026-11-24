import type { Db, Tx } from "../db/types";
import { collectPeopleData, dependentsAddedBy, removeFromFamily } from "./cleanup";
import { markPlanStale } from "./family";
import { familyCodes } from "./joinCodes";
import { paths } from "./paths";
import type { FamilyRecord } from "./records";

export type Departure = "left" | "removed" | "deleted";

/**
 * Takes a member out of the family: their member doc, the dependents they added
 * (an accepted v1 limit) and every item, tick and plan section of all of them. Their
 * own profile stays unless the account is deleted; a removed member is told once, by family name.
 */
export async function takeOut(tx: Tx, fid: string, family: FamilyRecord, uid: string, now: Date, why: Departure): Promise<void> {
  const dependents = await dependentsAddedBy(tx, fid, uid);
  const data = await collectPeopleData(tx, fid, [uid, ...dependents]);
  removeFromFamily(tx, fid, uid, dependents, data);
  tx.set(paths.family(fid), { memberUids: family.memberUids.filter((m) => m !== uid) }, { merge: true });
  if (why !== "deleted") {
    const removedFrom = why === "removed" ? family.name : null;
    tx.set(paths.user(uid), { familyId: null, role: null, removedFrom, updatedAt: now.toISOString() }, { merge: true });
  }
  markPlanStale(tx, fid, now);
}

/**
 * Inside the deleting transaction, before any write: the family doc and its join codes go at
 * once, so a join that lands before the tree is deleted finds no family.
 */
export async function closeFamily(tx: Tx, fid: string): Promise<void> {
  const codes = await familyCodes(tx, fid);
  for (const code of codes) tx.delete(paths.joinCode(code));
  tx.delete(paths.family(fid));
}

/**
 * Deletes a family whose admin is alone (spec 10.14 Danger zone, 5.10): every document under it
 * (dependents, items, progress, plans) and its join codes. The tree goes first, so a failure
 * part-way leaves the user pointing at a missing family, which the app treats as "no family".
 */
export async function deleteFamilyTree(db: Db, fid: string): Promise<void> {
  await db.deleteTree(paths.family(fid));
  await db.transaction(async (tx) => {
    for (const code of await familyCodes(tx, fid)) tx.delete(paths.joinCode(code));
  });
}
