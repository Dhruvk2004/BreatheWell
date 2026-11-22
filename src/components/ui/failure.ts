import { errorCode } from "@/client/api";
import { t, type Lang, type MessageKey } from "@/i18n/t";

/** The server's code when Firestore's daily write quota is used up (design: "Saving paused"). */
export const SAVING_PAUSED = "saving_paused";

/**
 * The words for a failed write: "Saving is paused until tomorrow…" when the write quota is used up,
 * the screen's own message for a known code, else the fallback.
 */
export function failureText(error: unknown, lang: Lang, fallback: MessageKey, known: Readonly<Record<string, MessageKey>> = {}): string {
  const code = errorCode(error);
  if (code === SAVING_PAUSED) return t(lang, "common.savingPaused");
  return t(lang, known[code] ?? fallback);
}
