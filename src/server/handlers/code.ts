import { isAdmin } from "@/domain/family/permissions";
import { authorize } from "../auth/guard";
import type { AppDeps } from "../deps";
import { forbidden, privateJson } from "../http";
import { callerFamily } from "../repos/family";
import { familyCodes, freshCode, writeCode } from "../repos/joinCodes";
import { paths } from "../repos/paths";

/**
 * `POST /api/family/code` ("Make a new code"): the admin's new code replaces the
 * old one at once; the old one is deleted, so it stops working.
 */
export async function regenerateCode(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const { uid } = auth.session;
  const result = await auth.db.transaction(async (tx) => {
    const found = await callerFamily(tx, uid);
    if (!found || !isAdmin(found.family, uid)) return null;
    const old = await familyCodes(tx, found.fid);
    const code = await freshCode(tx, deps.randomBytes);
    for (const stale of old) tx.delete(paths.joinCode(stale));
    return writeCode(tx, code, found.fid, uid, deps.now());
  });
  return result ? privateJson(result, 201) : forbidden("Only the family admin can make a new code.");
}
