import { isLang, LANGS, type Lang } from "@/domain/time/format";

/**
 * Where the proxy sends a page request: the same path under its language segment ("/" → "/hi",
 * "/air" → "/en/air"). Null when the path already starts with a language segment.
 */
export function localisedPath(pathname: string, lang: Lang): string | null {
  const first = pathname.split("/")[1];
  if ((LANGS as readonly string[]).includes(first)) return null;
  return `/${lang}${pathname === "/" ? "" : pathname}`;
}

/**
 * The page language for a request: the saved choice, else the browser's first preferred language
 * when it is Hindi, else English (spec 6.1 item 1, "default from the browser").
 */
export function pickLang(saved: string | undefined, acceptLanguage: string | null): Lang {
  if (isLang(saved)) return saved;
  return (acceptLanguage ?? "").trim().toLowerCase().startsWith("hi") ? "hi" : "en";
}
