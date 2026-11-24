import type { Lang } from "@/domain/time/format";
import { PREF_COOKIES, prefCookie } from "@/i18n/prefCookies";

/**
 * Saves the language and reloads: the proxy then serves the page's static variant in that language,
 * rendered on the server (no English flash, `<html lang>` right from the first byte).
 */
export function switchLanguage(lang: Lang): void {
  document.cookie = prefCookie(PREF_COOKIES.lang, lang, location.protocol === "https:");
  location.reload();
}
