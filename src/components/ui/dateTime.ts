import { formatInstant } from "@/domain/time/instant";
import type { Lang } from "@/i18n/t";

/**
 * "Sat, 22 Nov, 6:10 pm" for code expiry and join times (design 10.7, 10.14), in the family's time
 * zone. Rendered on the server and passed down as text, so the browser never re-formats it.
 */
export function dayTime(iso: string, timeZone: string, lang: Lang): string {
  const at = new Date(iso);
  const day = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(at);
  return `${day}, ${formatInstant(at, timeZone, lang)}`;
}
