import type { ActionBody } from "@/domain/breezy/answer";
import { addDays } from "@/domain/time/clock";
import type { Db } from "../db/types";
import { familyToday, retainedUntil, stillInFamily } from "./family";
import { paths } from "./paths";

/** What a confirmed Breezy action writes (`items`): created by the server only. */
export interface NewItem {
  readonly body: ActionBody;
  readonly forId: string;
  readonly by: { readonly uid: string; readonly name: string };
  readonly now: Date;
}

/**
 * Writes a plan or checklist item "added by {name}", kept 30 days after its date; returns its id,
 * or null when the adder or the person left the family meanwhile (checked in the same transaction).
 */
export async function addItem(db: Db, fid: string, item: NewItem): Promise<string | null> {
  const { body } = item;
  const today = familyToday(item.now);
  const date = body.date === "today" ? today : addDays(today, 1);
  const id = db.newId(paths.items(fid));
  const plan = body.type === "add_to_plan";
  const written = await db.transaction(async (tx) => {
    if (!(await stillInFamily(tx, fid, item.by.uid, item.forId))) return false;
    tx.set(paths.item(fid, id), {
      forId: item.forId,
      date,
      time: plan ? body.time : null,
      breezyActivity: body.activity,
      kind: plan ? "plan" : "checklist",
      text: body.item,
      factId: body.factId,
      source: "assistant",
      addedBy: item.by.uid,
      addedByName: item.by.name,
      done: false,
      doneAt: null,
      createdAt: item.now.toISOString(),
      expireAt: retainedUntil(date),
    });
    return true;
  });
  return written ? id : null;
}
