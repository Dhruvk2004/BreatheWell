import { z } from "zod";
import { initialsOf } from "@/domain/family/caps";
import { accountCookieHeader, clearedCookies, secureCookies, SESSION_TTL_MS, sessionCookieHeader } from "../auth/cookies";
import { notConfigured, sessionCookieOf } from "../auth/guard";
import type { SessionClaims } from "../auth/session";
import type { AppDeps } from "../deps";
import { errorResponse, forbiddenOrigin, isSameOrigin, privateJson, rateLimited, readJson } from "../http";
import { checkClient } from "../rateLimit";
import { ensureUser } from "../repos/users";

/**
 * `POST /api/session` exchanges a fresh Google sign-in for the httpOnly session cookie (as in
 * Utsav). The body must carry the "I am 18 or older" tick (spec 7.0, 10.4): without it nothing is
 * stored, no profile exists and no cookie is set. `DELETE` signs out.
 */
const body = z.strictObject({ idToken: z.string().min(1).max(4096), adultConfirmed: z.literal(true) });

/** Only a sign-in from the last five minutes may mint a session cookie (Firebase's guidance). */
export const RECENT_SIGN_IN_S = 5 * 60;

async function verified(deps: AppDeps, idToken: string): Promise<SessionClaims | null> {
  try {
    const claims = await deps.auth!.verifyIdToken(idToken);
    return deps.now().getTime() / 1000 - claims.auth_time > RECENT_SIGN_IN_S ? null : claims;
  } catch {
    return null;
  }
}

export async function createSession(request: Request, deps: AppDeps): Promise<Response> {
  if (!deps.auth || !deps.db) return notConfigured();
  if (!isSameOrigin(request, deps.appOrigin)) return forbiddenOrigin();
  const limit = checkClient(deps.limits.session, request.headers);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);
  const input = await readJson(request, body);
  if (!input.ok) return input.response;
  const claims = await verified(deps, input.data.idToken);
  if (!claims) return errorResponse(401, "invalid_token", "Sign-in didn't finish. Try again.");
  const cookie = await deps.auth.createSessionCookie(input.data.idToken, { expiresIn: SESSION_TTL_MS });
  const user = await ensureUser(deps.db, claims.uid, claims.name ?? "", deps.now());
  deps.log("session_created", { uid: claims.uid });
  const secure = secureCookies(deps.appOrigin);
  return privateJson({ onboarded: user.onboarded, hasFamily: user.familyId !== null }, 200, [
    sessionCookieHeader(cookie, secure),
    accountCookieHeader(initialsOf(user.name), secure),
  ]);
}

/** Signs out everywhere: revokes the refresh tokens and clears both cookies. */
export async function deleteSession(request: Request, deps: AppDeps): Promise<Response> {
  if (!isSameOrigin(request, deps.appOrigin)) return forbiddenOrigin();
  const session = await deps.sessions?.verify(sessionCookieOf(request), "read");
  if (session && deps.auth) {
    await deps.auth.revokeRefreshTokens(session.uid);
    deps.sessions?.forget(session.uid);
  }
  return privateJson({ ok: true }, 200, clearedCookies(secureCookies(deps.appOrigin)));
}
