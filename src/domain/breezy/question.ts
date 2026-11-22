import { foldText } from "../text/fold";

/**
 * Breezy's input hygiene (spec 7.7.7): the question is capped at 300 characters with control
 * characters and markdown links stripped; the client-held history is untrusted, so it is flattened
 * to plain text, prior cards' actions are dropped, and the total is capped at 800 characters. Text
 * is folded first (`foldText`), so zero-width, fullwidth and look-alike spellings cannot split a
 * word or hide a name (stage 7 AI-7, AI-8).
 */
export const MAX_QUESTION = 300;
export const MAX_HISTORY = 800;
export const MAX_TURNS = 4;

export interface Turn {
  readonly role: "user" | "breezy";
  readonly text: string;
}

// Control characters (C0, DEL, C1); format characters are already deleted by `foldText`.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/gu;
const MD_LINK = /!?\[([^\]]*)\]\([^)]*\)/gu;
const BARE_URL = /\bhttps?:\/\/\S+/giu;
// "< /user_question>" and fullwidth brackets too: anything that reads as our fence tag.
const FENCE = /[<＜]\s*[/／]?\s*user_(?:question|history)\s*[>＞]/giu;

/** Plain text for the fenced field: links and fence tags removed, spaces collapsed. */
export function cleanText(raw: string): string {
  return foldText(raw).replace(CONTROL, " ").replace(MD_LINK, "$1").replace(BARE_URL, " ").replace(FENCE, " ").replace(/\s+/gu, " ").trim();
}

/** The question as sent: cleaned and cut to 300 characters (code points, so Hindi is not split). */
export const cleanQuestion = (raw: string): string => [...cleanText(raw)].slice(0, MAX_QUESTION).join("");

/** The last 4 turns as plain lines, newest kept, at most 800 characters in all. */
export function historyText(turns: readonly Turn[]): string {
  const lines = turns.slice(-MAX_TURNS).map((t) => `${t.role === "user" ? "Q" : "A"}: ${cleanText(t.text)}`);
  let kept = lines;
  while (kept.length > 1 && [...kept.join("\n")].length > MAX_HISTORY) kept = kept.slice(1);
  return [...kept.join("\n")].slice(-MAX_HISTORY).join("");
}
