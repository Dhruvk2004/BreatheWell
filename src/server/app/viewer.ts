import { firebaseWebConfig, type Env } from "@/config/env";
import type { AppDeps } from "../deps";
import { loadFamily, type FamilyBundle } from "../repos/family";
import type { UserRecord } from "../repos/records";
import { readUser } from "../repos/users";

/**
 * Who is looking at a signed-in page. Pages never trust the proxy's cookie check: the session is
 * verified here, and a removed member (not in `memberUids`) gets no family.
 */
export type Viewer =
  | { readonly kind: "not_configured" }
  | { readonly kind: "signed_out" }
  | {
      readonly kind: "signed_in";
      readonly uid: string;
      readonly googleName: string;
      readonly user: UserRecord;
      readonly bundle: FamilyBundle | null;
    };

export async function loadViewer(cookie: string | null, deps: AppDeps): Promise<Viewer> {
  if (!deps.db || !deps.sessions) return { kind: "not_configured" };
  const session = await deps.sessions.verify(cookie, "read");
  const user = session ? await readUser(deps.db, session.uid) : null;
  if (!session || !user) return { kind: "signed_out" };
  const loaded = user.familyId ? await loadFamily(deps.db, user.familyId) : null;
  const bundle = loaded?.family.memberUids.includes(session.uid) ? loaded : null;
  return { kind: "signed_in", uid: session.uid, googleName: session.googleName, user, bundle };
}

export type Needs = "account" | "family" | "no_family" | "signed_out";

/**
 * Where a page sends a viewer who cannot see it, or null to render it: signed-in pages need a
 * session (and a family), Create family needs a finished profile and no family, Sign-in needs
 * nobody signed in. Without Firebase every signed-in page shows Sign-in's "not configured" state.
 */
export function redirectFor(viewer: Viewer, needs: Needs, here: string): string | null {
  if (needs === "signed_out")
    return viewer.kind === "signed_in" ? (viewer.bundle && viewer.user.onboarded ? "/today" : "/onboarding") : null;
  if (viewer.kind !== "signed_in") return `/sign-in?next=${encodeURIComponent(here)}`;
  if (needs === "family" && !viewer.bundle) return "/onboarding";
  if (needs === "no_family") return viewer.bundle ? "/today" : viewer.user.onboarded ? null : "/onboarding";
  return null;
}

/** Sign-in works only with the Admin SDK and the web config (else the "not configured" state). */
export const signInConfigured = (deps: Pick<AppDeps, "db" | "sessions">, env: Env): boolean =>
  Boolean(deps.db && deps.sessions && firebaseWebConfig(env));
