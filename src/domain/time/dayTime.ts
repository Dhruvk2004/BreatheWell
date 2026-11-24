import { formatInstant } from "./instant";
import type { Lang } from "./format";

/**
 * "Sat, 22 Nov, 6:10 pm" for code expiry and join times, in the family's time
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
