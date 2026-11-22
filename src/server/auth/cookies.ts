/**
 * The session cookie (spec 9, as in Utsav): `__session`, httpOnly, SameSite=Lax, Secure on https,
 * five days. Beside it, `bw-acct` holds only the viewer's initials (not httpOnly) so the static
 * header can show the avatar menu instead of "Sign in" without making every page dynamic.
 */
export const SESSION_COOKIE = "__session";
export const ACCOUNT_COOKIE = "bw-acct";
export const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000;

/** Reads one cookie from a `Cookie` header. A value that is not valid percent-encoding counts as none. */
export function readCookie(header: string | null, name: string): string | null {
  for (const part of header?.split(";") ?? []) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function cookie(name: string, value: string, secure: boolean, maxAgeMs: number, httpOnly: boolean): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    ...(httpOnly ? ["HttpOnly"] : []),
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export const sessionCookieHeader = (value: string, secure: boolean, maxAgeMs = SESSION_TTL_MS): string =>
  cookie(SESSION_COOKIE, value, secure, maxAgeMs, true);

/** The initials hint for the header ("NS"); letters only, at most 2, never the name itself. */
export const accountCookieHeader = (initials: string, secure: boolean, maxAgeMs = SESSION_TTL_MS): string =>
  cookie(ACCOUNT_COOKIE, initials, secure, maxAgeMs, false);

/** Both cookies cleared (sign-out, account deleted, session no longer valid). */
export const clearedCookies = (secure: boolean): string[] => [sessionCookieHeader("", secure, 0), accountCookieHeader("", secure, 0)];

/** Secure everywhere except a plain-http origin (local development and the E2E servers). */
export const secureCookies = (appOrigin: string | null): boolean => !appOrigin?.startsWith("http://");
