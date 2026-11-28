/**
 * Content Security Policy and the Firebase auth-helper proxy. No imports, so
 * `next.config.ts` can load it.
 *
 * Why no per-request nonce: Next.js applies nonces only to dynamically rendered pages, so every
 * page would lose static rendering and the CDN cache (Next.js CSP guide, "Static vs Dynamic
 * Rendering with CSP"). Pages render no user-supplied HTML (React escapes text, no
 * `dangerouslySetInnerHTML`), so `'unsafe-inline'` for Next's bootstrap scripts is the accepted
 * trade-off. `script-src-attr 'none'` still blocks inline event handlers.
 */

export interface CspOptions {
  /** `next dev` needs `'unsafe-eval'` (never in production). */
  readonly dev: boolean;
  /** `https://<project>.firebaseapp.com`, framed by Google sign-in; empty without Firebase. */
  readonly firebaseHost: string;
  /** `http://127.0.0.1:3481` in the signed-in E2E build only (see `authEmulatorHost`); else empty. */
  readonly authEmulator?: string;
}

/** The only hosts the browser may call. */
export const CONNECT_HOSTS = [
  "https://air-quality-api.open-meteo.com",
  "https://api.open-meteo.com",
  "https://geocoding-api.open-meteo.com",
  "https://api.bigdatacloud.net",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://firestore.googleapis.com",
  "https://apis.google.com",
] as const;

/** The policy for every page. */
export function csp({ dev, firebaseHost, authEmulator = "" }: CspOptions): string {
  const emulator = authEmulator ? ` ${authEmulator}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://apis.google.com`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${CONNECT_HOSTS.join(" ")}${emulator}`,
    `frame-src 'self' https://accounts.google.com${firebaseHost ? ` ${firebaseHost}` : ""}${emulator}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Security headers on every response. Camera off: there is no in-app scanner. */
export const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["X-Content-Type-Options", "nosniff"],
  // Older browsers ignore CSP frame-ancestors; this header blocks framing there too (clickjacking).
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(self)"],
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains"],
  // Isolates the browsing context but keeps Google sign-in pop-ups able to report back.
  ["Cross-Origin-Opener-Policy", "same-origin-allow-popups"],
];

/**
 * Headers for Firebase's auth helper pages proxied at `/__/auth/*`: only this app may frame them.
 * A rewrite in `next.config.ts` would drop every header, so `src/proxy.ts` rewrites and sets these.
 */
export const AUTH_HELPER_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Content-Security-Policy", "frame-ancestors 'self'; object-src 'none'; base-uri 'self'"],
  ["X-Frame-Options", "SAMEORIGIN"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
];

/** `https://<project>.firebaseapp.com`, or "" without a project id. */
export const firebaseHostOf = (projectId: string | undefined): string =>
  projectId?.trim() ? `https://${projectId.trim()}.firebaseapp.com` : "";

/**
 * Where a same-origin `/__/auth/*` or `/__/firebase/init.json` request is proxied to, so redirect
 * sign-in works where third-party storage is blocked. Null for any other path or without Firebase.
 */
export function firebaseHelperUrl(pathname: string, search: string, firebaseHost: string): string | null {
  if (!firebaseHost || !(pathname.startsWith("/__/auth/") || pathname === "/__/firebase/init.json")) return null;
  return `${firebaseHost}${pathname}${search}`;
}

/** Request headers the proxied auth helper must never receive. */
const NOT_FORWARDED = /^(cookie|authorization|x-forwarded-.*|x-real-ip|forwarded)$/iu;

/**
 * The headers sent on to Firebase for an auth helper request: everything but cookies, credentials
 * and client-address headers, so the app's httpOnly `__session` cookie never leaves for
 * firebaseapp.com (Hosting would pass `__session` on to its logs).
 */
export function helperRequestHeaders(headers: Headers): Headers {
  const out = new Headers();
  headers.forEach((value, key) => {
    if (!NOT_FORWARDED.test(key)) out.set(key, value);
  });
  return out;
}
