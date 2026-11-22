/**
 * The viewer's language and text size live in two first-party cookies, so they survive closing the
 * tab and the Google sign-in redirect (spec 5.3), and the server can pick the right language before
 * rendering: `src/proxy.ts` rewrites every page to its static `/en` or `/hi` variant.
 */
export const PREF_COOKIES = { lang: "bw-lang", textSize: "bw-text" } as const;

/** Text size: Normal → Large (125%) → Extra large (150%) (spec 11.5, tokens `html[data-text]`). */
export const TEXT_SIZES = ["md", "lg", "xl"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** True for a supported text size. */
export const isTextSize = (value: unknown): value is TextSize => TEXT_SIZES.includes(value as TextSize);

/** The next text size in the Aa cycle. */
export const nextTextSize = (size: TextSize): TextSize => TEXT_SIZES[(TEXT_SIZES.indexOf(size) + 1) % TEXT_SIZES.length];

const ONE_YEAR = 60 * 60 * 24 * 365;

/** A `document.cookie` assignment for one preference: a year, the whole site, Lax, Secure on HTTPS. */
export function prefCookie(name: string, value: string, secure: boolean): string {
  return `${name}=${value}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/**
 * Applies the saved text size to `<html data-text>` before the first paint, so large text never
 * reflows the page after hydration. A constant string (no user data), run inline in `<head>`.
 */
export const TEXT_SIZE_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )${PREF_COOKIES.textSize}=(md|lg|xl)(?:;|$)/);if(m)document.documentElement.setAttribute("data-text",m[1])}catch(e){}`;
