import { isAdmin } from "@/domain/family/permissions";
import { familyInput, familyPatch, storedHome } from "@/domain/family/home";
import { safeName } from "@/domain/members/names";
import { SETTING_UP_PROFILE } from "@/domain/members/profile";
import { authorize } from "../auth/guard";
import type { AppDeps } from "../deps";
import { errorResponse, forbidden, privateJson, readJson } from "../http";
import { callerFamily, familyFor, markPlanStale } from "../repos/family";
import { freshCode, writeCode } from "../repos/joinCodes";
import { paths } from "../repos/paths";
import { parsed, userRecord } from "../repos/records";

/**
 * `POST /api/family`: create a family (spec 5.2, 10.6, 9.3: a signed-in adult with no family). The
 * creator becomes the admin and the first member, and the first join code is made at once.
 * `PATCH`: the admin changes the name, home area or home set-up; the server computes the rounded
 * coordinates and grid cell, so they always match (spec 9.1).
 */
export async function createFamily(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, familyInput);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  const now = deps.now();
  const at = now.toISOString();
  const fid = auth.db.newId("families");
  const result = await auth.db.transaction(async (tx) => {
    const user = parsed(userRecord, await tx.get(paths.user(uid)));
    if (!user) return "no_profile" as const;
    if (!user.adultConfirmedAt) return "not_adult" as const;
    // A familyId whose family is gone (or no longer lists the user) is "no family" (stage 7 AUTH-2).
    if (user.familyId && (await familyFor(tx, user.familyId, uid))) return "in_family" as const;
    const code = await freshCode(tx, deps.randomBytes);
    const { name, home, homeSetup } = input.data;
    tx.set(paths.family(fid), { name, adminUid: uid, memberUids: [uid], home: storedHome(home), createdAt: at });
    tx.set(paths.home(fid), homeSetup);
    const profile = user.profile ?? SETTING_UP_PROFILE;
    tx.set(paths.member(fid, uid), {
      name: safeName(user.name),
      language: user.language,
      onboarded: user.onboarded,
      ...profile,
      joinedAt: at,
      joinedVia: null,
    });
    tx.set(paths.user(uid), { familyId: fid, role: "admin", removedFrom: null, updatedAt: at }, { merge: true });
    return writeCode(tx, code, fid, uid, now);
  });
  if (result === "no_profile") return errorResponse(404, "no_profile", "Please sign in again.");
  if (result === "not_adult") return forbidden("BreatheWell accounts are for adults (18+).");
  if (result === "in_family") return errorResponse(409, "in_family", "You're already in a family.");
  deps.log("family_created", { uid });
  return privateJson({ familyId: fid, ...result }, 201);
}

export async function updateFamily(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, familyPatch);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  const now = deps.now();
  const ok = await auth.db.transaction(async (tx) => {
    const found = await callerFamily(tx, uid);
    if (!found || !isAdmin(found.family, uid)) return false;
    const { name, home, homeSetup } = input.data;
    if (name || home)
      tx.set(paths.family(found.fid), { ...(name ? { name } : {}), ...(home ? { home: storedHome(home) } : {}) }, { merge: true });
    if (homeSetup) tx.set(paths.home(found.fid), homeSetup);
    markPlanStale(tx, found.fid, now);
    return true;
  });
  return ok ? privateJson({ ok: true }) : forbidden("Only the family admin can change these settings.");
}
