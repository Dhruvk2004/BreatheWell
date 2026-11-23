import { initialsOf } from "@/domain/family/caps";
import { profileInput, storedProfileOf } from "@/domain/members/profile";
import { PREF_COOKIES, prefCookie } from "@/components/prefs/cookies";
import { accountCookieHeader, secureCookies } from "../auth/cookies";
import { authorize } from "../auth/guard";
import type { AppDeps } from "../deps";
import { errorResponse, privateJson, readJson } from "../http";
import { familyFor, markPlanStale } from "../repos/family";
import { paths } from "../repos/paths";
import { parsed, userRecord } from "../repos/records";

/**
 * `PUT /api/profile`: onboarding and profile edits (spec 6.1, 10.5, 10.15). The user's own profile,
 * the private health doc (owner only, spec 6.5) and, in a family, the member doc the family plans
 * with (tag only, never the conditions). A member change marks today's plan stale (spec 7.2).
 */
export async function saveProfile(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, profileInput);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  const p = input.data;
  const now = deps.now();
  const at = now.toISOString();
  const profile = storedProfileOf(p);
  const saved = await auth.db.transaction(async (tx) => {
    const user = parsed(userRecord, await tx.get(paths.user(uid)));
    if (!user) return false;
    const family = user.familyId ? await familyFor(tx, user.familyId, uid) : null;
    const own = { name: p.name, language: p.language };
    tx.set(paths.user(uid), { ...own, profile, onboarded: true, updatedAt: at }, { merge: true });
    tx.set(paths.health(uid), { conditions: p.conditions, shareWith: p.shareWith, updatedAt: at });
    if (family && user.familyId) {
      tx.set(paths.member(user.familyId, uid), { ...own, ...profile, onboarded: true }, { merge: true });
      markPlanStale(tx, user.familyId, now);
    }
    return true;
  });
  if (!saved) return errorResponse(404, "no_profile", "Please sign in again.");
  const secure = secureCookies(deps.appOrigin);
  return privateJson({ ok: true }, 200, [
    accountCookieHeader(initialsOf(p.name), secure),
    prefCookie(PREF_COOKIES.lang, p.language, secure),
  ]);
}
