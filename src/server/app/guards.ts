import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SESSION_COOKIE } from "../auth/cookies";
import type { FamilyBundle } from "../repos/family";
import { appDeps } from "../runtime";
import { loadViewer, redirectFor, type Needs, type Viewer } from "./viewer";

export type SignedIn = Extract<Viewer, { kind: "signed_in" }>;
export type InFamily = SignedIn & { readonly bundle: FamilyBundle };

/**
 * The viewer of this request, from the session cookie (verified, not only present). Request time
 * from here on: the session check and the family's day use the clock, which Cache Components
 * refuses during a prerender.
 */
export async function currentViewer(): Promise<Viewer> {
  await connection();
  return loadViewer((await cookies()).get(SESSION_COOKIE)?.value ?? null, appDeps());
}

async function viewerFor(needs: Needs, here: string): Promise<Viewer> {
  const viewer = await currentViewer();
  const target = redirectFor(viewer, needs, here);
  if (target) redirect(target);
  return viewer;
}

/** The signed-in viewer, or a redirect to Sign-in. */
export const requireAccount = async (here: string): Promise<SignedIn> => (await viewerFor("account", here)) as SignedIn;

/** The signed-in viewer with a family, or a redirect to Sign-in or to Start / Join. */
export const requireFamily = async (here: string): Promise<InFamily> => (await viewerFor("family", here)) as InFamily;

/** Create family: set up, and not in a family yet (else Today). */
export const requireNoFamily = async (here: string): Promise<SignedIn> => (await viewerFor("no_family", here)) as SignedIn;

/** Sign-in: a viewer who is already signed in goes on (Today or onboarding). */
export const requireSignedOut = async (here: string): Promise<Viewer> => viewerFor("signed_out", here);
