import { passesKidChecks } from "@/domain/libraries/kid";
import { formatTime, parseHhMm, type Lang } from "@/domain/time/format";
import type { ChecklistItem } from "@/view/app";
import type { Db } from "../db/types";
import { paths } from "./paths";
import { itemRecord, parsed, progressRecord } from "./records";

/**
 * Today's checklist for one person: items added by Breezy or the family, in the
 * viewer's language when written in it. For a dependent, `onCard` says whether the text passes the
 * kid-card checks; an item that fails stays on the parent's view only.
 */
export async function checklistFor(db: Db, fid: string, forId: string, date: string, lang: Lang): Promise<ChecklistItem[]> {
  const docs = await db.query(paths.items(fid), [
    { field: "forId", value: forId },
    { field: "date", value: date },
  ]);
  return docs.flatMap(({ id, data }) => {
    const item = parsed(itemRecord, data);
    if (!item) return [];
    const text = item.text[lang] ?? item.text.en ?? item.text.hi ?? "";
    if (!text) return [];
    // A Breezy plan item carries its time from the rules: "3 pm · Temple visit".
    const shown = item.time ? `${formatTime(parseHhMm(item.time).hour, parseHhMm(item.time).minute, lang)} · ${text}` : text;
    return [{ id, text: shown, addedByName: item.addedByName, done: item.done, onCard: passesKidChecks(text) }];
  });
}

/** The plan keys a person has ticked today (spec 9.1 `progress`). */
export async function tickedKeys(db: Db, fid: string, forId: string, date: string): Promise<string[]> {
  const progress = parsed(progressRecord, await db.get(paths.progress(fid, date, forId)));
  return Object.keys(progress?.done ?? {});
}
