import { NextResponse, type NextRequest } from "next/server";
import { PREF_COOKIES } from "@/components/prefs/cookies";
import { AUTH_HELPER_HEADERS, firebaseHelperUrl, firebaseHostOf, helperRequestHeaders } from "@/server/csp";
import { localisedPath, pickLang } from "@/server/lang";

// The Firebase project behind Google sign-in (public web config, inlined at build time).
const FIREBASE_HOST = firebaseHostOf(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

/**
 * Serves Firebase's auth helper from the app's own origin with its own security headers (spec 10.4),
 * without the request's cookies (stage 7 PT-10).
 */
function authHelper(helper: string, request: NextRequest): NextResponse {
  const response = NextResponse.rewrite(new URL(helper), { request: { headers: helperRequestHeaders(request.headers) } });
  for (const [key, value] of AUTH_HELPER_HEADERS) response.headers.set(key, value);
  return response;
}

/**
 * Next.js 16 proxy (formerly middleware). Two jobs, each decided by a unit-tested function:
 * `/__/auth/*` goes to Firebase (`firebaseHelperUrl`), and every page is rewritten to its static
 * `/en` or `/hi` variant from the language cookie or the browser (`pickLang`, `localisedPath`), so
 * pages are server-rendered in the viewer's language and stay static. Sign-in is not checked here:
 * signed-in pages call `requireAccount` / `requireFamily` (src/server/app/guards.ts) and every
 * write route calls `authorize` (session cookie + CSRF origin check, src/server/auth/guard.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const helper = firebaseHelperUrl(pathname, search, FIREBASE_HOST);
  if (helper) return authHelper(helper, request);
  const lang = pickLang(request.cookies.get(PREF_COOKIES.lang)?.value, request.headers.get("accept-language"));
  const target = localisedPath(pathname, lang);
  return target ? NextResponse.rewrite(new URL(`${target}${search}`, request.url)) : NextResponse.next();
}

// Pages and the auth helper; never Next.js assets, API routes or files with an extension.
export const config = { matcher: ["/__/:path*", "/((?!_next/|api/|__/|.*\\.[a-zA-Z0-9]+$).*)"] };
