import { z } from "zod";
import { canDeleteItem, canTick } from "@/domain/family/permissions";
import { authorize } from "../auth/guard";
import type { Tx } from "../db/types";
import type { AppDeps } from "../deps";
import { forbidden, notFoundError, privateJson, readJson } from "../http";
import { callerFamily } from "../repos/family";
import { paths } from "../repos/paths";
import { dependentRecord, itemRecord, parsed, type FamilyRecord, type ItemRecord } from "../repos/records";

/**
 * `PATCH /api/items/{id}` ticks a checklist or plan item; `DELETE` removes it (spec 9.2–9.3). A
 * member ticks their own items and any dependent's; the target, the adder, the dependent's
 * guardian or the admin may delete. Items are created by Breezy actions.
 */
const body = z.strictObject({ done: z.boolean() });

interface Found {
  readonly fid: string;
  readonly family: FamilyRecord;
  readonly item: ItemRecord;
  /** The dependent's guardian when the item is for a dependent, else null. */
  readonly guardianUid: string | null;
}

async function findItem(tx: Tx, uid: string, id: string): Promise<Found | null> {
  const found = await callerFamily(tx, uid);
  if (!found) return null;
  const item = parsed(itemRecord, await tx.get(paths.item(found.fid, id)));
  if (!item) return null;
  const dependent = parsed(dependentRecord, await tx.get(paths.dependent(found.fid, item.forId)));
  return { fid: found.fid, family: found.family, item, guardianUid: dependent?.guardianUid ?? null };
}

type Outcome = "missing" | "forbidden" | "done";

const respond = (outcome: Outcome): Response =>
  outcome === "missing" ? notFoundError() : outcome === "forbidden" ? forbidden() : privateJson({ ok: true });

export async function tickItem(request: Request, deps: AppDeps, id: string): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, body);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  const outcome = await auth.db.transaction(async (tx): Promise<Outcome> => {
    const found = await findItem(tx, uid, id);
    if (!found) return "missing";
    if (!canTick(found.item.forId, uid, found.guardianUid !== null)) return "forbidden";
    const doneAt = input.data.done ? deps.now().toISOString() : null;
    tx.set(paths.item(found.fid, id), { done: input.data.done, doneAt }, { merge: true });
    return "done";
  });
  return respond(outcome);
}

export async function deleteItem(request: Request, deps: AppDeps, id: string): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const { uid } = auth.session;
  const outcome = await auth.db.transaction(async (tx): Promise<Outcome> => {
    const found = await findItem(tx, uid, id);
    if (!found) return "missing";
    if (!canDeleteItem(found.family, found.item, found.guardianUid, uid)) return "forbidden";
    tx.delete(paths.item(found.fid, id));
    return "done";
  });
  return respond(outcome);
}
