/**
 * The viewer's language lives in a first-party cookie, so it survives closing the
 * tab and the Google sign-in redirect, and the server can pick the right language before
 * rendering: `src/proxy.ts` rewrites every page to its static `/en` or `/hi` variant.
 */
export const PREF_COOKIES = { lang: "bw-lang" } as const;

const ONE_YEAR = 60 * 60 * 24 * 365;

/** A `document.cookie` assignment for one preference: a year, the whole site, Lax, Secure on HTTPS. */
export function prefCookie(name: string, value: string, secure: boolean): string {
  return `${name}=${value}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
