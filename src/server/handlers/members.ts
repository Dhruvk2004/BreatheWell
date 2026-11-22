import { isAdmin, mustStay } from "@/domain/family/permissions";
import { authorize } from "../auth/guard";
import type { AppDeps } from "../deps";
import { errorResponse, forbidden, notFoundError, privateJson } from "../http";
import { callerFamily } from "../repos/family";
import { takeOut } from "../repos/membership";

/**
 * `POST /api/family/leave` (spec 5.10) and `DELETE /api/family/members/{uid}` (admin removes a
 * member, spec 5.9). Both take the member out with the dependents they added. An admin cannot
 * leave while others are in the family: they remove them first or delete the family.
 */
export async function leaveFamily(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const { uid } = auth.session;
  const result = await auth.db.transaction(async (tx) => {
    const found = await callerFamily(tx, uid);
    if (!found) return "no_family" as const;
    if (isAdmin(found.family, uid)) return mustStay(found.family, uid) ? ("admin_with_members" as const) : ("admin_alone" as const);
    await takeOut(tx, found.fid, found.family, uid, deps.now(), "left");
    return "left" as const;
  });
  if (result === "no_family") return notFoundError();
  if (result === "admin_with_members") return errorResponse(409, result, "Remove the other members first, or delete the family.");
  if (result === "admin_alone") return errorResponse(409, result, "You're the only adult. Delete the family instead.");
  return privateJson({ ok: true });
}

export async function removeMember(request: Request, deps: AppDeps, target: string): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const { uid } = auth.session;
  if (target === uid) return errorResponse(400, "self", "Use Leave family in your profile.");
  const result = await auth.db.transaction(async (tx) => {
    const found = await callerFamily(tx, uid);
    if (!found || !isAdmin(found.family, uid)) return "forbidden" as const;
    if (!found.family.memberUids.includes(target)) return "not_found" as const;
    await takeOut(tx, found.fid, found.family, target, deps.now(), "removed");
    return "removed" as const;
  });
  if (result === "forbidden") return forbidden("Only the family admin can remove members.");
  if (result === "not_found") return notFoundError();
  deps.log("member_removed", { uid });
  return privateJson({ ok: true });
}
