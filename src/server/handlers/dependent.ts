import { MAX_DEPENDENTS } from "@/domain/family/caps";
import { canManageDependent } from "@/domain/family/permissions";
import { dependentActivities, dependentTravel } from "@/domain/dependents/defaults";
import { dependentInput, type DependentInput } from "@/domain/dependents/schema";
import { careTagOf, sensitivityGroup } from "@/domain/rules/groups";
import { authorize } from "../auth/guard";
import type { Tx } from "../db/types";
import type { AppDeps } from "../deps";
import { errorResponse, forbidden, notFoundError, privateJson, readJson, type Parsed } from "../http";
import { collectPeopleData, deletePeopleData } from "../repos/cleanup";
import { callerFamily, markPlanStale } from "../repos/family";
import { paths } from "../repos/paths";
import { dependentRecord, parsed } from "../repos/records";

/**
 * `/api/dependent` (spec 5.5, 6.2, 9.3): any member adds a child or teen (at most 4 per family,
 * the caller becomes the guardian); the guardian or the admin edits or deletes them. Delete erases
 * the dependent's items, ticks and plan sections at once. Flexibility, duration and trip length
 * come from the dependent defaults; every change marks today's plan stale.
 */
function dependentFields(input: DependentInput) {
  return {
    name: input.name,
    ageGroup: input.ageGroup,
    conditions: input.conditions,
    careTag: careTagOf(sensitivityGroup(input.ageGroup, input.conditions)),
    activities: dependentActivities(input.picks),
    travel: dependentTravel(input.travel.main, input.travel.others),
    cardLanguage: input.cardLanguage,
  };
}

export async function addDependent(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, dependentInput);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  const now = deps.now();
  const did = auth.db.newId("dependents");
  const result = await auth.db.transaction(async (tx) => {
    const found = await callerFamily(tx, uid);
    if (!found) return "no_family" as const;
    if ((await tx.query(paths.dependents(found.fid))).length >= MAX_DEPENDENTS) return "full" as const;
    const at = now.toISOString();
    tx.set(paths.dependent(found.fid, did), { ...dependentFields(input.data), guardianUid: uid, createdAt: at, updatedAt: at });
    markPlanStale(tx, found.fid, now);
    return "added" as const;
  });
  if (result === "no_family") return forbidden("Join or start a family first.");
  if (result === "full") return errorResponse(409, "too_many", "A family can add up to 4 children or teens in v1.");
  return privateJson({ id: did }, 201);
}

type Change = "missing" | "forbidden" | "done";

/** Runs an edit or delete after the sign-in check, the body check and the guardian-or-admin check. */
async function change<T>(
  deps: AppDeps,
  request: Request,
  did: string,
  read: (request: Request) => Promise<Parsed<T>>,
  apply: (tx: Tx, fid: string, data: T) => Promise<void>,
): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await read(request);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  const result = await auth.db.transaction(async (tx): Promise<Change> => {
    const found = await callerFamily(tx, uid);
    const dependent = found ? parsed(dependentRecord, await tx.get(paths.dependent(found.fid, did))) : null;
    if (!found || !dependent) return "missing";
    if (!canManageDependent(found.family, dependent.guardianUid, uid)) return "forbidden";
    await apply(tx, found.fid, input.data);
    markPlanStale(tx, found.fid, deps.now());
    return "done";
  });
  if (result === "missing") return notFoundError();
  if (result === "forbidden") return forbidden("Only the adult who added them, or the family admin, can change this.");
  return privateJson({ ok: true });
}

const noBody = async (): Promise<Parsed<null>> => ({ ok: true, data: null });

export const updateDependent = (request: Request, deps: AppDeps, did: string): Promise<Response> =>
  change(
    deps,
    request,
    did,
    (r) => readJson(r, dependentInput),
    async (tx, fid, data) => {
      tx.set(paths.dependent(fid, did), { ...dependentFields(data), updatedAt: deps.now().toISOString() }, { merge: true });
    },
  );

export const deleteDependent = (request: Request, deps: AppDeps, did: string): Promise<Response> =>
  change(deps, request, did, noBody, async (tx, fid) => {
    const data = await collectPeopleData(tx, fid, [did]);
    tx.delete(paths.dependent(fid, did));
    deletePeopleData(tx, fid, data);
  });
