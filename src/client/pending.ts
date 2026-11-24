import { z } from "zod";

/**
 * What must survive the Google redirect: the join code, the 18+ tick and
 * where to go next. The language already lives in its own cookie. Kept in `sessionStorage` (this
 * tab only) and read back once after sign-in.
 */
export const PENDING_KEY = "bw:pending-sign-in";

export interface Pending {
  readonly adultConfirmed: true;
  readonly joinCode: string | null;
  readonly next: string | null;
}

const schema = z.object({
  adultConfirmed: z.literal(true),
  joinCode: z.string().max(20).nullable(),
  next: z.string().max(200).nullable(),
});

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function savePending(store: Store, pending: Pending): void {
  try {
    store.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Storage blocked: the popup path still works without it.
  }
}

/** Reads and clears the saved state; null when there is none or it is not ours. */
export function takePending(store: Store): Pending | null {
  try {
    const raw = store.getItem(PENDING_KEY);
    store.removeItem(PENDING_KEY);
    const parsed = raw ? schema.safeParse(JSON.parse(raw)) : null;
    return parsed?.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** True when a redirect sign-in was started in this tab. */
export function hasPending(store: Store): boolean {
  try {
    return store.getItem(PENDING_KEY) !== null;
  } catch {
    return false;
  }
}

const SENTINEL = "https://next.invalid";
// Control characters, whitespace and backslashes: the URL parser drops or rewrites them, so
// "/\t/evil.example" would become "//evil.example".
const UNSAFE = /[\u0000-\u001f\u007f\s\\]/u;

/** A same-site path to return to after sign-in, never another origin (open-redirect guard). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || UNSAFE.test(next)) return null;
  // Resolved against a fixed origin: "/.//evil.example" normalises to "//evil.example", so the result is checked too.
  const url = new URL(next, SENTINEL);
  const path = `${url.pathname}${url.search}${url.hash}`;
  return url.origin === SENTINEL && !path.startsWith("//") ? path.slice(0, 200) : null;
}

/** Where a fresh session goes (spec 5.2–5.4): back to `next`, else Today, else onboarding. */
export function afterSignInPath(state: { onboarded: boolean; hasFamily: boolean }, next: string | null): string {
  if (state.onboarded && state.hasFamily) return safeNext(next) ?? "/today";
  return "/onboarding";
}
