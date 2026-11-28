import { z } from "zod";
import { isAdmin, mustStay } from "@/domain/family/permissions";
import { clearedCookies, secureCookies } from "../auth/cookies";
import { authorize } from "../auth/guard";
import type { AppDeps } from "../deps";
import { errorResponse, forbidden, privateJson, readJson } from "../http";
import { callerFamily } from "../repos/family";
import { closeFamily, deleteFamilyTree, takeOut } from "../repos/membership";
import { paths } from "../repos/paths";

/**
 * `DELETE /api/account`: the profile, private health doc, member doc, the
 * dependents the user added and all their data go at once; an admin alone takes the family with
 * them. The Firebase Auth user is deleted with the Admin SDK and both cookies are cleared.
 * `DELETE /api/family` (Danger zone): the admin, alone, types the family name.
 */
export async function deleteAccount(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const { uid } = auth.session;
  const outcome = await auth.db.transaction(async (tx) => {
    const found = await callerFamily(tx, uid);
    if (found && mustStay(found.family, uid)) return { blocked: true, soloFamily: null };
    const soloFamily = found && isAdmin(found.family, uid) ? found.fid : null;
    if (soloFamily) await closeFamily(tx, soloFamily);
    if (found && !soloFamily) await takeOut(tx, found.fid, found.family, uid, deps.now(), "deleted");
    tx.delete(paths.user(uid));
    tx.delete(paths.health(uid));
    return { blocked: false, soloFamily };
  });
  if (outcome.blocked) return errorResponse(409, "admin_with_members", "Remove the other members first, or delete the family.");
  if (outcome.soloFamily) await deleteFamilyTree(auth.db, outcome.soloFamily);
  await deps.auth?.deleteUser(uid);
  deps.sessions?.forget(uid);
  deps.log("account_deleted", { uid });
  return privateJson({ ok: true }, 200, clearedCookies(secureCookies(deps.appOrigin)));
}

const confirmBody = z.strictObject({ confirmName: z.string().max(60) });

const sameName = (a: string, b: string): boolean => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

export async function deleteFamily(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, confirmBody);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  type Result = { fid: string } | { error: "forbidden" | "admin_with_members" | "name_mismatch" };
  const result = await auth.db.transaction(async (tx): Promise<Result> => {
    const found = await callerFamily(tx, uid);
    if (!found || !isAdmin(found.family, uid)) return { error: "forbidden" };
    if (mustStay(found.family, uid)) return { error: "admin_with_members" };
    if (!sameName(input.data.confirmName, found.family.name)) return { error: "name_mismatch" };
    await closeFamily(tx, found.fid);
    tx.set(paths.user(uid), { familyId: null, role: null, updatedAt: deps.now().toISOString() }, { merge: true });
    return { fid: found.fid };
  });
  if ("fid" in result) {
    await deleteFamilyTree(auth.db, result.fid);
    return privateJson({ ok: true });
  }
  if (result.error === "forbidden") return forbidden("Only the family admin can delete the family.");
  if (result.error === "name_mismatch") return errorResponse(400, "name_mismatch", "Type the family name exactly to confirm.");
  return errorResponse(409, result.error, "Remove the other members first, or delete the family.");
}
