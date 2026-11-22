import type { Tx } from "../db/types";
import { paths } from "./paths";

/** Everything stored about some people (members or dependents) in one family, found before deleting. */
export interface PeopleData {
  readonly ids: readonly string[];
  readonly items: readonly string[];
  readonly progress: readonly string[];
  /** The plan sections (`plans/{date}/members/{id}`) that exist for these people. */
  readonly planSections: readonly string[];
}

/** Reads every item, tick and existing plan section for these people (all reads, so writes can follow). */
export async function collectPeopleData(tx: Tx, fid: string, ids: readonly string[]): Promise<PeopleData> {
  const items = await Promise.all(ids.map((id) => tx.query(paths.items(fid), [{ field: "forId", value: id }])));
  const progress = await Promise.all(ids.map((id) => tx.query(paths.progressAll(fid), [{ field: "forId", value: id }])));
  const dates = (await tx.query(paths.plans(fid))).map(({ id }) => id);
  const sections = await Promise.all(dates.map((date) => tx.query(paths.planSections(fid, date))));
  return {
    ids,
    items: items.flat().map(({ id }) => paths.item(fid, id)),
    progress: progress.flat().map(({ id }) => `${paths.progressAll(fid)}/${id}`),
    planSections: sections.flatMap((docs, i) =>
      docs.filter(({ id }) => ids.includes(id)).map(({ id }) => paths.planSection(fid, dates[i], id)),
    ),
  };
}

/** Deletes their items, ticks and plan sections at once (spec 5.5 step 4, 9.4). */
export function deletePeopleData(tx: Tx, fid: string, data: PeopleData): void {
  for (const path of [...data.items, ...data.progress, ...data.planSections]) tx.delete(path);
}

/** The dependents a member added (deleted with them when they leave, are removed or delete their account). */
export async function dependentsAddedBy(tx: Tx, fid: string, uid: string): Promise<string[]> {
  return (await tx.query(paths.dependents(fid), [{ field: "guardianUid", value: uid }])).map(({ id }) => id);
}

/**
 * Takes a member out of a family: their member doc, the dependents they added and all their data.
 * `collected` comes from `collectPeopleData` for the member and those dependents.
 */
export function removeFromFamily(tx: Tx, fid: string, uid: string, dependents: readonly string[], collected: PeopleData): void {
  tx.delete(paths.member(fid, uid));
  for (const did of dependents) tx.delete(paths.dependent(fid, did));
  deletePeopleData(tx, fid, collected);
}
