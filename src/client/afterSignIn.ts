import { errorCode } from "./api";
import { joinFamily } from "./actions";
import type { SessionState } from "./auth";
import { afterSignInPath, type Pending } from "./pending";

/**
 * Where a fresh sign-in goes (spec 5.2–5.4). With a join code kept across the redirect, the join
 * runs first: joined → onboarding (or Today once set up); a join error → back to the invite page,
 * which shows it. Without a code: `next`, Today or onboarding.
 */
export async function afterSignIn(state: SessionState, pending: Pending): Promise<string> {
  if (!pending.joinCode) return afterSignInPath(state, pending.next);
  try {
    await joinFamily(pending.joinCode);
    return state.onboarded ? "/today" : "/onboarding";
  } catch (error) {
    return `/join/${encodeURIComponent(pending.joinCode)}?error=${encodeURIComponent(errorCode(error))}`;
  }
}
