import { z } from "zod";
import { apiRequest, type Fetch } from "./api";
import { hasPending, savePending, takePending, type Pending } from "./pending";

/**
 * Google sign-in (spec 10.4, as in Utsav): a popup on desktop, the redirect on phones or when the
 * popup is blocked. The Google ID token and the 18+ tick go to `POST /api/session`, which sets the
 * httpOnly cookie; the Firebase web SDK is signed out straight away (the cookie is the session).
 */
export interface GoogleSignIn {
  popup(): Promise<string>;
  redirect(): Promise<void>;
  redirectResult(): Promise<string | null>;
  signOut(): Promise<void>;
}

export type SignInFailure = "cancelled" | "popup_blocked" | "failed";

export interface SessionState {
  readonly onboarded: boolean;
  readonly hasFamily: boolean;
}

export type SignInResult = { ok: true; state: SessionState; pending: Pending } | { ok: false; reason: SignInFailure };

const CANCELLED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]);

/** The UI's failure reason for a Firebase error code. */
export function signInFailure(error: unknown): SignInFailure {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "auth/popup-blocked") return "popup_blocked";
  return CANCELLED.has(code) ? "cancelled" : "failed";
}

const sessionSchema = z.object({ onboarded: z.boolean(), hasFamily: z.boolean() });

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class AuthClient {
  private loading: Promise<GoogleSignIn> | null = null;

  constructor(
    private readonly loadSdk: () => Promise<GoogleSignIn>,
    private readonly store: Store,
    private readonly fetcher: Fetch = fetch,
  ) {}

  /** Loads the SDK early, so the click opens the popup without waiting (popup blockers). */
  preload(): void {
    void this.load().catch(() => undefined);
  }

  private load(): Promise<GoogleSignIn> {
    this.loading ??= this.loadSdk().catch((error: unknown) => {
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  async popup(pending: Pending): Promise<SignInResult> {
    try {
      const google = await this.load();
      return await this.exchange(google, await google.popup(), pending);
    } catch (error) {
      return { ok: false, reason: signInFailure(error) };
    }
  }

  /**
   * Saves the pending state, then leaves for Google; the page finishes with `completeRedirect`.
   * Resolves null while the page navigates away, or a failure when the SDK or the redirect throws.
   */
  async redirect(pending: Pending): Promise<SignInResult | null> {
    try {
      const google = await this.load();
      savePending(this.store, pending);
      await google.redirect();
      return null;
    } catch (error) {
      takePending(this.store);
      return { ok: false, reason: signInFailure(error) };
    }
  }

  async completeRedirect(): Promise<SignInResult | null> {
    if (!hasPending(this.store)) return null;
    const pending = takePending(this.store);
    try {
      const google = await this.load();
      const idToken = await google.redirectResult();
      return idToken && pending ? await this.exchange(google, idToken, pending) : null;
    } catch (error) {
      return { ok: false, reason: signInFailure(error) };
    }
  }

  private async exchange(google: GoogleSignIn, idToken: string, pending: Pending): Promise<SignInResult> {
    const body = { idToken, adultConfirmed: true };
    try {
      const state = await apiRequest("/api/session", sessionSchema, { method: "POST", body }, this.fetcher);
      return { ok: true, state, pending };
    } finally {
      // The cookie is the session; the web SDK never keeps a signed-in user, even on failure.
      await google.signOut().catch(() => undefined);
    }
  }
}

/** Signs out: the server revokes the session and clears both cookies. */
export async function signOut(fetcher: Fetch = fetch): Promise<void> {
  await apiRequest("/api/session", z.unknown(), { method: "DELETE" }, fetcher).catch(() => undefined);
}
