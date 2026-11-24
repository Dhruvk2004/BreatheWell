import { TtlCache } from "../cache";

/**
 * Session verification. The cookie is verified locally (signature and expiry with
 * cached Google keys), then checked for revocation on reads and writes alike: the cookie's
 * `auth_time` against the user's `tokensValidAfterTime`, cached per uid for 60 s. A deleted or
 * disabled account counts as revoked, so "Sign out everywhere" and disabling a user in the console
 * also end page reads with a copied cookie.
 */
export type SessionKind = "read" | "write";

export const REVOCATION_TTL_MS = 60_000;
/** Writes re-check sooner, so another instance's sign-out stops writes within 10 s. */
export const WRITE_REVOCATION_TTL_MS = 10_000;

/** The claims BreatheWell reads from a verified ID token or session cookie. */
export interface SessionClaims {
  readonly uid: string;
  /** Seconds since the epoch when the user signed in. */
  readonly auth_time: number;
  readonly name?: string;
}

/** The Firebase Admin Auth calls the server makes, so tests can supply a fake. */
export interface SessionAuth {
  verifyIdToken(idToken: string): Promise<SessionClaims>;
  createSessionCookie(idToken: string, options: { expiresIn: number }): Promise<string>;
  verifySessionCookie(cookie: string, checkRevoked: boolean): Promise<SessionClaims>;
  getUser(uid: string): Promise<{ tokensValidAfterTime?: string; disabled?: boolean }>;
  revokeRefreshTokens(uid: string): Promise<void>;
  deleteUser(uid: string): Promise<void>;
}

export interface Session {
  readonly uid: string;
  /** The Google display name, used only to pre-fill "What does the family call you?". */
  readonly googleName: string;
}

export class SessionVerifier {
  private readonly validAfter: Record<SessionKind, TtlCache<number>>;

  constructor(
    private readonly auth: SessionAuth,
    clock: () => number = Date.now,
  ) {
    this.validAfter = {
      read: new TtlCache<number>(5_000, REVOCATION_TTL_MS, clock),
      write: new TtlCache<number>(5_000, WRITE_REVOCATION_TTL_MS, clock),
    };
  }

  /** The session for a cookie, or null when it is missing, invalid, expired or revoked. */
  async verify(cookie: string | null, kind: SessionKind): Promise<Session | null> {
    if (!cookie) return null;
    let claims: SessionClaims;
    try {
      claims = await this.auth.verifySessionCookie(cookie, false);
    } catch {
      return null;
    }
    if (await this.isRevoked(claims, this.validAfter[kind])) return null;
    return { uid: claims.uid, googleName: claims.name ?? "" };
  }

  /** Drops the cached revocation time, so this instance re-checks on the next request (sign-out). */
  forget(uid: string): void {
    this.validAfter.read.delete(uid);
    this.validAfter.write.delete(uid);
  }

  private async isRevoked(claims: SessionClaims, cache: TtlCache<number>): Promise<boolean> {
    let after = cache.get(claims.uid);
    if (after === undefined) {
      try {
        const user = await this.auth.getUser(claims.uid);
        after = user.disabled ? Number.POSITIVE_INFINITY : user.tokensValidAfterTime ? Date.parse(user.tokensValidAfterTime) : 0;
      } catch {
        // The account no longer exists (or Auth is unreachable): refuse this request, ask again next time.
        return true;
      }
      cache.set(claims.uid, after);
    }
    return claims.auth_time * 1000 < after;
  }
}
