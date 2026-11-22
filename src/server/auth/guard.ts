import type { AppDeps } from "../deps";
import type { Db } from "../db/types";
import { errorResponse, forbiddenOrigin, isSameOrigin, rateLimited } from "../http";
import { clearedCookies, readCookie, secureCookies, SESSION_COOKIE } from "./cookies";
import type { Session, SessionKind } from "./session";

/**
 * The step at the top of every signed-in route handler: Firebase must be configured, writes must
 * come from the app's own origin (CSRF), the session cookie must verify (with the revocation
 * check for writes) and writes are rate limited per user.
 */
export type Authorized = { ok: true; session: Session; db: Db } | { ok: false; response: Response };

export const notConfigured = (): Response => errorResponse(503, "not_configured", "Sign-in isn't configured on this deployment.");

export const sessionCookieOf = (request: Request): string | null => readCookie(request.headers.get("cookie"), SESSION_COOKIE);

/** 401 that also clears a cookie that no longer verifies, so the browser stops sending it. */
function signInAgain(hadCookie: boolean, appOrigin: string | null): Response {
  const response = errorResponse(401, "unauthenticated", "Please sign in again.");
  if (hadCookie) for (const cookie of clearedCookies(secureCookies(appOrigin))) response.headers.append("Set-Cookie", cookie);
  return response;
}

export async function authorize(request: Request, deps: AppDeps, kind: SessionKind): Promise<Authorized> {
  if (!deps.db || !deps.sessions) return { ok: false, response: notConfigured() };
  if (kind === "write" && !isSameOrigin(request, deps.appOrigin)) return { ok: false, response: forbiddenOrigin() };
  const cookie = sessionCookieOf(request);
  const session = await deps.sessions.verify(cookie, kind);
  if (!session) return { ok: false, response: signInAgain(cookie !== null, deps.appOrigin) };
  if (kind === "write") {
    const limit = deps.limits.mutation.check(session.uid);
    if (!limit.allowed) return { ok: false, response: rateLimited(limit.retryAfterSeconds) };
  }
  return { ok: true, session, db: deps.db };
}
